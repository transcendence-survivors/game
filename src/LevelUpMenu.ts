import type { Scene } from '@babylonjs/core';
import * as GUI from '@babylonjs/gui';
import { guiImports } from './assets/ui';
import type { Room } from '@colyseus/sdk';
import type { UpgradeOption } from '../../shared-package/src/utils/Types';
import { iconsImport } from './assets/icons';

export class LevelUpMenu {
	private scene: Scene;
	private advTex!: GUI.AdvancedDynamicTexture;
	public readonly ready: Promise<void>;
	private levelUpRootContainer!: GUI.Rectangle;
	private currentOptions: UpgradeOption[] = [];
	private levelUpQueue: number = 0;
	private keyDownHandler!: (e: KeyboardEvent) => void;
	private room: Room;
	private levelUpMessageHandler!: () => void;
	private upgradeOptionsMessageHandler!: (options: UpgradeOption[]) => void;

	constructor(scene: Scene, room: Room) {
		this.scene = scene;
		this.room = room;
		this.ready = this.init();
	}

	private async init() {
		this.advTex = GUI.AdvancedDynamicTexture.CreateFullscreenUI(
			'LevelUpUi',
			true,
			this.scene,
		);
		await this.advTex.parseFromURLAsync(guiImports.levelup);
		this.advTex.idealWidth = 1920;
		this.advTex.idealHeight = 1080;
		this.advTex.renderAtIdealSize = true;
		this.levelUpRootContainer = this.advTex.rootContainer as GUI.Rectangle;
		this.levelUpRootContainer.isVisible = false;
		this.linkControls();
	}

	dispose() {
		window.removeEventListener('keydown', this.keyDownHandler);
		this.advTex.dispose();
	}

	open() {
		this.levelUpRootContainer.isVisible = true;
	}

	close() {
		this.levelUpRootContainer.isVisible = false;
	}

	private createCards(options: UpgradeOption[]) {
		for (let i = 0; i < 3; i++) {
			const icon = this.advTex.getControlByName(
				`card_${i}_icon`,
			) as GUI.Image;

			icon.stretch = GUI.Image.STRETCH_UNIFORM;
			const title = this.advTex.getControlByName(
				`card_${i}_title`,
			) as GUI.TextBlock;

			const description = this.advTex.getControlByName(
				`card_${i}_desc`,
			) as GUI.TextBlock;

			switch (options[i].iconUrl) {
				case 'armor':
					icon.source = iconsImport.armor;
					break;

				case 'moveSpeed':
					icon.source = iconsImport.moveSpeed;
					break;

				case 'damage':
					icon.source = iconsImport.damage;
					break;

				case 'attackSpeed':
					icon.source = iconsImport.attackSpeed;
					break;

				case 'lifesteal':
					icon.source = iconsImport.lifesteal;
					break;

				case 'maxHealth':
					icon.source = iconsImport.maxHealth;
					break;

				case 'range':
					icon.source = iconsImport.range;
					break;
				default:
					console.warn('No icon mapped for', options[i].iconUrl);
					break;
			}
			title.text = options[i].name;
			description.text = options[i].description;
		}
	}

	private async showNextLevelUp() {
		if (this.levelUpQueue <= 0) {
			this.levelUpRootContainer.isVisible = false;
			return;
		}
		this.room.send('requestUpgradeOptions');
	}

	private linkControls() {
		this.keyDownHandler = (e: KeyboardEvent) => {
			if (!this.levelUpRootContainer.isVisible) return;
			if (e.key === '1') this.selectUpgrade(0);
			else if (e.key === '2') this.selectUpgrade(1);
			else if (e.key === '3') this.selectUpgrade(2);
		};
		window.addEventListener('keydown', this.keyDownHandler);

		this.levelUpMessageHandler = () => {
			this.onLevelUp();
		};
		this.room.onMessage('levelUp', this.levelUpMessageHandler);

		this.upgradeOptionsMessageHandler = (options: UpgradeOption[]) => {
			this.currentOptions = options;
			this.createCards(options);
			this.levelUpRootContainer.isVisible = true;
		};
		this.room.onMessage(
			'upgradeOptions',
			this.upgradeOptionsMessageHandler,
		);
	}

	private onLevelUp() {
		this.levelUpQueue++;
		if (!this.levelUpRootContainer.isVisible) {
			this.showNextLevelUp();
		}
	}
	private selectUpgrade(index: number) {
		if (!this.levelUpRootContainer.isVisible) return;

		const chosen = this.currentOptions[index];
		if (!chosen) return;

		this.room.send('selectUpgrade', { id: chosen.id });

		this.levelUpQueue--;
		this.levelUpRootContainer.isVisible = false;
		this.showNextLevelUp();
	}
}
