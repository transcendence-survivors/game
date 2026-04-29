import { Color3, StandardMaterial } from '@babylonjs/core';

export interface FlashEffectConfig {
	flashColor: Color3;
	durationMs: number;
}

export class MonsterFlashEffect {
	private readonly _material: StandardMaterial;
	private readonly _baseColor: Color3;
	private readonly _config: FlashEffectConfig;
	private _flashEndsAtMs: number = 0;

	constructor(material: StandardMaterial, config: FlashEffectConfig) {
		this._material = material;
		this._baseColor = material.diffuseColor.clone();
		this._config = config;
	}

	trigger(nowMs: number): void {
		this._flashEndsAtMs = nowMs + this._config.durationMs;
		this._material.diffuseColor = this._config.flashColor.clone();
	}

	update(nowMs: number): void {
		if (this._flashEndsAtMs === 0) return;
		if (nowMs >= this._flashEndsAtMs) {
			this._material.diffuseColor = this._baseColor.clone();
			this._flashEndsAtMs = 0;
		}
	}
}
