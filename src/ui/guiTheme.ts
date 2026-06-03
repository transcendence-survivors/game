/**
 * @file Babylon GUI theme + small control factories for the menu / lobby.
 *
 * Centralises the visual language so {@link MenuScreen} and {@link LobbyScreen}
 * stay declarative and consistent with the in-scene {@link LatencyPanel} (same
 * Tailwind slate + indigo palette). Every screen control is built here so a
 * restyle is a one-file change — the same discipline the rest of the client
 * follows for gameplay constants in JSON.
 */

import { Control } from '@babylonjs/gui/2D/controls/control';
import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle';
import { StackPanel } from '@babylonjs/gui/2D/controls/stackPanel';
import { TextBlock } from '@babylonjs/gui/2D/controls/textBlock';
import { Button } from '@babylonjs/gui/2D/controls/button';
import { InputText } from '@babylonjs/gui/2D/controls/inputText';
import { InputPassword } from '@babylonjs/gui/2D/controls/inputPassword';

/** Palette — mirrors LatencyPanel (Tailwind slate / indigo / status colors). */
export const Palette = {
	bg: '#0f172a',
	card: '#1e293b',
	border: '#334155',
	field: '#0f172a',
	accent: '#6366f1',
	accentHover: '#4f46e5',
	textPrimary: '#e2e8f0',
	textMuted: '#94a3b8',
	textFaint: '#64748b',
	danger: '#b91c1c',
	host: '#a16207',
	ready: '#15803d',
	waiting: '#475569',
	error: '#f87171',
	white: '#ffffff',
} as const;

const FONT = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';

/** Visual variants for {@link button}. */
type ButtonVariant = 'primary' | 'ghost' | 'danger';

/** Kinds for {@link badge}. */
type BadgeKind = 'host' | 'ready' | 'waiting' | 'neutral';

/** Card geometry — the inner body is narrower than the card, which IS the padding. */
const CARD_WIDTH_PX = 480;
const CARD_PADDING_PX = 32;
const CARD_BODY_WIDTH_PX = CARD_WIDTH_PX - CARD_PADDING_PX * 2;

/**
 * A vertical "card" container, centred on screen and height-fitted to content.
 *
 * Padding is achieved structurally rather than via Babylon's `padding`
 * properties (which interact unreliably with `adaptHeightToChildren`): the body
 * is a fixed-width stack centred inside a wider card (horizontal padding), and a
 * spacer is prepended (top padding). Each screen ends its content with
 * {@link endCard} to add the matching bottom padding.
 *
 * Returns the inner {@link StackPanel} to which rows are appended; the outer
 * rounded rectangle is its parent (accessible via `body.parent`).
 */
export function card(name: string): StackPanel {
	const root = new Rectangle(`${name}-card`);
	root.width = `${CARD_WIDTH_PX}px`;
	root.adaptHeightToChildren = true;
	root.cornerRadius = 16;
	root.thickness = 1;
	root.color = Palette.border;
	root.background = Palette.card;
	root.shadowBlur = 28;
	root.shadowOffsetY = 12;
	root.shadowColor = 'rgba(0, 0, 0, 0.45)';

	const body = new StackPanel(`${name}-body`);
	body.isVertical = true;
	body.width = `${CARD_BODY_WIDTH_PX}px`;
	root.addControl(body);

	gap(body, CARD_PADDING_PX); // top padding
	return body;
}

/** Add the card's bottom padding. Call once after appending a card's content. */
export function endCard(body: StackPanel): void {
	gap(body, CARD_PADDING_PX);
}

/** Append a fixed-height vertical gap to a stack. */
export function gap(stack: StackPanel, px: number): void {
	const spacer = new Rectangle();
	spacer.height = `${px}px`;
	spacer.thickness = 0;
	spacer.background = '';
	stack.addControl(spacer);
}

/** A bold screen/section title. */
export function heading(text: string): TextBlock {
	const t = new TextBlock(undefined, text);
	t.height = '32px';
	t.fontSize = 22;
	t.fontFamily = FONT;
	t.fontWeight = '700';
	t.color = Palette.textPrimary;
	t.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
	return t;
}

