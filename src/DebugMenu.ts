import * as GUI from '@babylonjs/gui';
import * as BABYLON from '@babylonjs/core';

interface DebugStats {
	position: GUI.TextBlock;
	rotation: GUI.TextBlock;
	fps: GUI.TextBlock;
	// health: GUI.TextBlock;
}

export class DebugMenu {
	private debugStats!: DebugStats;
	private engine!: BABYLON.Engine;
	constructor(engine: BABYLON.Engine) {
		this.engine = engine;
		this.initGUI();
	}

	initGUI() {
		const ui = GUI.AdvancedDynamicTexture.CreateFullscreenUI('UI');
		const debugMenu = new GUI.Rectangle('debugMenu');

		debugMenu.width = '400px';
		debugMenu.height = '600px';
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
			// health: addStatLine('Health:'),
		};
	}

	updateDebugMenu(player: BABYLON.AbstractMesh) {
		const pos = player.position;
		this.debugStats.position.text = `X:${pos.x.toFixed(2)}, Y:${pos.y.toFixed(2)}, Z:${pos.z.toFixed(2)}`;

		const rot = BABYLON.NormalizeRadians(player.rotation.y);
		this.debugStats.rotation.text = `${BABYLON.Tools.ToDegrees(rot).toFixed(1)}°`;

		this.debugStats.fps.text = this.engine.getFps().toFixed(0);
	}
}
