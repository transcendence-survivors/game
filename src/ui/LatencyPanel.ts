import type { Observer } from '@babylonjs/core/Misc/observable';
import type { Scene } from '@babylonjs/core/scene';
import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture';
import { Control } from '@babylonjs/gui/2D/controls/control';
import { Grid } from '@babylonjs/gui/2D/controls/grid';
import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle';
import { StackPanel } from '@babylonjs/gui/2D/controls/stackPanel';
import { TextBlock } from '@babylonjs/gui/2D/controls/textBlock';

// Color thresholds (ms) for the per-player dot and value text.
const LATENCY_GOOD_MS = 50;
const LATENCY_OK_MS = 150;

// Palette — Tailwind slate + indigo + emerald/amber/rose so the readout
// matches the existing dark background of the page.
const COLOR_BG = '#0f172aeb';
const COLOR_BORDER = 'rgba(129, 140, 248, 0.35)';
const COLOR_ACCENT = '#818cf8';
const COLOR_DIVIDER = 'rgba(148, 163, 184, 0.18)';
const COLOR_TEXT_PRIMARY = '#f1f5f9';
const COLOR_TEXT_MUTED = '#94a3b8';
const COLOR_GOOD = '#10b981';
const COLOR_OK = '#f59e0b';
const COLOR_BAD = '#ef4444';
const COLOR_UNKNOWN = '#64748b';

const PANEL_WIDTH_PX = 280;
const PANEL_PADDING_X_PX = 16;
const PANEL_PADDING_Y_PX = 14;
const INNER_WIDTH_PX = PANEL_WIDTH_PX - PANEL_PADDING_X_PX * 2;
const ROW_HEIGHT_PX = 26;
const HEADER_HEIGHT_PX = 22;
const FOOTER_HEIGHT_PX = 26;
const DIVIDER_HEIGHT_PX = 1;
const DOT_SIZE_PX = 10;

const FONT_PRIMARY = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
const FONT_MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

// Per-frame easing toward target alpha — 0..1, higher = snappier.
const FADE_LERP = 0.18;

interface Row {
	root: Grid;
	dot: Rectangle;
	name: TextBlock;
	value: TextBlock;
}

interface TextOpts {
	color: string;
	font: string;
	size: number;
	/** `Control.HORIZONTAL_ALIGNMENT_*` — text is always vertically centered. */
	align: number;
	weight?: string;
	paddingLeft?: string;
}

/** Build a {@link TextBlock} with the panel's common defaults applied. */
function makeText(name: string, text: string, o: TextOpts): TextBlock {
	const t = new TextBlock(name, text);
	t.color = o.color;
	t.fontFamily = o.font;
	t.fontSize = o.size;
	t.textHorizontalAlignment = o.align;
	t.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
	if (o.weight !== undefined) {
		t.fontWeight = o.weight;
	}
	if (o.paddingLeft !== undefined) {
		t.paddingLeft = o.paddingLeft;
	}
	return t;
}

interface RectOpts {
	width?: string | number;
	height?: string | number;
	background: string;
	cornerRadius?: number;
	align?: number;
	vAlign?: number;
}

/** Build a borderless {@link Rectangle} (the panel never uses rect borders). */
function makeRect(name: string, o: RectOpts): Rectangle {
	const r = new Rectangle(name);
	if (o.width !== undefined) {
		r.width = o.width;
	}
	if (o.height !== undefined) {
		r.height = o.height;
	}
	r.background = o.background;
	r.thickness = 0;
	if (o.cornerRadius !== undefined) {
		r.cornerRadius = o.cornerRadius;
	}
	if (o.align !== undefined) {
		r.horizontalAlignment = o.align;
	}
	if (o.vAlign !== undefined) {
		r.verticalAlignment = o.vAlign;
	}
	return r;
}

export class LatencyPanel {
	private readonly scene: Scene;
	private readonly ui: AdvancedDynamicTexture;
	private readonly root: Rectangle;
	private readonly list: StackPanel;
	private readonly footerTick: TextBlock;
	private readonly footerTps: TextBlock;
	private readonly footerFps: TextBlock;
	private readonly rows = new Map<string, Row>();
	private readonly localSessionId: string;

	private targetAlpha = 0;
	private currentAlpha = 0;
	private renderObserver: Observer<Scene> | null = null;