/** A muted one-line subtitle / helper text. */
export function subtitle(text: string): TextBlock {
	const t = new TextBlock(undefined, text);
	t.height = '22px';
	t.fontSize = 13;
	t.fontFamily = FONT;
	t.color = Palette.textMuted;
	t.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
	return t;
}

/** Center a text block horizontally (for card titles / subtitles). Returns it. */
export function centered(t: TextBlock): TextBlock {
	t.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
	return t;
}

/** A small field label. */
export function label(text: string): TextBlock {
	const t = new TextBlock(undefined, text);
	t.height = '18px';
	t.fontSize = 12;
	t.fontFamily = FONT;
	t.color = Palette.textMuted;
	t.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
	return t;
}

/** An inline error line (empty until set). Use the returned block's `.text`. */
export function errorLine(): TextBlock {
	const t = new TextBlock('error', '');
	t.height = '20px';
	t.fontSize = 13;
	t.fontFamily = FONT;
	t.color = Palette.error;
	t.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
	t.textWrapping = true;
	return t;
}

/** Common styling for the text/password inputs, with a live length cap. */
function styleInput(input: InputText, placeholder: string, maxLength: number): void {
	input.width = '100%';
	input.height = '42px';
	input.fontSize = 15;
	input.fontFamily = FONT;
	input.color = Palette.textPrimary;
	input.background = Palette.field;
	input.focusedBackground = Palette.field;
	input.placeholderText = placeholder;
	input.placeholderColor = Palette.textFaint;
	input.thickness = 1;
	// Babylon GUI has no built-in maxLength: truncate on change instead.
	input.onTextChangedObservable.add(() => {
		if (input.text.length > maxLength) {
			input.text = input.text.slice(0, maxLength);
		}
	});
}

/** A single-line text input. */
export function textInput(placeholder: string, maxLength: number): InputText {
	const input = new InputText();
	styleInput(input, placeholder, maxLength);
	return input;
}

/** A masked password input. */
export function passwordInput(placeholder: string, maxLength: number): InputPassword {
	const input = new InputPassword();
	styleInput(input, placeholder, maxLength);
	return input;
}

/** Background color for a button variant. */
function buttonBg(variant: ButtonVariant): string {
	if (variant === 'primary') {
		return Palette.accent;
	}
	if (variant === 'danger') {
		return Palette.danger;
	}
	return Palette.card;
}

/** A full-width button. Wire clicks via `onPointerClickObservable`. */
export function button(text: string, variant: ButtonVariant = 'primary'): Button {
	const b = Button.CreateSimpleButton(`btn-${text}`, text);
	b.width = '100%';
	b.height = '44px';
	b.cornerRadius = 8;
	b.thickness = variant === 'ghost' ? 1 : 0;
	b.color = variant === 'ghost' ? Palette.border : Palette.white;
	b.background = buttonBg(variant);
	if (b.textBlock !== null) {
		b.textBlock.fontFamily = FONT;
		b.textBlock.fontSize = 15;
		b.textBlock.fontWeight = '600';
		b.textBlock.color = variant === 'ghost' ? Palette.textPrimary : Palette.white;
	}
	return b;
}

/** Background color for a badge kind. */
function badgeBg(kind: BadgeKind): string {
	switch (kind) {
		case 'host':
			return Palette.host;
		case 'ready':
			return Palette.ready;
		case 'waiting':
			return Palette.waiting;
		default:
			return Palette.border;
	}
}

/** A small rounded pill badge that fits its text. */
export function badge(text: string, kind: BadgeKind): Rectangle {
	const pill = new Rectangle();
	pill.adaptWidthToChildren = true;
	pill.height = '22px';
	pill.cornerRadius = 11;
	pill.thickness = 0;
	pill.background = badgeBg(kind);
	pill.paddingLeft = '8px';
	pill.paddingRight = '8px';

	const t = new TextBlock(undefined, text);
	t.fontSize = 11;
	t.fontFamily = FONT;
	t.color = Palette.textPrimary;
	t.resizeToFit = true;
	pill.addControl(t);
	return pill;
}
