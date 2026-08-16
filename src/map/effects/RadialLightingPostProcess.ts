import {
	Color3,
	Effect,
	PostProcess,
	Vector3,
} from '@babylonjs/core';
import type { Scene } from '@babylonjs/core';
import { sceneDepthTexture } from './SceneDepthTexture';

export type RadialLightingQuality = 'low' | 'high';

export interface RadialLightingOptions {
	innerRadius: number;
	outerRadius: number;
	/** Visibilite minimale conservee dans les tenebres, hors du cylindre. */
	penumbra: number;
	lightColor: Color3;
	quality: RadialLightingQuality;
}

export function radialVisibility(
	distance: number,
	innerRadius: number,
	outerRadius: number,
	penumbra: number,
): number {
	if (![distance, innerRadius, outerRadius, penumbra].every(Number.isFinite))
		return 0;
	if (outerRadius <= innerRadius)
		return distance <= innerRadius ? 1 : penumbra;
	const t = Math.min(
		1,
		Math.max(0, (distance - innerRadius) / (outerRadius - innerRadius)),
	);
	const smooth = t * t * (3 - 2 * t);
	return Math.min(1, Math.max(0, penumbra + (1 - penumbra) * (1 - smooth)));
}

const FRAGMENT_SHADER = `
precision highp float;
varying vec2 vUV;
uniform sampler2D textureSampler;
uniform highp sampler2D depthSampler;
uniform vec2 uTanFov;
uniform vec3 uPlanes;
uniform mat4 uInvView;
uniform vec3 uCamPos;
uniform vec3 uRayPosition;
uniform vec4 uLighting;
uniform vec3 uLightColor;

float hash(vec2 p) {
	return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main(void) {
	vec4 scene = texture2D(textureSampler, vUV);
	float depth = texture2D(depthSampler, vUV).r;

	// Les arêtes de debug sont volontairement très saturées. Elles constituent
	// une surcouche de diagnostic et ne doivent recevoir ni pénombre ni teinte
	// atmosphérique, sans quoi leur densité donne un voile jaune/rouge à l'écran.
	float debugMax = max(scene.r, max(scene.g, scene.b));
	float debugMin = min(scene.r, min(scene.g, scene.b));
	bool debugOverlay = debugMax > 0.72 && (debugMax - debugMin) > 0.58;
	if (debugOverlay) {
		gl_FragColor = scene;
		return;
	}

	// Rayon camera en espace monde. Cette reconstruction est independante de
	// l'orientation de la camera et evite les decalages du halo sur le relief.
	vec2 ndc = vUV * 2.0 - 1.0;
	vec3 rayV = vec3(ndc.x * uTanFov.x, ndc.y * uTanFov.y, 1.0);
	vec3 rayDir = normalize((uInvView * vec4(rayV, 0.0)).xyz);
	float maxDistance = uPlanes.y;
	bool hitGeometry = depth < 0.999999;
	if (hitGeometry) {
		float viewZ;
		if (uPlanes.z > 0.5) {
			viewZ = (uPlanes.x * uPlanes.y) /
				(uPlanes.y - depth * (uPlanes.y - uPlanes.x));
		} else {
			float zNdc = depth * 2.0 - 1.0;
			viewZ = (2.0 * uPlanes.x * uPlanes.y) /
				(uPlanes.y + uPlanes.x - zNdc * (uPlanes.y - uPlanes.x));
		}
		maxDistance = viewZ * length(rayV);
	}

	// Eclairage des surfaces : plein au coeur du cylindre, puis fondu doux
	// jusqu'a la visibilite minimale des tenebres.
	vec3 worldPosition = uCamPos + rayDir * maxDistance;
	float distanceToRay = length(worldPosition.xz - uRayPosition.xz);
	float radial = hitGeometry
		? 1.0 - smoothstep(uLighting.x, uLighting.y, distanceToRay)
		: 0.0;
	float noise = (hash(gl_FragCoord.xy + uLighting.w) - 0.5) * 0.018;
	float visibility = clamp(mix(uLighting.z, 1.0, radial) + noise * radial, 0.0, 1.0);
	float luminance = dot(scene.rgb, vec3(0.2126, 0.7152, 0.0722));
	vec3 desaturated = mix(vec3(luminance), scene.rgb, mix(0.45, 1.0, radial));
	vec3 tint = mix(vec3(0.62, 0.69, 0.82), uLightColor, radial * 0.24);
	vec3 color = desaturated * tint * visibility;

	// Brume atmospherique volumetrique : integration du segment visible du rayon
	// camera qui traverse le cylindre horizontal centre sur le rayon lumineux.
	// Elle ne depend d'aucune Light Babylon et reste visible meme devant le ciel.
	vec2 offset = uCamPos.xz - uRayPosition.xz;
	float a = dot(rayDir.xz, rayDir.xz);
	float b = 2.0 * dot(offset, rayDir.xz);
	float c = dot(offset, offset) - uLighting.y * uLighting.y;
	float discriminant = b * b - 4.0 * a * c;
	float atmosphere = 0.0;
	if (discriminant > 0.0 && a > 0.00001) {
		float root = sqrt(discriminant);
		float entry = max(0.0, (-b - root) / (2.0 * a));
		float exit = min(maxDistance, (-b + root) / (2.0 * a));
		if (exit > entry) {
			const int STEPS = 6;
			float stepLength = (exit - entry) / float(STEPS);
			float density = 0.0;
			for (int i = 0; i < STEPS; i++) {
				float t = entry + (float(i) + 0.5) * stepLength;
				vec3 samplePosition = uCamPos + rayDir * t;
				float sampleRadius = length(samplePosition.xz - uRayPosition.xz);
				float sampleLight = 1.0 - smoothstep(
					uLighting.x * 0.7,
					uLighting.y,
					sampleRadius
				);
				density += sampleLight;
			}
			atmosphere = 1.0 - exp(-density * stepLength * 0.008);
		}
	}

	color += uLightColor * atmosphere * 0.34;
	// Les pixels emissifs (UI 3D, auras, effets de combat) restent lisibles dans
	// les tenebres sans eclairer artificiellement le reste de la scene.
	vec3 emissive = scene.rgb * smoothstep(0.72, 1.15, luminance) * (1.0 - visibility);
	gl_FragColor = vec4(color + emissive, scene.a);
}
`;

