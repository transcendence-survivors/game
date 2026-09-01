import type { Scene } from '@babylonjs/core';
import * as GUI from '@babylonjs/gui';
import { createFullscreenUi } from '../assets/ui';
import type { Room } from '@colyseus/sdk';
import {
	ClientMessage,
	RARITY_CONFIG,
	ServerMessage,
	UPGRADE_CHOICE_COUNT,
	type UpgradeOption,
} from '@transcendence/game-shared';
import { iconsImport } from '../assets/icons';
import { CleanupBag } from '../CleanupBag';
import { HUD_THEME, hudText, styleHudPanel } from '../hud/HudTheme';

interface UpgradeCardControls {
	panel: GUI.Rectangle;
	accent: GUI.Rectangle;
	iconFrame: GUI.Ellipse;
	icon: GUI.Image;
	title: GUI.TextBlock;
	level: GUI.TextBlock;
	description: GUI.TextBlock;
	separator: GUI.Rectangle;
	rarityBadge: GUI.Rectangle;
	rarityText: GUI.TextBlock;
	accentColor: string;
}

const LEVEL_UP_SCALE = 0.75;
const RARITY_COLORS: Readonly<Record<UpgradeOption['rarity'], string>> = {
	common: '#B8C4C0FF',
	uncommon: '#58D68DFF',
	rare: '#4DA8FFFF',
	epic: '#C56CFFFF',
	legendary: HUD_THEME.goldBright,
};
function splitCardTitle(name: string): { title: string; level: string } {
	const levelledName = /^(.*?) · Niv\. (\d+)$/.exec(name);
	if (!levelledName) return { title: name, level: '' };
	return {
		title: levelledName[1],
		level: `NIVEAU ${levelledName[2]}`,
	};
}

export class LevelUpMenu {
	private advTex!: GUI.AdvancedDynamicTexture;
	private levelUpRootContainer!: GUI.Rectangle;
	private currentOptions: readonly UpgradeOption[] = [];
	private pendingLevels = 0;
	private awaitingOptions = false;
	private readonly room: Room;
	private cards: UpgradeCardControls[] = [];
	private readonly subscriptions = new CleanupBag();
	private disposed = false;

	constructor(scene: Scene, room: Room) {
		this.room = room;
		this.init(scene);
	}

	private init(scene: Scene): void {
		this.advTex = createFullscreenUi('LevelUpUi', scene);
		this.advTex.useInvalidateRectOptimization = true;
		this.levelUpRootContainer = new GUI.Rectangle('LevelUpRoot');
		this.levelUpRootContainer.width = 1;
		this.levelUpRootContainer.height = 1;
		this.levelUpRootContainer.thickness = 0;
		this.levelUpRootContainer.background = '#00000000';
		this.levelUpRootContainer.isPointerBlocker = false;
		this.levelUpRootContainer.isVisible = false;
		this.levelUpRootContainer.zIndex = 100;
		this.advTex.rootContainer.addControl(this.levelUpRootContainer);

		const heading = hudText(
			'LevelUpHeading',
			'CHOISISSEZ UNE AMÉLIORATION',
			30,
			HUD_THEME.goldBright,
		);
		heading.fontWeight = 'bold';
		heading.height = '44px';
		heading.top = '-382px';
		heading.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
		heading.scaleX = LEVEL_UP_SCALE;
		heading.scaleY = LEVEL_UP_SCALE;
		this.levelUpRootContainer.addControl(heading);

		const subtitle = hudText(
			'LevelUpSubtitle',
			'Appuyez sur 1, 2 ou 3 — ou cliquez sur une carte',
			16,
			'#D5DDD8FF',
		);
		subtitle.outlineWidth = 2;
		subtitle.height = '25px';
		subtitle.top = '-340px';
		subtitle.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
		subtitle.scaleX = LEVEL_UP_SCALE;
		subtitle.scaleY = LEVEL_UP_SCALE;
		this.levelUpRootContainer.addControl(subtitle);

		const cardRow = new GUI.StackPanel('UpgradeCardRow');
		cardRow.isVertical = false;
		cardRow.spacing = 18;
		cardRow.width = '882px';
		cardRow.height = '298px';
		cardRow.top = '-73px';
		cardRow.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
		cardRow.scaleX = LEVEL_UP_SCALE;
		cardRow.scaleY = LEVEL_UP_SCALE;
		this.levelUpRootContainer.addControl(cardRow);
		this.cards = Array.from({ length: UPGRADE_CHOICE_COUNT }, (_, index) =>
			this.createCard(cardRow, index),
		);
		this.linkControls();
	}

