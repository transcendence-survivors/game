/**
 * @file Local-only edge-triggered hotkeys for in-game UI overlays.
 *
 * Kept separate from {@link InputManager} on purpose: gameplay inputs are
 * snapshotted and shipped to the server, UI hotkeys are local-only.
 *
 * Edge-trigger: the callback fires once on key press. Holding the key down
 * does not re-fire — the next firing requires a release-then-press cycle.
 */

export interface UiHotkeysBindings {
	/** `KeyboardEvent.code` that toggles the latency panel. */
	readonly togglePanel: string;
}

export class UiHotkeys {
	private readonly bindings: UiHotkeysBindings;
	private readonly onTogglePanel: () => void;
	private togglePanelPressed = false;

	constructor(bindings: UiHotkeysBindings, onTogglePanel: () => void) {
		this.bindings = bindings;
		this.onTogglePanel = onTogglePanel;
	}

	attach(): void {
		window.addEventListener('keydown', this.onKeyDown);
		window.addEventListener('keyup', this.onKeyUp);
	}

	detach(): void {
		window.removeEventListener('keydown', this.onKeyDown);
		window.removeEventListener('keyup', this.onKeyUp);
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
