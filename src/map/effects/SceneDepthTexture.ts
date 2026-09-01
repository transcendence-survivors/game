import { Constants, PostProcess } from '@babylonjs/core';
import type {
	Camera,
	Effect,
	InternalTexture,
	RenderTargetWrapper,
	Scene,
} from '@babylonjs/core';

export const DEPTH_UNIFORMS = [
	'uTanFov',
	'uPlanes',
	'uInvView',
	'uCamPos',
] as const;

export const CAMERA_DEPTH_GLSL = `
uniform highp sampler2D depthSampler;
uniform vec2 uTanFov;
uniform vec3 uPlanes;
uniform mat4 uInvView;
uniform vec3 uCamPos;

vec3 cameraWorldRay(vec2 uv, out vec3 cameraRay) {
	vec2 ndc = uv * 2.0 - 1.0;
	cameraRay = vec3(ndc.x * uTanFov.x, ndc.y * uTanFov.y, 1.0);
	return normalize((uInvView * vec4(cameraRay, 0.0)).xyz);
}

float sceneDepthDistance(float depth, vec3 cameraRay) {
	if (depth >= 0.999999) return uPlanes.y;
	float viewZ;
	if (uPlanes.z > 0.5) viewZ = (uPlanes.x * uPlanes.y) / (uPlanes.y - depth * (uPlanes.y - uPlanes.x));
	else {
		float zNdc = depth * 2.0 - 1.0;
		viewZ = (2.0 * uPlanes.x * uPlanes.y) / (uPlanes.y + uPlanes.x - zNdc * (uPlanes.y - uPlanes.x));
	}
	return viewZ * length(cameraRay);
}
`;

function sceneDepthTexture(
	scene: Scene,
	camera: Camera,
	name: string,
): InternalTexture | null {
	const first = (
		camera as unknown as { _getFirstPostProcess(): PostProcess | null }
	)._getFirstPostProcess();
	if (!first) return null;
	const wrapper: RenderTargetWrapper = first.inputTexture;
	if (!wrapper.depthStencilTexture)
		wrapper.createDepthStencilTexture(
			0,
			false,
			scene.getEngine().isStencilEnable,
			1,
			Constants.TEXTUREFORMAT_DEPTH24_STENCIL8,
			name,
		);
	return wrapper.depthStencilTexture;
}

export function bindCameraDepthUniforms(
	effect: Effect,
	scene: Scene,
	camera: Camera,
	depthTextureName: string,
): void {
	const depth = sceneDepthTexture(scene, camera, depthTextureName);
	if (depth) effect._bindTexture('depthSampler', depth);
	const engine = scene.getEngine();
	const tan = Math.tan(camera.fov / 2);
	effect.setFloat2('uTanFov', tan * engine.getAspectRatio(camera), tan);
	effect.setFloat3(
		'uPlanes',
		camera.minZ,
		camera.maxZ,
		engine.isNDCHalfZRange ? 1 : 0,
	);
	effect.setMatrix('uInvView', camera.getWorldMatrix());
	const { x, y, z } = camera.globalPosition;
	effect.setFloat3('uCamPos', x, y, z);
}