	constructor(scene: Scene, localSessionId: string) {
		this.scene = scene;
		this.localSessionId = localSessionId;

		this.ui = AdvancedDynamicTexture.CreateFullscreenUI(
			'latencyUI',
			true,
			scene,
		);

		this.root = new Rectangle('latencyPanel');
		this.root.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
		this.root.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
		this.root.top = '16px';
		this.root.left = '-16px';
		this.root.width = `${PANEL_WIDTH_PX}px`;
		this.root.background = COLOR_BG;
		this.root.color = COLOR_BORDER;
		this.root.thickness = 1;
		this.root.cornerRadius = 12;
		this.root.adaptHeightToChildren = true;
		this.root.shadowBlur = 24;
		this.root.shadowOffsetX = 0;
		this.root.shadowOffsetY = 8;
		this.root.shadowColor = 'rgba(0, 0, 0, 0.45)';
		this.root.alpha = 0;
		this.root.isVisible = false;
		this.ui.addControl(this.root);

		// Babylon GUI's `padding*` on a Rectangle does NOT compose with
		// `adaptHeightToChildren` — children would overflow the rounded border.
		// Instead, fix the inner width explicitly and emulate vertical padding
		// with spacers at the top and bottom of the stack.
		const stack = new StackPanel('latencyStack');
		stack.isVertical = true;
		stack.width = `${INNER_WIDTH_PX}px`;
		stack.adaptHeightToChildren = true;
		this.root.addControl(stack);

		stack.addControl(this.buildSpacer(PANEL_PADDING_Y_PX));
		stack.addControl(this.buildHeader());
		stack.addControl(this.buildSpacer(10));

		this.list = new StackPanel('latencyList');
		this.list.isVertical = true;
		this.list.width = 1;
		this.list.adaptHeightToChildren = true;
		stack.addControl(this.list);

		stack.addControl(this.buildSpacer(10));
		stack.addControl(this.buildDivider());
		stack.addControl(this.buildSpacer(8));

		const footer = this.buildFooter();
		this.footerTick = footer.tick;
		this.footerTps = footer.tps;
		this.footerFps = footer.fps;
		stack.addControl(footer.root);

		stack.addControl(this.buildSpacer(PANEL_PADDING_Y_PX));

		this.renderObserver = scene.onBeforeRenderObservable.add(() =>
			this.tickFade(),
		);
	}

	add(sessionId: string, latencyMs: number): void {
		if (this.rows.has(sessionId)) {
			this.update(sessionId, latencyMs);
			return;
		}

		const row = new Grid(`row-${sessionId}`);
		row.height = `${ROW_HEIGHT_PX}px`;
		row.width = 1;
		// dot | name | value
		row.addColumnDefinition(18, true);
		row.addColumnDefinition(1);
		row.addColumnDefinition(64, true);

		const dot = makeRect(`dot-${sessionId}`, {
			width: `${DOT_SIZE_PX}px`,
			height: `${DOT_SIZE_PX}px`,
			cornerRadius: DOT_SIZE_PX,
			background: COLOR_UNKNOWN,
			align: Control.HORIZONTAL_ALIGNMENT_LEFT,
			vAlign: Control.VERTICAL_ALIGNMENT_CENTER,
		});
		row.addControl(dot, 0, 0);

		const label =
			sessionId === this.localSessionId
				? `${this.shortId(sessionId)} (you)`
				: this.shortId(sessionId);
		const name = makeText(`name-${sessionId}`, label, {
			color: COLOR_TEXT_PRIMARY,
			font: FONT_PRIMARY,
			size: 13,
			align: Control.HORIZONTAL_ALIGNMENT_LEFT,
			paddingLeft: '2px',
		});
		row.addControl(name, 0, 1);

		const value = makeText(`value-${sessionId}`, '--', {
			color: COLOR_TEXT_MUTED,
			font: FONT_MONO,
			size: 12,
			align: Control.HORIZONTAL_ALIGNMENT_RIGHT,
		});
		row.addControl(value, 0, 2);

		this.list.addControl(row);
		this.rows.set(sessionId, { root: row, dot, name, value });
		this.update(sessionId, latencyMs);
	}

	update(sessionId: string, latencyMs: number): void {
		const row = this.rows.get(sessionId);
		if (row === undefined) {
			return;
		}
		if (latencyMs <= 0) {
			row.value.text = '--';
			row.value.color = COLOR_TEXT_MUTED;
			row.dot.background = COLOR_UNKNOWN;
			return;
		}

		const rounded = Math.round(latencyMs);
		const color = this.colorForLatency(rounded);
		row.value.text = `${rounded} ms`;
		row.value.color = color;
		row.dot.background = color;
	}

	remove(sessionId: string): void {
		const row = this.rows.get(sessionId);
		if (row === undefined) {
			return;
		}
		this.list.removeControl(row.root);
		row.root.dispose();
		this.rows.delete(sessionId);
	}

	setServerTick(tick: number): void {
		this.footerTick.text = this.formatTick(tick);
	}

	/** Observed server tick rate. Colored against the configured target. */
	setServerTps(tps: number): void {
		this.footerTps.text = `${tps.toFixed(1)} Hz`;
	}

	/** Client-side render FPS (Babylon smoothed). */
	setClientFps(fps: number): void {
		this.footerFps.text = `${fps.toFixed(0)} Hz`;
	}

	private setVisible(visible: boolean): void {
		this.targetAlpha = visible ? 1 : 0;
		if (visible) {
			this.root.isVisible = true;
		}
	}

	toggle(): boolean {
		const next = this.targetAlpha < 0.5;
		this.setVisible(next);
		return next;
	}

