import {
	Color4,
	DynamicTexture,
	Effect,
	GPUParticleSystem,
	ParticleSystem,
	PostProcess,
} from '@babylonjs/core';
import type { Color3, Scene, Vector3 } from '@babylonjs/core';
import { Vector3 as Vec3 } from '@babylonjs/core';
import {
	bindCameraDepthUniforms,
	CAMERA_DEPTH_GLSL,
	DEPTH_UNIFORMS,
} from './SceneDepthTexture';
import { EFFECT_RENDER_RATIO } from './RadialLightingPostProcess';

interface SunRayOptions {
	readonly color: Color3;
	readonly strikeY: number;
	readonly radius: number;
	readonly height: number;
	readonly intensity: number;
}

const FRAGMENT_SHADER = `
precision highp float;
varying vec2 vUV;
uniform sampler2D textureSampler;       // scene colour
${CAMERA_DEPTH_GLSL}
uniform vec3 uBeamCenter;               // (cx, strikeY, cz)
uniform vec4 uBeamShape;                // (radius, height, intensity, time)
uniform vec3 uColor;

float hash3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x){
	vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
	return mix(mix(mix(hash3(i + vec3(0.0,0.0,0.0)), hash3(i + vec3(1.0,0.0,0.0)), f.x),
	               mix(hash3(i + vec3(0.0,1.0,0.0)), hash3(i + vec3(1.0,1.0,0.0)), f.x), f.y),
	           mix(mix(hash3(i + vec3(0.0,0.0,1.0)), hash3(i + vec3(1.0,0.0,1.0)), f.x),
	               mix(hash3(i + vec3(0.0,1.0,1.0)), hash3(i + vec3(1.0,1.0,1.0)), f.x), f.y), f.z);
}

void main(void){
	vec4 scene = texture2D(textureSampler, vUV);
	vec3 rayV;
	vec3 D = cameraWorldRay(vUV, rayV);
	vec3 O = uCamPos;

	float dpt = texture2D(depthSampler, vUV).r;
	float maxDist = sceneDepthDistance(dpt, rayV);

	float R = uBeamShape.x;
	vec2 oc = O.xz - uBeamCenter.xz;
	float a = dot(D.xz, D.xz);
	float b = 2.0 * dot(oc, D.xz);
	float cc = dot(oc, oc) - R * R;
	float disc = b * b - 4.0 * a * cc;
	if (disc <= 0.0 || a < 1e-5) { gl_FragColor = scene; return; }
	float sq = sqrt(disc);
	float t0 = max((-b - sq) / (2.0 * a), 0.0);
	float t1 = min((-b + sq) / (2.0 * a), maxDist);
	float yMin = uBeamCenter.y;
	float yMax = uBeamCenter.y + uBeamShape.y;
	if (abs(D.y) > 1e-4) {
		float ta = (yMin - O.y) / D.y;
		float tb = (yMax - O.y) / D.y;
		t0 = max(t0, min(ta, tb));
		t1 = min(t1, max(ta, tb));
	} else if (O.y < yMin || O.y > yMax) {
		gl_FragColor = scene; return;
	}
	if (t1 <= t0) { gl_FragColor = scene; return; }

	const int STEPS = 8;
	float stepLen = (t1 - t0) / float(STEPS);
	float time = uBeamShape.w;
	float accum = 0.0;
	for (int s = 0; s < STEPS; s++) {
		vec3 p = O + D * (t0 + (float(s) + 0.5) * stepLen);
		float radial = length(p.xz - uBeamCenter.xz) / R;       // 0 axis .. 1 rim
		float core = exp(-radial * radial * 2.5);                // soft gaussian core
		float vy = clamp((p.y - yMin) / uBeamShape.y, 0.0, 1.0);
		float vFade = smoothstep(0.0, 0.05, vy) * (1.0 - smoothstep(0.5, 1.0, vy));
		vec3 np = p * 0.09; np.y -= time * 0.7;
		float dust = 0.5 + 0.7 * vnoise(np);
		accum += core * vFade * dust * stepLen;
	}
	float glow = clamp(accum * 0.02 * uBeamShape.z, 0.0, 2.0);
	gl_FragColor = vec4(scene.rgb + uColor * glow, scene.a);
}
`;

