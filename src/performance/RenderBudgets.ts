export interface RenderSnapshot {
	fps: number;
	frameTimeMs: number;
	drawCalls: number;
	meshes: number;
	materials: number;
}

export const RENDER_BUDGETS = {
	minimumFps: 30,
	maximumFrameTimeMs: 34,
	maximumDrawCalls: 450,
	maximumMeshes: 700,
	maximumMaterials: 120,
} as const;

export function renderBudgetViolations(snapshot: RenderSnapshot): string[] {
	const violations: string[] = [];
	if (snapshot.fps < RENDER_BUDGETS.minimumFps) violations.push('fps');
	if (snapshot.frameTimeMs > RENDER_BUDGETS.maximumFrameTimeMs)
		violations.push('frameTimeMs');
	if (snapshot.drawCalls > RENDER_BUDGETS.maximumDrawCalls)
		violations.push('drawCalls');
	if (snapshot.meshes > RENDER_BUDGETS.maximumMeshes)
		violations.push('meshes');
	if (snapshot.materials > RENDER_BUDGETS.maximumMaterials)
		violations.push('materials');
	return violations;
}
