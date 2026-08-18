export const KEY_ACTIONS = [
	'forward',
	'backward',
	'right',
	'left',
	'jump',
] as const;

export type KeyBindings = Record<(typeof KEY_ACTIONS)[number], string>;

export const DEFAULT_KEY_BINDINGS: Readonly<KeyBindings> = {
	forward: 'w',
	backward: 's',
	left: 'a',
	right: 'd',
	jump: ' ',
};
