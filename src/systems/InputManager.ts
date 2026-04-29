export type KeyHandler = (event: KeyboardEvent) => void;
export type MouseMoveHandler = (movementX: number, movementY: number) => void;
export type ResizeHandler = () => void;

export class InputManager {
	private readonly _canvas: HTMLCanvasElement;
	private readonly _keys: Record<string, boolean> = {};
	private readonly _keyDownHandlers: KeyHandler[] = [];
	private readonly _mouseMoveHandlers: MouseMoveHandler[] = [];
	private readonly _clickHandlers: (() => void)[] = [];
	private readonly _attackHandlers: (() => void)[] = [];
	private readonly _resizeHandlers: ResizeHandler[] = [];
	private _enabled: boolean = true;
	private _paused: boolean = false;

	constructor(canvas: HTMLCanvasElement) {
		this._canvas = canvas;
		this._attach();
	}

	get canvas(): HTMLCanvasElement {
		return this._canvas;
	}

	isPressed(code: string): boolean {
		return this._keys[code] === true;
	}

	setEnabled(value: boolean): void {
		this._enabled = value;
		if (!value) for (const k of Object.keys(this._keys)) this._keys[k] = false;
	}

	setPaused(value: boolean): void {
		this._paused = value;
		for (const k of Object.keys(this._keys)) this._keys[k] = false;
	}

	onKeyDown(handler: KeyHandler): void {
		this._keyDownHandlers.push(handler);
	}

	onMouseMove(handler: MouseMoveHandler): void {
		this._mouseMoveHandlers.push(handler);
	}

	onClick(handler: () => void): void {
		this._clickHandlers.push(handler);
	}

	onAttack(handler: () => void): void {
		this._attackHandlers.push(handler);
	}

	onResize(handler: ResizeHandler): void {
		this._resizeHandlers.push(handler);
	}

	requestPointerLock(): void {
		if (document.pointerLockElement !== this._canvas) this._canvas.requestPointerLock();
	}

	releasePointerLock(): void {
		if (document.pointerLockElement === this._canvas) document.exitPointerLock();
	}

	hasPointerLock(): boolean {
		return document.pointerLockElement === this._canvas;
	}

	private _attach(): void {
		window.addEventListener('keydown', (ev) => {
			if (!this._enabled) return;
			if (!this._paused) this._keys[ev.code] = true;
			this._keyDownHandlers.forEach(h => h(ev));
		});

		window.addEventListener('keyup', (ev) => {
			if (!this._enabled) return;
			this._keys[ev.code] = false;
		});

		this._canvas.addEventListener('click', () => {
			if (!this._enabled) return;
			if (this._paused) return;
			this._clickHandlers.forEach(h => h());
		});

		this._canvas.addEventListener('mousedown', (ev) => {
			if (!this._enabled) return;
			if (this._paused) return;
			if (ev.button !== 0) return;
			if (!this.hasPointerLock()) return;
			this._attackHandlers.forEach(h => h());
		});

		this._canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());

		this._canvas.addEventListener('mousemove', (ev) => {
			if (!this._enabled) return;
			if (this._paused) return;
			if (!this.hasPointerLock()) return;
			this._mouseMoveHandlers.forEach(h => h(ev.movementX || 0, ev.movementY || 0));
		});

		window.addEventListener('resize', () => {
			this._resizeHandlers.forEach(h => h());
		});
	}
}
