import * as BABYLON from '@babylonjs/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	animationTransitionDelay,
	loopedAnimationFrame,
	MONSTER_ANIMATION_INTERVAL_S,
	MonsterView,
	normalizeAnimationName,
	semanticAnimationName,
} from './MonsterView';
import { MONSTER_GROUND_HEIGHT_INTERVAL_S } from './MonsterPresentation';

let engine: BABYLON.NullEngine;
let scene: BABYLON.Scene;

beforeEach(() => {
	engine = new BABYLON.NullEngine();
	scene = new BABYLON.Scene(engine);
});

afterEach(() => engine.dispose());

describe('normalizeAnimationName', () => {
	it.each([
		['walk', 'walk'],
		['skitter_walk', 'walk'],
		['skitter:walk', 'walk'],
		['monster:rig_Attack', 'attack'],
	])('normalizes %s', (name, expected) => {
		expect(normalizeAnimationName(name)).toBe(expected);
	});
});

describe('semanticAnimationName', () => {
	it.each([
		['Bite_Front', 'attack'],
		['Punch', 'attack'],
		['Run', 'walk'],
		['Flying_Idle', 'idle'],
		['Walk', 'walk'],
	])('maps %s to %s', (name, expected) => {
		expect(semanticAnimationName(name)).toBe(expected);
	});
});

describe('loopedAnimationFrame', () => {
	it('seeks a looping clip from the shared animation time', () => {
		expect(loopedAnimationFrame(10, 40, 30, 0.5)).toBe(25);
		expect(loopedAnimationFrame(10, 40, 30, 1.5)).toBe(25);
		expect(loopedAnimationFrame(10, 10, 30, 4)).toBe(10);
	});
});

describe('animationTransitionDelay', () => {
	it('debounces only transitions that leave an attack', () => {
		expect(animationTransitionDelay('attack', 'walk')).toBe(0.35);
		expect(animationTransitionDelay('walk', 'attack')).toBe(0);
		expect(animationTransitionDelay('walk', 'idle')).toBe(0);
	});
});

