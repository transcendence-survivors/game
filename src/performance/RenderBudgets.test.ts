import { describe, expect, test } from 'vitest';
import { renderBudgetViolations } from './RenderBudgets';

describe('renderBudgetViolations', () => {
	test('accepts the target rendering envelope', () => {
		expect(
			renderBudgetViolations({
				fps: 60,
				frameTimeMs: 16.7,
				drawCalls: 300,
				meshes: 500,
				materials: 80,
			}),
		).toEqual([]);
	});

	test('reports every exceeded rendering budget', () => {
		expect(
			renderBudgetViolations({
				fps: 20,
				frameTimeMs: 50,
				drawCalls: 500,
				meshes: 800,
				materials: 150,
			}),
		).toEqual(['fps', 'frameTimeMs', 'drawCalls', 'meshes', 'materials']);
	});
});
