/**
 * @file Local-only edge-triggered hotkeys for in-game UI overlays.
 *
 * Kept separate from {@link InputManager} on purpose: gameplay inputs are
 * snapshotted and shipped to the server, UI hotkeys are local-only.
 *
 * Edge-trigger: the callback fires once on key press. Holding the key down
 * does not re-fire — the next firing requires a release-then-press cycle.
 */

import { KeyboardListener } from './KeyboardListener';

export interface UiHotkeysBindings {
	/** `KeyboardEvent.code` that toggles the latency panel. */
	readonly togglePanel: string;
}

export class UiHotkeys {
	private readonly bindings: UiHotkeysBindings;
	private readonly onTogglePanel: () => void;
	private readonly keyboard: KeyboardListener;
	private togglePanelPressed = false;

	constructor(bindings: UiHotkeysBindings, onTogglePanel: () => void) {
		this.bindings = bindings;
		this.onTogglePanel = onTogglePanel;
		// Assigned here (not as a field initializer) so the onKeyDown/onKeyUp
		// arrow fields are already initialized when captured.
		this.keyboard = new KeyboardListener(this.onKeyDown, this.onKeyUp);
	}

	attach(): void {
		this.keyboard.attach();
	}

	detach(): void {
		this.keyboard.detach();
		this.togglePanelPressed = false;
	}

	private readonly onKeyDown = (e: KeyboardEvent): void => {
		if (e.code !== this.bindings.togglePanel) {
			return;
		}
		// Browser keydown auto-repeats while held — guard against spamming the toggle.
		if (this.togglePanelPressed) {
			return;
		}
		this.togglePanelPressed = true;
		this.onTogglePanel();
		e.preventDefault();
	};

	private readonly onKeyUp = (e: KeyboardEvent): void => {
		if (e.code === this.bindings.togglePanel) {
			this.togglePanelPressed = false;
		}
	};
}
