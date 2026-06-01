/**
 * @file Captures keyboard events and exposes the current input as an
 * {@link InputCommand}. Stateless w.r.t. the network — the caller polls
 * {@link InputManager.snapshot} every send tick and forwards the result.
 *
 * Jump is **edge-triggered**: pressing Space sets a one-shot flag that is
 * consumed (reset to `false`) on the next call to {@link snapshot}, so a
 * single press produces exactly one jump request even if the send rate
 * exceeds the press duration.
 */

import type { InputCommand } from '@transcendence/game-shared';
import type { ControlsConfig } from '../core/ConfigLoader';

export class InputManager {
	private readonly controls: ControlsConfig;
	private readonly heldKeys = new Set<string>();
	private jumpQueued = false;

	constructor(controls: ControlsConfig) {
		this.controls = controls;
	}

	/** Begin listening for keyboard events on `window`. */
	attach(): void {
		window.addEventListener('keydown', this.onKeyDown);
		window.addEventListener('keyup', this.onKeyUp);
	}

	/** Stop listening. Safe to call multiple times. */
	detach(): void {
		window.removeEventListener('keydown', this.onKeyDown);
		window.removeEventListener('keyup', this.onKeyUp);
		this.heldKeys.clear();
		this.jumpQueued = false;
	}

	/** Build an {@link InputCommand} reflecting the current input state. */
	snapshot(): InputCommand {
		const forward = this.heldKeys.has(this.controls.moveForward) ? 1 : 0;
		const backward = this.heldKeys.has(this.controls.moveBackward) ? 1 : 0;
		const left = this.heldKeys.has(this.controls.moveLeft) ? 1 : 0;
		const right = this.heldKeys.has(this.controls.moveRight) ? 1 : 0;
		const jump = this.jumpQueued;
		this.jumpQueued = false;
		return {
			moveX: right - left,
			moveZ: forward - backward,
			jump,
		};
	}

	private readonly onKeyDown = (e: KeyboardEvent): void => {
		this.heldKeys.add(e.code);
		if (e.code === this.controls.jump) {
			this.jumpQueued = true;
			e.preventDefault();
		}
	};

	private readonly onKeyUp = (e: KeyboardEvent): void => {
		this.heldKeys.delete(e.code);
	};
}
