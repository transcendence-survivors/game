import * as GUI from '@babylonjs/gui';
import * as BABYLON from '@babylonjs/core';

interface DebugStats {
	position: GUI.TextBlock;
	rotation: GUI.TextBlock;
	fps: GUI.TextBlock;
	frameTime: GUI.TextBlock;
	drawCalls: GUI.TextBlock;
	resources: GUI.TextBlock;
}

export class DebugMenu {
	private static readonly UPDATE_INTERVAL_MS = 100;
	private debugStats!: DebugStats;
	private engine!: BABYLON.Engine;
	private lastUpdateMs = 0;
	private hitboxesVisible = false;
	private immortalEnabled = false;
	private readonly onHitboxesChanged: (visible: boolean) => void;
	private readonly onImmortalChanged: (enabled: boolean) => void;

	constructor(
		engine: BABYLON.Engine,
		onHitboxesChanged: (visible: boolean) => void = () => {},
		onImmortalChanged: (enabled: boolean) => void = () => {},
	) {
		this.engine = engine;
		this.onHitboxesChanged = onHitboxesChanged;
		this.onImmortalChanged = onImmortalChanged;
		this.initGUI();
	}

	initGUI() {
		const ui = GUI.AdvancedDynamicTexture.CreateFullscreenUI('UI');
		const debugMenu = new GUI.Rectangle('debugMenu');

		ui.renderAtIdealSize = true;
		ui.idealWidth = 1920;
		ui.idealHeight = 1080;
		debugMenu.width = '22%';
		debugMenu.height = '52%';
		debugMenu.cornerRadius = 10;
		debugMenu.thickness = 1;
		debugMenu.color = 'white';
		debugMenu.background = 'rgba(20, 20, 20, 0.85)';
		debugMenu.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
		debugMenu.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
		debugMenu.left = '-12px';
		debugMenu.top = '12px';
		ui.addControl(debugMenu);

		const panel = new GUI.StackPanel();
		panel.paddingTop = '10px';
		panel.paddingRight = '10px';
		panel.paddingLeft = '10px';
		panel.spacing = 0;
		debugMenu.addControl(panel);

		const title = new GUI.TextBlock();
		title.text = 'Debug Menu';
		title.height = '30px';
		title.color = 'white';
		title.fontSize = 22;
		title.textVerticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
		title.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
		panel.addControl(title);

		const addStatLine = (label: string) => {
			const row = new GUI.StackPanel();
			row.isVertical = false;
			row.height = '24px';
			row.paddingTop = '4px';

			const labelBlock = new GUI.TextBlock();
			labelBlock.text = label;
			labelBlock.color = '#aaaaaa';
			labelBlock.fontSize = 16;
			labelBlock.width = '120px';
			labelBlock.textHorizontalAlignment =
				GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
			row.addControl(labelBlock);

			const valueBlock = new GUI.TextBlock();
			valueBlock.text = '-';
			valueBlock.color = 'white';
			valueBlock.fontSize = 16;
			valueBlock.width = '250px';
			valueBlock.textHorizontalAlignment =
				GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
			row.addControl(valueBlock);

			panel.addControl(row);
			return valueBlock;
		};
		this.debugStats = {
			position: addStatLine('Position:'),
			rotation: addStatLine('Rotation:'),
			fps: addStatLine('FPS:'),
			frameTime: addStatLine('Frame:'),
			drawCalls: addStatLine('Draw calls:'),
			resources: addStatLine('Resources:'),
		};

		const hitboxRow = new GUI.StackPanel('hitboxToggleRow');
		hitboxRow.isVertical = false;
		hitboxRow.height = '34px';
		hitboxRow.paddingTop = '8px';

		const hitboxLabel = new GUI.TextBlock(
			'hitboxToggleLabel',
			'Hitboxes 3D',
		);
		hitboxLabel.color = '#ff8b72';
		hitboxLabel.fontSize = 16;
		hitboxLabel.width = '190px';
		hitboxLabel.textHorizontalAlignment =
			GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
		hitboxRow.addControl(hitboxLabel);

		const hitboxToggle = new GUI.Checkbox('hitboxToggle');
		hitboxToggle.width = '22px';
		hitboxToggle.height = '22px';
		hitboxToggle.color = '#ff5c5c';
		hitboxToggle.background = '#252525';
		hitboxToggle.isChecked = this.hitboxesVisible;
		hitboxToggle.onIsCheckedChangedObservable.add((visible) => {
			this.hitboxesVisible = visible;
			this.onHitboxesChanged(visible);
		});
		hitboxRow.addControl(hitboxToggle);
		panel.addControl(hitboxRow);

		const immortalRow = new GUI.StackPanel('immortalToggleRow');
		immortalRow.isVertical = false;
		immortalRow.height = '34px';
		immortalRow.paddingTop = '8px';

		const immortalLabel = new GUI.TextBlock(
			'immortalToggleLabel',
			'Mode immortel',
		);
		immortalLabel.color = '#ffd166';
		immortalLabel.fontSize = 16;
		immortalLabel.width = '190px';
		immortalLabel.textHorizontalAlignment =
			GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
		immortalRow.addControl(immortalLabel);

		const immortalToggle = new GUI.Checkbox('immortalToggle');
		immortalToggle.width = '22px';
		immortalToggle.height = '22px';
		immortalToggle.color = '#ffd166';
		immortalToggle.background = '#252525';
		immortalToggle.isChecked = this.immortalEnabled;
		immortalToggle.onIsCheckedChangedObservable.add((enabled) => {
			this.immortalEnabled = enabled;
			this.onImmortalChanged(enabled);
		});
		immortalRow.addControl(immortalToggle);
		panel.addControl(immortalRow);
	}

	areHitboxesVisible(): boolean {
		return this.hitboxesVisible;
	}

	updateDebugMenu(player: BABYLON.AbstractMesh) {
		const now = performance.now();
		if (now - this.lastUpdateMs < DebugMenu.UPDATE_INTERVAL_MS) return;
		this.lastUpdateMs = now;

		const pos = player.position;
		this.debugStats.position.text = `X:${pos.x.toFixed(2)}, Y:${pos.y.toFixed(2)}, Z:${pos.z.toFixed(2)}`;

		const rot = BABYLON.NormalizeRadians(player.rotation.y);
		this.debugStats.rotation.text = `${BABYLON.Tools.ToDegrees(rot).toFixed(1)}°`;

		this.debugStats.fps.text = this.engine.getFps().toFixed(0);
		this.debugStats.frameTime.text = `${(1000 / Math.max(1, this.engine.getFps())).toFixed(1)} ms`;
		const scene = player.getScene();
		const drawCalls = (
			this.engine as unknown as { _drawCalls?: { current: number } }
		)._drawCalls?.current;
		this.debugStats.drawCalls.text = String(drawCalls ?? 0);
		this.debugStats.resources.text = `${scene.meshes.length} meshes / ${scene.materials.length} materials`;
	}
}