function radialSprite(scene: Scene, name: string): DynamicTexture {
	const tex = new DynamicTexture(
		name,
		{ width: 128, height: 128 },
		scene,
		false,
	);
	tex.hasAlpha = true;
	const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
	const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
	g.addColorStop(0, 'rgba(255,255,255,1)');
	g.addColorStop(0.45, 'rgba(255,255,255,0.5)');
	g.addColorStop(1, 'rgba(255,255,255,0)');
	ctx.fillStyle = g;
	ctx.fillRect(0, 0, 128, 128);
	tex.update();
	return tex;
}

export class SunRayVolumetric {
	private readonly scene: Scene;
	private readonly post: PostProcess;
	private readonly dust: ParticleSystem | GPUParticleSystem;
	private readonly center: Vector3;
	private readonly color: Color3;
	private readonly radius: number;
	private readonly height: number;
	private readonly intensity: number;
	private readonly startMs = performance.now();

	constructor(scene: Scene, opts: SunRayOptions) {
		this.scene = scene;
		this.color = opts.color;
		this.radius = opts.radius;
		this.height = opts.height;
		this.intensity = opts.intensity;
		this.center = new Vec3(0, opts.strikeY, 0);

		if (Effect.ShadersStore['sunRayVolFragmentShader'] === undefined) {
			Effect.ShadersStore['sunRayVolFragmentShader'] = FRAGMENT_SHADER;
		}
		this.post = new PostProcess(
			'sunRayVol',
			'sunRayVol',
			[...DEPTH_UNIFORMS, 'uBeamCenter', 'uBeamShape', 'uColor'],
			['depthSampler'],
			EFFECT_RENDER_RATIO,
			scene.activeCamera,
		);
		this.post.onApplyObservable.add((effect) => {
			const cam = this.scene.activeCamera;
			if (cam === null) return;
			bindCameraDepthUniforms(
				effect,
				this.scene,
				cam,
				'sunray-scene-depth',
			);
			effect.setFloat3(
				'uBeamCenter',
				this.center.x,
				this.center.y,
				this.center.z,
			);
			const time = (performance.now() - this.startMs) / 1000;
			effect.setFloat4(
				'uBeamShape',
				this.radius,
				this.height,
				this.intensity,
				time,
			);
			effect.setColor3('uColor', this.color);
		});

		const r = this.radius;
		const DUST_CAPACITY = 160;
		this.dust = GPUParticleSystem.IsSupported
			? new GPUParticleSystem(
					'sun-ray-dust',
					{ capacity: DUST_CAPACITY },
					scene,
				)
			: new ParticleSystem('sun-ray-dust', DUST_CAPACITY, scene);
		this.dust.particleTexture = radialSprite(scene, 'sun-ray-dust-tex');
		this.dust.emitter = this.center;
		this.dust.minEmitBox = new Vec3(-r, 0, -r);
		this.dust.maxEmitBox = new Vec3(r, this.height * 0.8, r);
		this.dust.color1 = new Color4(1.0, 0.85, 0.55, 0.7);
		this.dust.color2 = new Color4(1.0, 0.72, 0.4, 0.45);
		this.dust.colorDead = new Color4(1.0, 0.8, 0.5, 0.0);
		this.dust.minSize = 0.2;
		this.dust.maxSize = 1.0;
		this.dust.minLifeTime = 4.0;
		this.dust.maxLifeTime = 9.0;
		this.dust.emitRate = 40;
		this.dust.blendMode = ParticleSystem.BLENDMODE_ADD;
		this.dust.gravity = new Vec3(0, 0.6, 0);
		this.dust.direction1 = new Vec3(-0.15, 0.6, -0.15);
		this.dust.direction2 = new Vec3(0.15, 1.0, 0.15);
		this.dust.minEmitPower = 0.2;
		this.dust.maxEmitPower = 0.8;
		this.dust.updateSpeed = 0.02;
		this.dust.start();
	}

	setStrike(x: number, y: number, z: number): void {
		this.center.x = x;
		this.center.y = y;
		this.center.z = z;
	}
	dispose(): void {
		this.dust.dispose();
		this.post.dispose();
	}
}
