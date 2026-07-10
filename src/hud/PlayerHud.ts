import * as GUI from '@babylonjs/gui';
import * as COLYSEUS from '@colyseus/sdk';
import type { GameState, Player } from '../../../shared-package';

const BAR_WIDTH_PX = 360;
const BAR_HEIGHT_PX = 26;
const HEALTHY_COLOR = '#4caf50';
const WOUNDED_COLOR = '#ff9800';
const CRITICAL_COLOR = '#f44336';
// 10 Hz: repainting the fullscreen GUI texture is costly and health does
// not need more; same trade-off as the DebugMenu.
const UPDATE_INTERVAL_MS = 100;

/**
 * On-screen HUD showing the server-authoritative health of the local
 * player. It reads the synced state directly every update instead of
 * relying on nested-schema change callbacks.
 */
export class PlayerHud {
	private room!: COLYSEUS.Room<GameState>;
	private ui!: GUI.AdvancedDynamicTexture;
	private fill!: GUI.Rectangle;
	private label!: GUI.TextBlock;
	private lastUpdateMs = 0;
	private lastCurrent = -1;
	private lastMax = -1;

	constructor(room: COLYSEUS.Room<GameState>) {
		this.room = room;
		this.createBar();
	}

	/** Call every frame; repaints at most every UPDATE_INTERVAL_MS. */
	update() {
		const now = performance.now();
		if (now - this.lastUpdateMs < UPDATE_INTERVAL_MS) return;
		this.lastUpdateMs = now;
		const player = this.room.state.players.get(this.room.sessionId);
		if (!player) return;
		if (
			player.life.current === this.lastCurrent &&
			player.life.max === this.lastMax
		) {
			return;
		}
		this.lastCurrent = player.life.current;
		this.lastMax = player.life.max;
		this.refresh(player);
	}

	private createBar() {
		this.ui = GUI.AdvancedDynamicTexture.CreateFullscreenUI('HUD');
		this.ui.renderAtIdealSize = true;
		this.ui.idealWidth = 1920;
		this.ui.idealHeight = 1080;

		const frame = new GUI.Rectangle('healthBar');
		frame.width = `${BAR_WIDTH_PX}px`;
		frame.height = `${BAR_HEIGHT_PX}px`;
		frame.cornerRadius = 6;
		frame.thickness = 1;
		frame.color = 'white';
		frame.background = 'rgba(20, 20, 20, 0.85)';
		frame.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
		frame.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
		frame.top = '-24px';
		this.ui.addControl(frame);

		this.fill = new GUI.Rectangle('healthFill');
		this.fill.height = '100%';
		this.fill.width = '100%';
		this.fill.cornerRadius = 6;
		this.fill.thickness = 0;
		this.fill.background = HEALTHY_COLOR;
		this.fill.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
		frame.addControl(this.fill);

		this.label = new GUI.TextBlock('healthLabel');
		this.label.color = 'white';
		this.label.fontSize = 16;
		this.label.outlineColor = 'black';
		this.label.outlineWidth = 2;
		frame.addControl(this.label);
	}

	// The client decodes the state through reflection: synced objects carry
	// the schema fields but none of the shared-class methods, so the ratio
	// and depletion are computed from raw fields here.
	private refresh(player: Player) {
		const { current, max } = player.life;
		const ratio = max > 0 ? Math.min(1, Math.max(0, current / max)) : 0;
		this.fill.width = `${Math.round(BAR_WIDTH_PX * ratio)}px`;
		this.fill.background =
			ratio > 0.5
				? HEALTHY_COLOR
				: ratio > 0.25
					? WOUNDED_COLOR
					: CRITICAL_COLOR;
		this.label.text =
			current <= 0 ? 'DEAD' : `${Math.ceil(current)} / ${max}`;
	}

	dispose() {
		this.ui.dispose();
	}
}
