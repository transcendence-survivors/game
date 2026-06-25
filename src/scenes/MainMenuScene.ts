import {
	Scene,
	Engine,
	FreeCamera,
	Vector3,
	Color4,
	HemisphericLight,
	Color3,
} from '@babylonjs/core';
import {
	AdvancedDynamicTexture,
	Rectangle,
	TextBlock,
	Button,
	Control,
	StackPanel,
} from '@babylonjs/gui';

const styleSettings = {
	background: new Color4(0.07, 0.06, 0.055, 1),
	primary: '#E5A832',
	primaryDark: '#1F160A',
	foreground: '#F0EDE6',
	mutedForeground: '#A8A49C',
	border: '#312E28',
	card: '#131110',
	fontSans: 'Manrope, ui-sans-serif, system-ui, sans-serif',
	fontMono: 'JetBrains Mono, ui-monospace, monospace',
};

export type MenuAction = 'play' | 'settings' | 'quit';

type MenuButton = {
	label: string;
	action: MenuAction;
};

const MENU_BUTTONS: MenuButton[] = [
	{ label: 'Play', action: 'play' },
	{ label: 'Settings', action: 'settings' },
];

export class MainMenuScene {
	private scene: Scene;
	private ui: AdvancedDynamicTexture;
	private onAction: (action: MenuAction) => void;

	constructor(engine: Engine, onAction: (action: MenuAction) => void) {
		this.onAction = onAction;
		this.scene = this._buildScene(engine);
		this.ui = AdvancedDynamicTexture.CreateFullscreenUI(
			'MainMenuUI',
			true,
			this.scene,
		);
		this._buildMenu();
	}

	render() {
		this.scene.render();
	}

	dispose() {
		this.ui.dispose();
		this.scene.dispose();
	}

	private _buildScene(engine: Engine): Scene {
		const scene = new Scene(engine);
		scene.clearColor = styleSettings.background;
		const camera = new FreeCamera('menuCam', new Vector3(0, 0, -5), scene);
		camera.setTarget(Vector3.Zero());

		const light = new HemisphericLight(
			'ambientLight',
			new Vector3(0, 1, 0),
			scene,
		);
		light.intensity = 0.6;
		light.diffuse = Color3.FromHexString('#E5A832');
		light.groundColor = Color3.FromHexString('#131110');

		return scene;
	}

	private _buildMenu() {
		const overlay = new Rectangle('overlay');
		overlay.width = '100%';
		overlay.height = '100%';
		overlay.background = 'rgba(19, 17, 16, 0.88)';
		overlay.thickness = 0;
		this.ui.addControl(overlay);

		const accentBar = new Rectangle('accentBar');
		accentBar.width = '340px';
		accentBar.height = '2px';
		accentBar.background = styleSettings.primary;
		accentBar.thickness = 0;
		accentBar.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
		accentBar.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
		accentBar.left = '40px';
		accentBar.top = '4%';
		this.ui.addControl(accentBar);

		const card = new Rectangle('menuCard');
		card.adaptHeightToChildren = true;
		card.background = styleSettings.card;
		card.cornerRadius = 4;
		card.thickness = 1;
		card.color = styleSettings.border;
		card.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
		card.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
		card.left = '40px';
		card.width = '380px';
		card.height = '92%';
		card.paddingTop = '48px';
		card.paddingBottom = '48px';
		this.ui.addControl(card);

		const stack = new StackPanel('menuStack');
		stack.spacing = 12;
		stack.paddingLeft = '28px';
		stack.paddingRight = '28px';
		stack.width = '100%';
		card.addControl(stack);

		const title = new TextBlock('title', 'SUUUUUUU');
		title.color = styleSettings.primary;
		title.fontSize = '28px';
		title.height = '42px';
		title.fontFamily = styleSettings.fontSans;
		title.fontWeight = '700';
		title.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
		title.paddingBottom = '4px';
		stack.addControl(title);

		const sub = new TextBlock('subtitle', 'Main Menu');
		sub.color = styleSettings.mutedForeground;
		sub.fontSize = '12px';
		sub.fontFamily = styleSettings.fontSans;
		sub.fontWeight = '400';
		sub.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
		sub.height = '18px';
		sub.paddingBottom = '20px';
		stack.addControl(sub);

		const divider = new Rectangle('divider');
		divider.height = '1px';
		divider.background = styleSettings.border;
		divider.thickness = 0;
		divider.paddingBottom = '8px';
		stack.addControl(divider);

		for (const { label, action } of MENU_BUTTONS) {
			stack.addControl(this._makeButton(label, action));
		}
	}

	private _makeButton(label: string, action: MenuAction): Button {
		const isPrimary = action === 'play';

		const btn = new Button(`btn_${action}`);
		btn.width = '100%';
		btn.height = '48px';
		btn.cornerRadius = 4;
		btn.thickness = isPrimary ? 0 : 1;
		btn.background = isPrimary ? styleSettings.primary : 'transparent';
		btn.color = styleSettings.border;

		const text = new TextBlock(`btn_${action}_text`, label);
		text.color = isPrimary
			? styleSettings.primaryDark
			: styleSettings.foreground;
		text.fontSize = '14px';
		text.fontFamily = styleSettings.fontSans;
		text.fontWeight = '600';
		text.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
		text.paddingLeft = '16px';
		btn.addControl(text);

		btn.onPointerEnterObservable.add(() => {
			btn.background = isPrimary ? '#D4982A' : 'rgba(229, 168, 50, 0.08)';
		});
		btn.onPointerOutObservable.add(() => {
			btn.background = isPrimary ? styleSettings.primary : 'transparent';
		});
		btn.onPointerUpObservable.add(() => this.onAction(action));

		return btn;
	}
}
