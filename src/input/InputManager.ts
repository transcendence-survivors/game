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
import { KeyboardListener } from './KeyboardListener';

export class InputManager {
	private readonly controls: ControlsConfig;
	private readonly heldKeys = new Set<string>();
	private readonly keyboard: KeyboardListener;
	private jumpQueued = false;
	/** Monotonic counter stamped onto every {@link snapshot}; see InputCommand.seq. */
	private seq = 0;

	constructor(controls: ControlsConfig) {
		this.controls = controls;
		// Assigned here (not as a field initializer) so the onKeyDown/onKeyUp
		// arrow fields are already initialized when captured.
		this.keyboard = new KeyboardListener(this.onKeyDown, this.onKeyUp);
	}

	/** Begin listening for keyboard events on `window`. */
	attach(): void {
		this.keyboard.attach();
	}

	/** Stop listening. Safe to call multiple times. */
	detach(): void {
		this.keyboard.detach();
		this.heldKeys.clear();
		this.jumpQueued = false;
		this.seq = 0;
	}

	/** Build an {@link InputCommand} reflecting the current input state. */
	snapshot(): InputCommand {
		const forward = this.heldKeys.has(this.controls.moveForward) ? 1 : 0;
		const backward = this.heldKeys.has(this.controls.moveBackward) ? 1 : 0;
		const left = this.heldKeys.has(this.controls.moveLeft) ? 1 : 0;
		const right = this.heldKeys.has(this.controls.moveRight) ? 1 : 0;
		const jump = this.jumpQueued;
		this.jumpQueued = false;
		this.seq += 1;
		return {
			moveX: right - left,
			moveZ: forward - backward,
			jump,
			seq: this.seq,
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
