import type { Scene } from '@babylonjs/core';
import * as GUI from '@babylonjs/gui';

export const guiImports = {
	lobby: new URL('./lobby_clean.json', import.meta.url).href,
	main: new URL('./main_menu.json', import.meta.url).href,
	settings: new URL('./settings_menu.json', import.meta.url).href,
} as const;

export function createFullscreenUi(
	name: string,
	scene?: Scene,
): GUI.AdvancedDynamicTexture {
	const ui = GUI.AdvancedDynamicTexture.CreateFullscreenUI(name, true, scene);
	// Fullscreen UI must be composited after camera post-processes. Otherwise
	// world effects such as the radial lighting fog also darken the HUD.
	const layer = ui.layer;
	if (layer) layer.applyPostProcess = false;
	ui.idealWidth = 1920;
	ui.idealHeight = 1080;
	ui.useSmallestIdeal = true;
	ui.renderAtIdealSize = true;
	return ui;
}

export function getGuiControls<T>(
	ui: GUI.AdvancedDynamicTexture,
	names: { [K in keyof T]: string },
): T {
	return Object.fromEntries(
		Object.entries(names as Record<string, string>).map(([key, name]) => {
			const control = ui.getControlByName(name);
			if (!control) throw new Error(`Missing GUI control: ${name}`);
			return [key, control];
		}),
	) as T;
}

export function getGuiControl<T extends GUI.Control>(
	ui: GUI.AdvancedDynamicTexture,
	name: string,
): T {
	return getGuiControls<{ control: T }>(ui, { control: name }).control;
}
