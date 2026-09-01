import {
	KeyboardEventTypes,
	type KeyboardInfo,
	type Observer,
	type Scene,
} from '@babylonjs/core';

export class InputManager {
	private readonly scene: Scene;
	private readonly keys = new Map<string, boolean>();
	private readonly keyboardObserver: Observer<KeyboardInfo>;

	constructor(scene: Scene) {
		this.scene = scene;
		this.keyboardObserver = this.scene.onKeyboardObservable.add(
			(keyboardInfo) => {
				const key = keyboardInfo.event.key.toLowerCase();
				if (keyboardInfo.type === KeyboardEventTypes.KEYDOWN)
					this.keys.set(key, true);
				if (keyboardInfo.type === KeyboardEventTypes.KEYUP)
					this.keys.set(key, false);
			},
		);
	}

	isPressed(key: string) {
		return this.keys.get(key.toLowerCase()) === true;
	}

	dispose() {
		this.scene.onKeyboardObservable.remove(this.keyboardObserver);
		this.keys.clear();
	}
}
