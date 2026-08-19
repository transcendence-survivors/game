import * as BABYLON from '@babylonjs/core';

const WALK_FRAME_RATE = 30;
const WALK_CYCLE_FRAMES = 30;
const WALK_SWAY = 0.035;

/** Controls the idle and walk clips for one instantiated player model. */
export interface PlayerAnimationController {
	/** Starts the walk clip and keeps it looping. */
	playWalk(): void;
	/** Starts the idle clip, if the model provides one. */
	playIdle(): void;
	/** Releases all animation groups owned by the model instance. */
	dispose(): void;
}

function findAnimation(
	animationGroups: readonly BABYLON.AnimationGroup[],
	name: string,
): BABYLON.AnimationGroup | undefined {
	return animationGroups.find(
		(group) =>
			group.name.slice(group.name.lastIndexOf(':') + 1).toLowerCase() ===
			name.toLowerCase(),
	);
}

function createProceduralWalkAnimation(
	root: BABYLON.AbstractMesh,
): BABYLON.AnimationGroup {
	const group = new BABYLON.AnimationGroup(
		`${root.name}:proceduralWalk`,
		root.getScene(),
	);
	const sway = new BABYLON.Animation(
		`${root.name}:walkSway`,
		'rotation.z',
		WALK_FRAME_RATE,
		BABYLON.Animation.ANIMATIONTYPE_FLOAT,
		BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE,
	);
	sway.setKeys([
		{ frame: 0, value: -WALK_SWAY },
		{ frame: WALK_CYCLE_FRAMES / 2, value: WALK_SWAY },
		{ frame: WALK_CYCLE_FRAMES, value: -WALK_SWAY },
	]);
	group.addTargetedAnimation(sway, root);
	return group;
}

class PlayerAnimationControllerImpl implements PlayerAnimationController {
	private current: BABYLON.AnimationGroup | null = null;
	private readonly walk: BABYLON.AnimationGroup;
	private readonly idle: BABYLON.AnimationGroup | undefined;
	private readonly groups: ReadonlySet<BABYLON.AnimationGroup>;

	constructor(
		walk: BABYLON.AnimationGroup,
		idle: BABYLON.AnimationGroup | undefined,
		animationGroups: readonly BABYLON.AnimationGroup[],
	) {
		this.walk = walk;
		this.idle = idle;
		this.groups = new Set([
			...animationGroups,
			walk,
			...(idle ? [idle] : []),
		]);
	}

	playWalk(): void {
		if (this.current === this.walk && this.walk.isPlaying) return;
		this.stopCurrent();
		this.walk.play(true);
		this.current = this.walk;
	}

	playIdle(): void {
		if (!this.idle || this.current === this.idle) {
			if (!this.idle) this.stopCurrent();
			return;
		}
		this.stopCurrent();
		this.idle.play(false);
		this.current = this.idle;
	}

	dispose(): void {
		this.stopCurrent();
		this.groups.forEach((group) => group.dispose());
	}

	private stopCurrent(): void {
		this.current?.stop();
		this.current = null;
	}
}

/**
 * Selects the library's real walk and idle clips, with a procedural fallback
 * for older or minimal player assets that do not contain those clips.
 */
export function createPlayerAnimationController(
	root: BABYLON.AbstractMesh,
	animationGroups: readonly BABYLON.AnimationGroup[],
): PlayerAnimationController {
	const walk =
		findAnimation(animationGroups, 'Walk_Loop') ??
		findAnimation(animationGroups, 'Walk_Carry_Loop') ??
		findAnimation(animationGroups, 'Walk_Formal_Loop') ??
		animationGroups.find((group) => /^walk/i.test(group.name)) ??
		animationGroups.find((group) => /walk/i.test(group.name)) ??
		animationGroups[0] ??
		createProceduralWalkAnimation(root);
	const idle =
		findAnimation(animationGroups, 'Idle_No_Loop') ??
		findAnimation(animationGroups, 'Idle_Rail_Loop') ??
		animationGroups.find((group) => /^idle.*loop/i.test(group.name));

	return new PlayerAnimationControllerImpl(walk, idle, animationGroups);
}