	private createCard(
		parent: GUI.StackPanel,
		index: number,
	): UpgradeCardControls {
		const panel = new GUI.Rectangle(`UpgradeCard${index}`);
		panel.width = '282px';
		panel.height = '280px';
		panel.paddingLeft = '3px';
		panel.paddingRight = '3px';
		styleHudPanel(panel, HUD_THEME.gold);
		panel.background = HUD_THEME.panelSoft;
		panel.shadowColor = '#00000000';
		panel.shadowBlur = 0;
		panel.shadowOffsetY = 0;
		panel.isPointerBlocker = true;
		parent.addControl(panel);

		const accent = new GUI.Rectangle(`UpgradeCard${index}Accent`);
		accent.width = 1;
		accent.height = '6px';
		accent.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
		accent.background = HUD_THEME.gold;
		accent.thickness = 0;
		accent.isHitTestVisible = false;
		panel.addControl(accent);

		const rarityBadge = new GUI.Rectangle(`UpgradeCard${index}RarityBadge`);
		rarityBadge.width = '136px';
		rarityBadge.height = '30px';
		rarityBadge.left = '-13px';
		rarityBadge.top = '17px';
		rarityBadge.horizontalAlignment =
			GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
		rarityBadge.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
		rarityBadge.background = '#0B1214F5';
		rarityBadge.color = HUD_THEME.gold;
		rarityBadge.thickness = 1;
		rarityBadge.cornerRadius = 6;
		rarityBadge.isHitTestVisible = false;
		panel.addControl(rarityBadge);
		const rarityText = hudText(
			`UpgradeCard${index}Rarity`,
			'COMMUN',
			12,
			HUD_THEME.gold,
		);
		rarityText.fontWeight = 'bold';
		rarityBadge.addControl(rarityText);

		const keyBadge = new GUI.Rectangle(`UpgradeCard${index}KeyBadge`);
		keyBadge.width = '40px';
		keyBadge.height = '32px';
		keyBadge.left = '14px';
		keyBadge.top = '15px';
		keyBadge.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
		keyBadge.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
		keyBadge.background = '#2B271DFF';
		keyBadge.color = HUD_THEME.gold;
		keyBadge.thickness = 1;
		keyBadge.cornerRadius = 7;
		keyBadge.isHitTestVisible = false;
		panel.addControl(keyBadge);
		const keyText = hudText(
			`UpgradeCard${index}Key`,
			String(index + 1),
			17,
			HUD_THEME.goldBright,
		);
		keyText.fontWeight = 'bold';
		keyBadge.addControl(keyText);

		const iconFrame = new GUI.Ellipse(`UpgradeCard${index}IconFrame`);
		iconFrame.width = '78px';
		iconFrame.height = '78px';
		iconFrame.top = '54px';
		iconFrame.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
		iconFrame.background = '#0B1417D9';
		iconFrame.color = HUD_THEME.gold;
		iconFrame.thickness = 2;
		iconFrame.shadowColor = HUD_THEME.shadow;
		iconFrame.shadowBlur = 12;
		iconFrame.isHitTestVisible = false;
		panel.addControl(iconFrame);

		const icon = new GUI.Image(`UpgradeCard${index}Icon`);
		icon.width = '60px';
		icon.height = '60px';
		icon.stretch = GUI.Image.STRETCH_UNIFORM;
		icon.isHitTestVisible = false;
		iconFrame.addControl(icon);

		const title = hudText(
			`UpgradeCard${index}Title`,
			'AMÉLIORATION',
			20,
			HUD_THEME.text,
		);
		title.fontWeight = 'bold';
		title.width = '246px';
		title.height = '30px';
		title.top = '141px';
		title.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
		title.textWrapping = false;
		panel.addControl(title);

		const level = hudText(
			`UpgradeCard${index}Level`,
			'NIVEAU 1',
			14,
			HUD_THEME.goldBright,
		);
		level.fontWeight = 'bold';
		level.width = '246px';
		level.height = '24px';
		level.top = '169px';
		level.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
		panel.addControl(level);

		const separator = new GUI.Rectangle(`UpgradeCard${index}Separator`);
		separator.width = '206px';
		separator.height = '1px';
		separator.top = '198px';
		separator.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
		separator.background = HUD_THEME.border;
		separator.thickness = 0;
		separator.alpha = 0.32;
		separator.isHitTestVisible = false;
		panel.addControl(separator);

		const description = hudText(
			`UpgradeCard${index}Description`,
			'',
			14,
			HUD_THEME.muted,
		);
		description.width = '244px';
		description.height = '52px';
		description.top = '207px';
		description.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
		description.textWrapping = true;
		panel.addControl(description);

		return {
			panel,
			accent,
			iconFrame,
			icon,
			title,
			level,
			description,
			separator,
			rarityBadge,
			rarityText,
			accentColor: HUD_THEME.gold,
		};
	}

