export const guiImports = {
	lobby: new URL('./lobby_ui.json', import.meta.url).href,
	main: new URL('./main_menu.json', import.meta.url).href,
	settings: new URL('./settings_menu.json', import.meta.url).href,
	hud: new URL('./hud.json', import.meta.url).href,
	levelup: new URL('./levelup_ui.json', import.meta.url).href,
	endingScreen: new URL('./ending_screen.json', import.meta.url).href,
	waitingScreen: new URL('./waiting_room_ui.json', import.meta.url).href,
} as const;
