import type { Scene } from '@babylonjs/core';
import * as GUI from '@babylonjs/gui';
import { guiImports } from './assets/ui';
import type { Room } from '@colyseus/sdk';
import {
	ClientMessage,
	ServerMessage,
	type UpgradeOption,
} from '../../shared-package';
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

			const title = this.advTex.getControlByName(
				`card_${i}_title`,
			) as GUI.TextBlock;

			const description = this.advTex.getControlByName(
				`card_${i}_desc`,
			) as GUI.TextBlock;

			const source = iconsImport[options[i].iconUrl as keyof typeof iconsImport];
			if (source) icon.source = source;
			else console.warn('No icon mapped for', options[i].iconUrl);
			title.text = options[i].name;
			description.text = options[i].description;
		}
	}

	private async showNextLevelUp() {
		if (this.levelUpQueue <= 0) {
			this.levelUpRootContainer.isVisible = false;
			return;
		}
		this.room.send(ClientMessage.RequestUpgradeOptions);
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
		this.room.onMessage(ServerMessage.LevelUp, this.levelUpMessageHandler);

		this.upgradeOptionsMessageHandler = (options: UpgradeOption[]) => {
			this.currentOptions = options;
			this.createCards(options);
			this.levelUpRootContainer.isVisible = true;
		};
		this.room.onMessage(
			ServerMessage.UpgradeOptions,
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

		this.room.send(ClientMessage.SelectUpgrade, { id: chosen.id });

		this.levelUpQueue--;
		this.levelUpRootContainer.isVisible = false;
		this.showNextLevelUp();
	}
}
