
import { Engine, Scene, ArcRotateCamera, Vector3, HemisphericLight, Mesh, MeshBuilder } from "@babylonjs/core";

export class App {
	private _canvas: HTMLCanvasElement;
	private _engine: Engine;
	private _scene: Scene;
	private _camera: ArcRotateCamera;

    constructor() {
		this._canvas = document.querySelector("#game") as HTMLCanvasElement;
		this._canvas.width = window.innerWidth;
		this._canvas.height = window.innerHeight;

		this._engine = new Engine(this._canvas, true);
		this._scene = new Scene(this._engine);

		this._camera = new ArcRotateCamera("Camera", Math.PI / 2, Math.PI / 2, 2, Vector3.Zero(), this._scene);
		this._camera.attachControl(this._canvas, true);

		const light1: HemisphericLight = new HemisphericLight("light1", new Vector3(1, 1, 0), this._scene);
		const sphere: Mesh = MeshBuilder.CreateSphere("sphere", { diameter: 1 }, this._scene);
        window.addEventListener("keydown", (ev) => {
            if (ev.shiftKey && ev.ctrlKey && ev.altKey && ev.keyCode === 73) {
                if (this._scene.debugLayer.isVisible()) {
                    this._scene.debugLayer.hide();
                } else {
                    this._scene.debugLayer.show();
                }
            }
        });

		window.addEventListener("resize", () => this._resize());

        this._engine.runRenderLoop(() => {
            this._scene.render();
        });
    }

	private _resize(): void {
		this._canvas.width = window.innerWidth;
		this._canvas.height = window.innerHeight;
		this._engine.resize();
	}
}