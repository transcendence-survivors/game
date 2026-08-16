import { Constants, PostProcess } from '@babylonjs/core';
import type {
	Camera,
	InternalTexture,
	RenderTargetWrapper,
	Scene,
} from '@babylonjs/core';

export function sceneDepthTexture(
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
