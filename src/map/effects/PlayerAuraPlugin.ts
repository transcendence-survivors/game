import * as BABYLON from '@babylonjs/core';

/** Nombre max d'auras rendues simultanément (= joueurs max dans une room). */
export const MAX_AURAS = 4;

/** Une aura à afficher : centre monde (x, z), portée et cadence d'attaque. */
export interface AuraInstance {
	x: number;
	z: number;
	radius: number;
	attackSpeed: number;
}

/**
 * Plugin de matériau qui dessine les auras des joueurs directement sur le
 * terrain. Comme la contribution est calculée par pixel à partir de la
 * position monde (`vPositionW`), l'aura épouse parfaitement le relief à paliers
 * (falaises, pentes) sans z-fighting, contrairement à un sprite plaqué au sol.
 *
 * Le rendu est purement cosmétique : la portée et les dégâts font autorité
 * côté serveur. On ne partage ici que la géométrie (centre + rayon) et la
 * cadence, pour animer une onde de choc synchronisée sur chaque attaque.
 *
 * Scalable : une seule injection couvre tout le terrain et gère jusqu'à
 * MAX_AURAS joueurs via un tableau d'uniforms, sans créer le moindre mesh.
 */
export class PlayerAuraPlugin extends BABYLON.MaterialPluginBase {
	private _enabled = true;
	// vec4 par aura : (centreX, centreZ, rayon, attackSpeed).
	private readonly _auraData = new Float32Array(MAX_AURAS * 4);
	private _count = 0;
	private _time = 0;

	/** Teinte du champ (glow additif). Modifiable à chaud. */
	color = new BABYLON.Color3(0.35, 0.85, 1.0);

	constructor(material: BABYLON.Material) {
		super(material, 'PlayerAura', 250, { PLAYER_AURA: false });
		this._enable(true);
	}

	get isEnabled(): boolean {
		return this._enabled;
	}
	set isEnabled(value: boolean) {
		if (this._enabled === value) return;
		this._enabled = value;
		this.markAllDefinesAsDirty();
		this._enable(value);
	}

	/** Remplace l'ensemble des auras et avance l'horloge d'animation. */
	update(auras: readonly AuraInstance[], dtSeconds: number): void {
		if (Number.isFinite(dtSeconds) && dtSeconds > 0) this._time += dtSeconds;
		const n = Math.min(auras.length, MAX_AURAS);
		for (let i = 0; i < n; i++) {
			const a = auras[i];
			const o = i * 4;
			this._auraData[o] = a.x;
			this._auraData[o + 1] = a.z;
			this._auraData[o + 2] = a.radius;
			this._auraData[o + 3] = a.attackSpeed;
		}
		this._count = n;
	}

	prepareDefines(defines: BABYLON.MaterialDefines): void {
		defines['PLAYER_AURA'] = this._enabled;
	}

	getClassName(): string {
		return 'PlayerAuraPlugin';
	}

	getUniforms() {
		return {
			ubo: [
				{ name: 'auraData', size: 4, type: 'vec4', arraySize: MAX_AURAS },
				{ name: 'auraColor', size: 3, type: 'vec3' },
				{ name: 'auraParams', size: 4, type: 'vec4' },
			],
			fragment: `#ifdef PLAYER_AURA
uniform vec4 auraData[${MAX_AURAS}];
uniform vec3 auraColor;
uniform vec4 auraParams;
#endif`,
		};
	}

	bindForSubMesh(uniformBuffer: BABYLON.UniformBuffer): void {
		if (!this._enabled) return;
		uniformBuffer.updateFloatArray('auraData', this._auraData);
		uniformBuffer.updateColor3('auraColor', this.color);
		uniformBuffer.updateFloat4(
			'auraParams',
			this._count,
			this._time,
			0,
			0,
		);
	}

	getCustomCode(shaderType: string) {
		if (shaderType !== 'fragment') return null;
		// auraParams.x = nombre d'auras actives, auraParams.y = temps (s).
		return {
			CUSTOM_FRAGMENT_MAIN_END: `
			#ifdef PLAYER_AURA
			{
				int auraN = int(auraParams.x + 0.5);
				float auraT = auraParams.y;
				vec3 auraAccum = vec3(0.0);
				for (int i = 0; i < ${MAX_AURAS}; i++) {
					if (i >= auraN) { break; }
					vec4 a = auraData[i];
					float radius = a.z;
					if (radius <= 0.0) { continue; }
					float dist = distance(vPositionW.xz, a.xy);
					if (dist > radius) { continue; }
					float t = dist / radius;                       // 0 centre -> 1 bord
					float fill = (1.0 - t) * 0.10;                 // remplissage doux
					float ring = smoothstep(0.82, 1.0, t) * 0.7;   // anneau au bord
					float phase = fract(auraT * a.w);              // onde par attaque
					float wave = smoothstep(0.07, 0.0, abs(t - phase)) * (1.0 - phase) * 0.9;
					auraAccum += auraColor * (fill + ring + wave);
				}
				gl_FragColor.rgb += auraAccum;
			}
			#endif
			`,
		};
	}
}
