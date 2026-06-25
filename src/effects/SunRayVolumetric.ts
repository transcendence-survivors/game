/**
 * @file The sun ray as a TRUE volumetric light shaft — a fullscreen post-process
 * that raymarches a vertical cylinder of glowing, dusty air at the zone centre,
 * instead of a cylinder MESH (which broke the moment the camera entered its
 * hollow shell). Being a post-process, it:
 *   - looks identical from inside and outside the beam (per-pixel volume march),
 *   - reads the scene's OWN depth buffer (it runs after the main pass, which
 *     INCLUDES the terrain) so the shaft is correctly OCCLUDED by hills and
 *     lands softly on the ground,
 *   - turns the 3D dust noise into an integrated volumetric density.
 *
 * It is additive: its glow is added on top of the rendered scene. Depth is read
 * by swapping a sampleable depth texture into the scene's render target. Stays
 * WebGL2: the shader is GLSL ES 1.00 (texture2D / gl_FragColor) and the depth is
 * a DEPTH24_STENCIL8 texture, both core WebGL2 features.
 */

import { Constants, Effect, PostProcess } from '@babylonjs/core';
import type {
	Camera,
	Color3,
	InternalTexture,
	RenderTargetWrapper,
	Scene,
	Vector3,
} from '@babylonjs/core';
import { Vector3 as Vec3 } from '@babylonjs/core';

export interface SunRayOptions {
	/** Beam colour (warm white). */
	readonly color: Color3;
	/** World Y of the strike point (≈ ground at the centre) — the shaft's base. */
	readonly strikeY: number;
	/** Horizontal radius of the shaft (world units). */
	readonly radius: number;
	/** Visible height of the shaft above the strike (it dissolves toward the top). */
	readonly height: number;
	/** Overall glow strength. */
	readonly intensity: number;
}

const FRAGMENT_SHADER = `
precision highp float;
varying vec2 vUV;
uniform sampler2D textureSampler;       // scene colour
uniform highp sampler2D depthSampler;   // scene depth (non-linear hardware depth)
uniform vec2 uTanFov;                   // tan(fov/2)*aspect, tan(fov/2)
uniform vec3 uPlanes;                   // near, far, isNDCHalfZRange(1=WebGPU)
uniform mat4 uInvView;                  // camera world matrix (= inverse view)
uniform vec3 uCamPos;                   // camera world position
uniform vec3 uBeamCenter;               // (cx, strikeY, cz)
uniform vec4 uBeamShape;                // (radius, height, intensity, time)
uniform vec3 uColor;

// Cheap 3D value noise for drifting in-shaft dust.
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
	vec2 ndc = vUV * 2.0 - 1.0;
	vec3 rayV = vec3(ndc.x * uTanFov.x, ndc.y * uTanFov.y, 1.0); // camera-space ray
	vec3 D = normalize((uInvView * vec4(rayV, 0.0)).xyz);         // world ray dir
	vec3 O = uCamPos;

	// Distance at which this pixel's ray hits solid geometry (sky → far plane).
	float dpt = texture2D(depthSampler, vUV).r;
	float maxDist;
	if (dpt < 0.999999) {
		float z;
		if (uPlanes.z > 0.5) { z = (uPlanes.x * uPlanes.y) / (uPlanes.y - dpt * (uPlanes.y - uPlanes.x)); }
		else { float zn = dpt * 2.0 - 1.0; z = (2.0 * uPlanes.x * uPlanes.y) / (uPlanes.y + uPlanes.x - zn * (uPlanes.y - uPlanes.x)); }
		maxDist = z * length(rayV);
	} else {
		maxDist = uPlanes.y;
	}

	// Intersect the ray with the infinite vertical cylinder (axis Y, centre xz, radius R).
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
	// Clamp to the shaft's vertical span [yMin, yMax].
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

	// March the visible segment, integrating dusty density.
	const int STEPS = 24;
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
		float dust = 0.5 + 0.7 * (vnoise(np) * 0.7 + vnoise(np * 2.7 + 11.0) * 0.3);
		accum += core * vFade * dust * stepLen;
	}
	float glow = clamp(accum * 0.02 * uBeamShape.z, 0.0, 2.0);
	gl_FragColor = vec4(scene.rgb + uColor * glow, scene.a);
}
`;

export class SunRayVolumetric {
	private readonly scene: Scene;
	private readonly post: PostProcess;
	/** Shaft base centre in world space (xz follow the zone; y = strikeY). */
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
			['uTanFov', 'uPlanes', 'uInvView', 'uCamPos', 'uBeamCenter', 'uBeamShape', 'uColor'],
			['depthSampler'],
			1.0,
			scene.activeCamera,
		);
		this.post.onApplyObservable.add((effect) => {
			const cam = this.scene.activeCamera;
			if (cam === null) {
				return;
			}
			const depth = this.sceneDepthTexture(cam);
			if (depth !== null) {
				effect._bindTexture('depthSampler', depth);
			}
			const engine = this.scene.getEngine();
			const tan = Math.tan(cam.fov / 2);
			effect.setFloat2('uTanFov', tan * engine.getAspectRatio(cam), tan);
			effect.setFloat3('uPlanes', cam.minZ, cam.maxZ, engine.isNDCHalfZRange ? 1 : 0);
			effect.setMatrix('uInvView', cam.getWorldMatrix()); // world matrix = inverse view
			const p = cam.globalPosition;
			effect.setFloat3('uCamPos', p.x, p.y, p.z);
			effect.setFloat3('uBeamCenter', this.center.x, this.center.y, this.center.z);
			const time = (performance.now() - this.startMs) / 1000;
			effect.setFloat4('uBeamShape', this.radius, this.height, this.intensity, time);
			effect.setColor3('uColor', this.color);
		});
	}

	/** Move the shaft's base to a new strike point (x, ground y, z). */
	setStrike(x: number, y: number, z: number): void {
		this.center.x = x;
		this.center.y = y;
		this.center.z = z;
	}

	/** The scene's own depth buffer as a sampleable texture. */
	private sceneDepthTexture(cam: Camera): InternalTexture | null {
		const first = (
			cam as unknown as { _getFirstPostProcess(): PostProcess | null }
		)._getFirstPostProcess();
		if (first === null) {
			return null;
		}
		const wrapper: RenderTargetWrapper = first.inputTexture;
		if (wrapper.depthStencilTexture === null) {
			wrapper.createDepthStencilTexture(
				0,
				false,
				this.scene.getEngine().isStencilEnable,
				1,
				Constants.TEXTUREFORMAT_DEPTH24_STENCIL8,
				'sunray-scene-depth',
			);
		}
		return wrapper.depthStencilTexture;
	}

	dispose(): void {
		this.post.dispose();
	}
}
