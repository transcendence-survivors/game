import * as BABYLON from '@babylonjs/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	applyStaticAnimationPose,
	extractStaticAnimationPoses,
	removeGloballyRedundantTransformAnimations,
} from './AnimationOptimization';

describe('animation channel optimization', () => {
	let engine: BABYLON.NullEngine;
	let scene: BABYLON.Scene;

	beforeEach(() => {
		engine = new BABYLON.NullEngine();
		scene = new BABYLON.Scene(engine);
	});

	afterEach(() => engine.dispose());

	it('removes a transform that is redundant in every clip', () => {
		const node = new BABYLON.TransformNode('node', scene);
		const groups = ['idle', 'walk'].map((name) => {
			const group = new BABYLON.AnimationGroup(name, scene);
			group.addTargetedAnimation(
				scalingAnimation(
					new BABYLON.Vector3(1, 1, 1),
					new BABYLON.Vector3(1, 1, 1),
				),
				node,
			);
			return group;
		});

		expect(removeGloballyRedundantTransformAnimations(groups)).toBe(2);
		expect(groups.every((group) => !group.targetedAnimations.length)).toBe(
			true,
		);
	});

	it('keeps a base-pose channel when another clip animates it', () => {
		const node = new BABYLON.TransformNode('node', scene);
		const idle = new BABYLON.AnimationGroup('idle', scene);
		idle.addTargetedAnimation(
			scalingAnimation(
				new BABYLON.Vector3(1, 1, 1),
				new BABYLON.Vector3(1, 1, 1),
			),
			node,
		);
		const walk = new BABYLON.AnimationGroup('walk', scene);
		walk.addTargetedAnimation(
			scalingAnimation(
				new BABYLON.Vector3(1, 1, 1),
				new BABYLON.Vector3(1.1, 1, 1),
			),
			node,
		);

		expect(removeGloballyRedundantTransformAnimations([idle, walk])).toBe(
			0,
		);
		expect(idle.targetedAnimations).toHaveLength(1);
		expect(walk.targetedAnimations).toHaveLength(1);
	});

	it('replaces a clip-local constant channel with a static pose', () => {
		const node = new BABYLON.TransformNode('node', scene);
		const group = new BABYLON.AnimationGroup('idle', scene);
		group.addTargetedAnimation(
			scalingAnimation(
				new BABYLON.Vector3(1, 1, 1),
				new BABYLON.Vector3(1, 1, 1),
			),
			node,
		);

		const poses = extractStaticAnimationPoses([group]);
		node.scaling.setAll(2);
		applyStaticAnimationPose(poses.get(group));

		expect(group.targetedAnimations).toHaveLength(0);
		expect(node.scaling.asArray()).toEqual([1, 1, 1]);
	});

	it('preserves changing transforms and extracts constant quaternions', () => {
		const node = new BABYLON.TransformNode('node', scene);
		node.rotationQuaternion = BABYLON.Quaternion.Identity();
		const group = new BABYLON.AnimationGroup('walk', scene);
		group.addTargetedAnimation(
			scalingAnimation(
				new BABYLON.Vector3(1, 1, 1),
				new BABYLON.Vector3(1.1, 1, 1),
			),
			node,
		);
		group.addTargetedAnimation(quaternionAnimation(), node);

		const poses = extractStaticAnimationPoses([group]);

		expect(group.targetedAnimations).toHaveLength(1);
		expect(poses.get(group)).toHaveLength(1);
	});
});

function scalingAnimation(
	from: BABYLON.Vector3,
	to: BABYLON.Vector3,
): BABYLON.Animation {
	const animation = new BABYLON.Animation(
		'scaling',
		'scaling',
		30,
		BABYLON.Animation.ANIMATIONTYPE_VECTOR3,
		BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE,
	);
	animation.setKeys([
		{ frame: 0, value: from },
		{ frame: 30, value: to },
	]);
	return animation;
}

function quaternionAnimation(): BABYLON.Animation {
	const animation = new BABYLON.Animation(
		'rotation',
		'rotationQuaternion',
		30,
		BABYLON.Animation.ANIMATIONTYPE_QUATERNION,
		BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE,
	);
	animation.setKeys([
		{ frame: 0, value: BABYLON.Quaternion.Identity() },
		{ frame: 30, value: BABYLON.Quaternion.Identity() },
	]);
	return animation;
}
