import {
	Color3,
	Constants,
	Effect,
	Matrix,
	PostProcess,
	Vector3,
} from '@babylonjs/core';
import type {
	Camera,
	InternalTexture,
	RenderTargetWrapper,
	Scene,
} from '@babylonjs/core';

export type RadialLightingQuality = 'low' | 'high';

export interface RadialLightingOptions {
	innerRadius: number;
	outerRadius: number;
	penumbra: number;
	lightColor: Color3;
	quality: RadialLightingQuality;
}

const FRAGMENT_SHADER = `
precision highp float;
varying vec2 vUV;
uniform sampler2D textureSampler;
uniform highp sampler2D depthSampler;
uniform mat4 uInvViewProjection;
uniform vec3 uRayPosition;
uniform vec4 uLighting;
uniform vec3 uLightColor;
uniform vec2 uDepthRange;

float hash(vec2 p) {
	return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main(void) {
	vec4 scene = texture2D(textureSampler, vUV);
	float depth = texture2D(depthSampler, vUV).r;
	if (depth >= 0.999999) {
		gl_FragColor = scene;
		return;
	}
	float clipZ = mix(depth * 2.0 - 1.0, depth, uDepthRange.x);
	vec4 world = uInvViewProjection * vec4(vUV * 2.0 - 1.0, clipZ, 1.0);
	world.xyz /= world.w;
	float distanceToRay = length(world.xz - uRayPosition.xz);
	float radial = 1.0 - smoothstep(uLighting.x, uLighting.y, distanceToRay);
	float noise = (hash(gl_FragCoord.xy + uLighting.w) - 0.5) * uDepthRange.y;
	float visibility = clamp(mix(uLighting.z, 1.0, radial) + noise, 0.0, 1.0);
	float luminance = dot(scene.rgb, vec3(0.2126, 0.7152, 0.0722));
	vec3 desaturated = mix(vec3(luminance), scene.rgb, mix(0.35, 1.0, radial));
	vec3 warm = desaturated * mix(vec3(0.72, 0.78, 0.88), uLightColor, radial * 0.28);
	vec3 emissive = scene.rgb * smoothstep(0.72, 1.15, luminance) * (1.0 - visibility);
	gl_FragColor = vec4(warm * visibility + emissive, scene.a);
}
`;

export class RadialLightingPostProcess {
	private readonly scene: Scene;
	private readonly postProcess: PostProcess;
	private readonly rayPosition = Vector3.Zero();
	private readonly inverseViewProjection = Matrix.Identity();
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
				'uInvViewProjection',
				'uRayPosition',
				'uLighting',
				'uLightColor',
				'uDepthRange',
			],
			['depthSampler'],
			1,
			scene.activeCamera,
		);
		this.postProcess.onApplyObservable.add((effect) => {
			const camera = this.scene.activeCamera;
			if (!camera) return;
			const depth = this.sceneDepthTexture(camera);
			if (depth) effect._bindTexture('depthSampler', depth);
			this.scene.getTransformMatrix().invertToRef(this.inverseViewProjection);
			effect.setMatrix('uInvViewProjection', this.inverseViewProjection);
			effect.setVector3('uRayPosition', this.rayPosition);
			effect.setFloat4(
				'uLighting',
				this.options.innerRadius,
				this.options.outerRadius,
				this.options.penumbra,
				this.frame++,
			);
			effect.setColor3('uLightColor', this.options.lightColor);
			effect.setFloat2(
				'uDepthRange',
				this.scene.getEngine().isNDCHalfZRange ? 1 : 0,
				this.options.quality === 'high' ? 0.012 : 0,
			);
		});
	}

	setRayPosition(x: number, y: number, z: number): void {
		this.rayPosition.set(x, y, z);
	}

	dispose(): void {
		this.postProcess.dispose();
	}

	private sceneDepthTexture(camera: Camera): InternalTexture | null {
		const first = (
			camera as unknown as { _getFirstPostProcess(): PostProcess | null }
		)._getFirstPostProcess();
		if (!first) return null;
		const wrapper: RenderTargetWrapper = first.inputTexture;
		if (!wrapper.depthStencilTexture)
			wrapper.createDepthStencilTexture(
				0,
				false,
				this.scene.getEngine().isStencilEnable,
				1,
				Constants.TEXTUREFORMAT_DEPTH24_STENCIL8,
				'radial-lighting-depth',
			);
		return wrapper.depthStencilTexture;
	}
}
