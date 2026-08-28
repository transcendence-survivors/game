import * as GUI from '@babylonjs/gui';

export const HUD_THEME = {
	font: 'Trebuchet MS, Segoe UI, Arial, sans-serif',
	panel: '#111A1CEB',
	panelSoft: '#172326E8',
	panelHover: '#243438F2',
	border: '#6D7B75CC',
	gold: '#E7B84FFF',
	goldBright: '#FFD978FF',
	text: '#F4F2E9FF',
	muted: '#AAB6B0FF',
	empty: '#6F7D78FF',
	emptyBorder: '#52615C99',
	allyOnline: '#B8FFF3FF',
	allyDown: '#FFAAA4FF',
	barBorder: '#80908A99',
	barHighlight: '#FFFFFF2A',
	health: '#E55252FF',
	healthDark: '#421D20FF',
	xp: '#41C7B4FF',
	xpDark: '#173E3BFF',
	boss: '#FF665CFF',
	bossDark: '#481D20FF',
	shadow: '#000000AA',
} as const;

export function styleHudPanel(
	panel: GUI.Rectangle,
	accent: string = HUD_THEME.border,
): void {
	panel.background = HUD_THEME.panel;
	panel.color = accent;
	panel.thickness = 2;
	panel.cornerRadius = 10;
	panel.shadowColor = HUD_THEME.shadow;
	panel.shadowBlur = 12;
	panel.shadowOffsetY = 4;
	panel.isPointerBlocker = false;
}

export function hudText(
	name: string,
	text: string,
	fontSize: number,
	color: string = HUD_THEME.text,
): GUI.TextBlock {
	const control = new GUI.TextBlock(name, text);
	control.fontFamily = HUD_THEME.font;
	control.fontSize = `${fontSize}px`;
	control.color = color;
	control.isHitTestVisible = false;
	control.outlineColor = '#00000099';
	control.outlineWidth = 1;
	return control;
}
