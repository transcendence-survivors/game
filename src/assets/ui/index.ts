export const guiImports = {
	lobby: new URL('./lobby_clean.json', import.meta.url).href,
	main: new URL('./main_menu.json', import.meta.url).href,
	settings: new URL('./settings_menu.json', import.meta.url).href,
} as const;