export class RadialLightingPostProcess {
	private readonly scene: Scene;
	private readonly postProcess: PostProcess;
	private readonly rayPosition = Vector3.Zero();
	private readonly options: RadialLightingOptions;
	private frame = 0;

	constructor(scene: Scene, options: RadialLightingOptions) {
		this.scene = scene;
		this.options = options;
		if (Effect.ShadersStore.radialLightingFragmentShader === undefined)
			Effect.ShadersStore.radialLightingFragmentShader = FRAGMENT_SHADER;
		this.postProcess = new PostProcess(
			'radialLighting',
			'radialLighting',
			[
				'uTanFov',
				'uPlanes',
				'uInvView',
				'uCamPos',
				'uRayPosition',
				'uLighting',
				'uLightColor',
			],
			['depthSampler'],
			1,
			scene.activeCamera,
		);
		this.postProcess.onApplyObservable.add((effect) => {
			const camera = this.scene.activeCamera;
			if (!camera) return;
			const depth = sceneDepthTexture(
				this.scene,
				camera,
				'radial-lighting-depth',
			);
			if (depth) effect._bindTexture('depthSampler', depth);
			const engine = this.scene.getEngine();
			const tan = Math.tan(camera.fov / 2);
			effect.setFloat2(
				'uTanFov',
				tan * engine.getAspectRatio(camera),
				tan,
			);
			effect.setFloat3(
				'uPlanes',
				camera.minZ,
				camera.maxZ,
				engine.isNDCHalfZRange ? 1 : 0,
			);
			effect.setMatrix('uInvView', camera.getWorldMatrix());
			const cameraPosition = camera.globalPosition;
			effect.setFloat3(
				'uCamPos',
				cameraPosition.x,
				cameraPosition.y,
				cameraPosition.z,
			);
			effect.setVector3('uRayPosition', this.rayPosition);
			effect.setFloat4(
				'uLighting',
				this.options.innerRadius,
				this.options.outerRadius,
				this.options.penumbra,
				this.frame++,
			);
			effect.setColor3('uLightColor', this.options.lightColor);
		});
	}

	setRayPosition(x: number, y: number, z: number): void {
		this.rayPosition.set(x, y, z);
	}

	dispose(): void {
		this.postProcess.dispose();
	}
}
