import * as BABYLON from '@babylonjs/core';

export function createDebugMaterial(
	scene: BABYLON.Scene,
	name: string,
	color: BABYLON.Color3,
	alpha = 1,
): BABYLON.StandardMaterial {
	const material = new BABYLON.StandardMaterial(name, scene);
	material.disableLighting = true;
	material.emissiveColor = color;
	material.alpha = alpha;
	material.backFaceCulling = false;
	material.wireframe = true;
	material.disableDepthWrite = true;
	return material;
}

export function configureDebugMesh(
	mesh: BABYLON.Mesh,
	material: BABYLON.Material,
	renderingGroupId: number,
): void {
	mesh.material = material;
	mesh.isPickable = false;
	mesh.renderingGroupId = renderingGroupId;
}