	dispose(): void {
		if (this.disposed) return;
		this.disposed = true;
		this.subscriptions.dispose();
		this.advTex.dispose();
	}

	private updateCards(options: readonly UpgradeOption[]): void {
		this.cards.forEach((card, index) => {
			const {
				panel,
				accent,
				iconFrame,
				icon,
				title,
				level,
				description,
				separator,
				rarityBadge,
				rarityText,
			} = card;
			const option = options[index];
			panel.isVisible = Boolean(option);
			if (!option) return;
			icon.source = iconsImport[option.iconUrl];
			const cardTitle = splitCardTitle(option.name);
			title.text = cardTitle.title;
			title.top = cardTitle.level ? '141px' : '153px';
			level.text = cardTitle.level;
			level.isVisible = Boolean(cardTitle.level);
			description.text =
				option.category === 'unlock'
					? 'Ajoutée à votre arsenal'
					: option.description;
			const color =
				option.category === 'unlock'
					? HUD_THEME.goldBright
					: RARITY_COLORS[option.rarity];
			card.accentColor = color;
			panel.color = color;
			accent.background = color;
			iconFrame.color = color;
			iconFrame.shadowColor = `${color.slice(0, 7)}66`;
			separator.background = color;
			rarityBadge.color = color;
			rarityText.color = color;
			rarityText.text =
				option.category === 'unlock'
					? 'NOUVELLE ARME'
					: `${option.category === 'tome' ? 'TOME' : 'ARME'} · ${RARITY_CONFIG[option.rarity].label.toUpperCase()}`;
		});
	}

	private requestNextOptions(): void {
		if (this.pendingLevels <= 0) {
			this.levelUpRootContainer.isVisible = false;
			return;
		}
		if (this.awaitingOptions) return;
		this.awaitingOptions = true;
		this.room.send(ClientMessage.RequestUpgradeOptions);
	}

	private linkControls(): void {
		this.cards.forEach((card, index) => {
			const { panel } = card;
			const clickObserver = panel.onPointerClickObservable.add(() =>
				this.selectUpgrade(index),
			);
			const enterObserver = panel.onPointerEnterObservable.add(() => {
				panel.background = HUD_THEME.panelHover;
				panel.color = HUD_THEME.goldBright;
				panel.scaleX = 1.025;
				panel.scaleY = 1.025;
			});
			const outObserver = panel.onPointerOutObservable.add(() => {
				panel.background = HUD_THEME.panelSoft;
				panel.color = card.accentColor;
				panel.scaleX = 1;
				panel.scaleY = 1;
			});
			this.subscriptions.add(() => {
				panel.onPointerClickObservable.remove(clickObserver);
				panel.onPointerEnterObservable.remove(enterObserver);
				panel.onPointerOutObservable.remove(outObserver);
			});
		});
		const keyDownHandler = (e: KeyboardEvent) => {
			if (!this.levelUpRootContainer.isVisible) return;
			const selectionIndex = Number(e.key) - 1;
			if (
				Number.isInteger(selectionIndex) &&
				selectionIndex >= 0 &&
				selectionIndex < UPGRADE_CHOICE_COUNT
			)
				this.selectUpgrade(selectionIndex);
		};
		window.addEventListener('keydown', keyDownHandler);
		this.subscriptions.add(() =>
			window.removeEventListener('keydown', keyDownHandler),
		);
		this.subscriptions.add(
			this.room.onMessage(ServerMessage.LevelUp, () => this.onLevelUp()),
		);
		this.subscriptions.add(
			this.room.onMessage(
				ServerMessage.UpgradeOptions,
				(options: readonly UpgradeOption[]) => {
					this.awaitingOptions = false;
					this.currentOptions = options;
					if (options.length === 0) {
						this.pendingLevels = 0;
						this.levelUpRootContainer.isVisible = false;
						return;
					}
					this.updateCards(options);
					this.levelUpRootContainer.isVisible = true;
				},
			),
		);
	}

	private onLevelUp(): void {
		this.pendingLevels++;
		if (!this.levelUpRootContainer.isVisible) this.requestNextOptions();
	}

	private selectUpgrade(index: number): void {
		if (!this.levelUpRootContainer.isVisible) return;

		const chosen = this.currentOptions[index];
		if (!chosen) return;

		this.room.send(ClientMessage.SelectUpgrade, { id: chosen.id });

		this.pendingLevels--;
		this.levelUpRootContainer.isVisible = false;
		this.requestNextOptions();
	}
}
