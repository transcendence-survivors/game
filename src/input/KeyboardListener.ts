/**
 * @file Low-level plumbing for `window` keyboard events.
 *
 * Centralises the `addEventListener`/`removeEventListener` boilerplate shared
 * by every keyboard consumer (gameplay {@link InputManager}, local
 * {@link UiHotkeys}, …). Holds no input semantics of its own — callers supply
 * their `keydown`/`keyup` handlers and own the meaning of each key.
 */

export class KeyboardListener {
	private readonly onDown: (e: KeyboardEvent) => void;
	private readonly onUp: (e: KeyboardEvent) => void;

	constructor(onDown: (e: KeyboardEvent) => void, onUp: (e: KeyboardEvent) => void) {
		this.onDown = onDown;
		this.onUp = onUp;
	}

	/** Begin listening for keyboard events on `window`. */
	attach(): void {
		window.addEventListener('keydown', this.onDown);
		window.addEventListener('keyup', this.onUp);
	}

	/** Stop listening. Safe to call multiple times. */
	detach(): void {
		window.removeEventListener('keydown', this.onDown);
		window.removeEventListener('keyup', this.onUp);
	}
}
