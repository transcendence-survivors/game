export class SettingsMenu {
	private fov!: number;

	getFov() {
		return this.fov;
	}

	setFov(fov: number) {
		this.fov = fov;
	}
}