describe('MonsterView update cadence', () => {
	it('refreshes terrain height at the network cadence', () => {
		const view = createView();

		expect(
			view.shouldRefreshGroundHeight(
				MONSTER_GROUND_HEIGHT_INTERVAL_S * 0.5,
			),
		).toBe(false);
		expect(
			view.shouldRefreshGroundHeight(
				MONSTER_GROUND_HEIGHT_INTERVAL_S * 0.5,
			),
		).toBe(true);

		view.dispose();
	});

	it('keeps a paused animation sampler between render frames', () => {
		const root = new BABYLON.TransformNode('monster', scene);
		const child = new BABYLON.TransformNode('bone', scene);
		child.parent = root;
		const animation = new BABYLON.Animation(
			'rotation',
			'rotation.x',
			30,
			BABYLON.Animation.ANIMATIONTYPE_FLOAT,
			BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE,
		);
		animation.setKeys([
			{ frame: 0, value: 0 },
			{ frame: 30, value: 1 },
		]);
		const group = new BABYLON.AnimationGroup('idle', scene);
		group.addTargetedAnimation(animation, child);
		const view = new MonsterView(
			root,
			[group],
			new Map(),
			'grunt',
			false,
			'idle',
			0,
			0,
			new BABYLON.StandardMaterial('monsterMaterial', scene),
			new BABYLON.StandardMaterial('monsterDamageMaterial', scene),
		);

		expect(group.isStarted).toBe(true);
		expect(group.animatables).toHaveLength(1);
		view.update(MONSTER_ANIMATION_INTERVAL_S * 2, null, 0.5);
		expect(child.rotation.x).toBeCloseTo(0.5, 4);
		expect(group.isStarted).toBe(true);
		expect(group.animatables).toHaveLength(1);

		view.dispose();
	});

	it('plays the Death clip once and holds its final frame', () => {
		const root = new BABYLON.TransformNode('dying-monster', scene);
		const bone = new BABYLON.TransformNode('death-bone', scene);
		bone.parent = root;
		const animation = new BABYLON.Animation(
			'death-rotation',
			'rotation.x',
			30,
			BABYLON.Animation.ANIMATIONTYPE_FLOAT,
			BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE,
		);
		animation.setKeys([
			{ frame: 0, value: 0 },
			{ frame: 30, value: 1 },
		]);
		const group = new BABYLON.AnimationGroup('Death', scene);
		group.addTargetedAnimation(animation, bone);
		const view = new MonsterView(
			root,
			[group],
			new Map(),
			'grunt',
			false,
			'idle',
			0,
			0,
			new BABYLON.StandardMaterial('death-material', scene),
			new BABYLON.StandardMaterial('death-damage-material', scene),
		);

		expect(view.startDeath()).toBeCloseTo(1);
		view.update(0.5, null, 0);
		expect(bone.rotation.x).toBeCloseTo(0.5, 4);
		expect(view.isDeathComplete()).toBe(false);
		view.update(0.6, null, 0);
		expect(bone.rotation.x).toBeCloseTo(1, 4);
		expect(view.isDeathComplete()).toBe(true);
		view.update(1, null, 0);
		expect(bone.rotation.x).toBeCloseTo(1, 4);

		view.dispose();
	});

	it('clears a damage flash after an offscreen interval', () => {
		const root = new BABYLON.TransformNode('flashed-monster', scene);
		const mesh = BABYLON.MeshBuilder.CreateBox(
			'flashed-monster-body',
			{ size: 1 },
			scene,
		);
		mesh.parent = root;
		const originalMaterial = new BABYLON.StandardMaterial(
			'flash-original-material',
			scene,
		);
		mesh.material = originalMaterial;
		const damageMaterial = new BABYLON.StandardMaterial(
			'flash-damage-material',
			scene,
		);
		const otherRoot = new BABYLON.TransformNode(
			'other-flashed-monster',
			scene,
		);
		const otherMesh = BABYLON.MeshBuilder.CreateBox(
			'other-flashed-monster-body',
			{ size: 1 },
			scene,
		);
		otherMesh.parent = otherRoot;
		otherMesh.material = originalMaterial;
		const view = new MonsterView(
			root,
			[],
			new Map(),
			'grunt',
			false,
			'idle',
			0,
			0,
			new BABYLON.StandardMaterial('flash-hitbox-material', scene),
			damageMaterial,
		);
		const otherView = new MonsterView(
			otherRoot,
			[],
			new Map(),
			'grunt',
			false,
			'idle',
			0,
			0,
			new BABYLON.StandardMaterial('other-flash-hitbox-material', scene),
			damageMaterial,
		);

		view.flashDamage();
		expect(mesh.material).toBe(damageMaterial);
		expect(otherMesh.material).toBe(originalMaterial);
		view.setRenderEnabled(false);
		view.updateOffscreen(1);
		expect(mesh.material).toBe(originalMaterial);

		view.dispose();
		otherView.dispose();
	});

	it('does not update the Babylon hierarchy while culled', () => {
		const root = new BABYLON.TransformNode('culled-monster', scene);
		const view = new MonsterView(
			root,
			[],
			new Map(),
			'grunt',
			false,
			'idle',
			0,
			0,
			new BABYLON.StandardMaterial('culled-monster-material', scene),
			new BABYLON.StandardMaterial(
				'culled-monster-damage-material',
				scene,
			),
		);
		view.setTarget(10, 20, 0.5);
		view.setRenderEnabled(false);
		view.update(1, null, 1);

		expect(root.position.x).toBe(0);
		expect(root.position.z).toBe(0);
		expect(root.isEnabled()).toBe(false);

		view.setRenderEnabled(true);
		view.update(0, null, 1);
		expect(root.position.x).toBe(10);
		expect(root.position.z).toBe(20);
		expect(root.isEnabled()).toBe(true);

		view.dispose();
	});
});

function createView(): MonsterView {
	return new MonsterView(
		new BABYLON.TransformNode('monster', scene),
		[],
		new Map(),
		'grunt',
		false,
		'idle',
		0,
		0,
		new BABYLON.StandardMaterial('monsterMaterial', scene),
		new BABYLON.StandardMaterial('monsterDamageMaterial', scene),
	);
}