	dispose(): void {
		if (this.renderObserver !== null) {
			this.scene.onBeforeRenderObservable.remove(this.renderObserver);
			this.renderObserver = null;
		}
		for (const row of this.rows.values()) {
			row.root.dispose();
		}
		this.rows.clear();
		this.ui.dispose();
	}

	private tickFade(): void {
		if (Math.abs(this.currentAlpha - this.targetAlpha) < 0.005) {
			if (this.currentAlpha !== this.targetAlpha) {
				this.currentAlpha = this.targetAlpha;
				this.root.alpha = this.currentAlpha;
				if (this.currentAlpha === 0) {
					this.root.isVisible = false;
				}
			}
			return;
		}
		this.currentAlpha += (this.targetAlpha - this.currentAlpha) * FADE_LERP;
		this.root.alpha = this.currentAlpha;
	}

	private buildHeader(): StackPanel {
		const panel = new StackPanel('latencyHeader');
		panel.isVertical = true;
		panel.width = 1;
		panel.adaptHeightToChildren = true;

		const titleRow = new Grid('latencyHeaderRow');
		titleRow.height = `${HEADER_HEIGHT_PX}px`;
		titleRow.width = 1;
		titleRow.addColumnDefinition(10, true);
		titleRow.addColumnDefinition(1);

		const accent = makeRect('headerAccent', {
			width: '3px',
			height: '14px',
			cornerRadius: 2,
			background: COLOR_ACCENT,
			align: Control.HORIZONTAL_ALIGNMENT_LEFT,
			vAlign: Control.VERTICAL_ALIGNMENT_CENTER,
		});
		titleRow.addControl(accent, 0, 0);

		const title = makeText('headerTitle', 'NETWORK', {
			color: COLOR_TEXT_PRIMARY,
			font: FONT_PRIMARY,
			size: 11,
			weight: '600',
			align: Control.HORIZONTAL_ALIGNMENT_LEFT,
			paddingLeft: '6px',
		});
		titleRow.addControl(title, 0, 1);

		panel.addControl(titleRow);
		return panel;
	}

	private buildFooter(): {
		root: StackPanel;
		tick: TextBlock;
		tps: TextBlock;
		fps: TextBlock;
	} {
		const panel = new StackPanel('latencyFooter');
		panel.isVertical = true;
		panel.width = 1;
		panel.adaptHeightToChildren = true;

		const tick = this.buildFooterRow('TICK', 'SERVER TICK', '--');
		const tps = this.buildFooterRow('TPS', 'SERVER TPS', '--');
		const fps = this.buildFooterRow('FPS', 'CLIENT FPS', '--');

		panel.addControl(tick.root);
		panel.addControl(tps.root);
		panel.addControl(fps.root);

		return {
			root: panel,
			tick: tick.value,
			tps: tps.value,
			fps: fps.value,
		};
	}

	private buildFooterRow(
		id: string,
		labelText: string,
		initialValue: string,
	): { root: Grid; value: TextBlock } {
		const row = new Grid(`footer-${id}`);
		row.height = `${FOOTER_HEIGHT_PX}px`;
		row.width = 1;
		row.addColumnDefinition(0.55);
		row.addColumnDefinition(0.45);

		const label = makeText(`footer-${id}-label`, labelText, {
			color: COLOR_TEXT_MUTED,
			font: FONT_PRIMARY,
			size: 10,
			weight: '600',
			align: Control.HORIZONTAL_ALIGNMENT_LEFT,
		});
		row.addControl(label, 0, 0);

		const value = makeText(`footer-${id}-value`, initialValue, {
			color: COLOR_ACCENT,
			font: FONT_MONO,
			size: 13,
			weight: '600',
			align: Control.HORIZONTAL_ALIGNMENT_RIGHT,
		});
		row.addControl(value, 0, 1);

		return { root: row, value };
	}

	private buildDivider(): Rectangle {
		return makeRect('latencyDivider', {
			width: 1,
			height: `${DIVIDER_HEIGHT_PX}px`,
			background: COLOR_DIVIDER,
		});
	}

	private buildSpacer(heightPx: number): Rectangle {
		return makeRect(`spacer-${heightPx}`, {
			width: 1,
			height: `${heightPx}px`,
			background: 'transparent',
		});
	}

	private colorForLatency(latencyMs: number): string {
		if (latencyMs < LATENCY_GOOD_MS) {
			return COLOR_GOOD;
		}
		if (latencyMs < LATENCY_OK_MS) {
			return COLOR_OK;
		}
		return COLOR_BAD;
	}

	/**
	 * Colyseus session ids are 9 chars — short enough to display raw, but a
	 * fixed monospaced 7-char truncation keeps rows visually aligned.
	 */
	private shortId(id: string): string {
		return id.length > 7 ? `${id.slice(0, 7)}…` : id;
	}

	private formatTick(tick: number): string {
		// Thousands separators read better at high values; locale-independent.
		return Math.floor(tick)
			.toString()
			.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
	}
}
