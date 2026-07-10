import * as BABYLON from '@babylonjs/core';
import * as GUI from '@babylonjs/gui';

export type MonsterAnimation = 'idle' | 'walk' | 'attack';

const LERP_SPEED = 10;
const BOSS_SCALE = 2.5;
const MOVE_EPSILON = 0.05;
const NAME_FONT_SIZE = 14;
const NAME_COLOR = 'white';
const BOSS_NAME_FONT_SIZE = 20;
const BOSS_NAME_COLOR = '#ff5544';
const NAME_OFFSET_PX = -10;
// The monster glb models face -Z while the game convention (and the yaw
// sent by the server) faces +Z, so the visual is turned by half a turn.
const MODEL_YAW_OFFSET = Math.PI;

/**
 * Visual side of a single monster: owns its mesh instance and animation
 * groups, follows the server position with the same interpolation as
 * remote players, and picks walk/idle from its own movement.
 */
export class MonsterView {
	private root!: BABYLON.TransformNode;
	private animations = new Map<string, BABYLON.AnimationGroup>();
	private currentAnimation: MonsterAnimation | null = null;
	private target = { x: 0, z: 0, rotationY: 0 };
	private attacking = false;
	private isBoss = false;
	private nameLabel: GUI.TextBlock | null = null;
	private nameAnchor: BABYLON.TransformNode | null = null;

	constructor(
		root: BABYLON.TransformNode,
		animationGroups: BABYLON.AnimationGroup[],
		isBoss: boolean,
	) {
		this.root = root;
		this.isBoss = isBoss;
		this.root.rotationQuaternion = null;
		if (isBoss) {
			this.root.scaling = this.root.scaling.scale(BOSS_SCALE);
		}
		for (const group of animationGroups) {
			const name = group.name.split('_').pop() ?? group.name;
			this.animations.set(name.toLowerCase(), group);
		}
		this.play('idle');
	}

	getMeshes(): BABYLON.AbstractMesh[] {
		return this.root.getChildMeshes();
	}

	snapTo(x: number, z: number, y: number, rotationY: number) {
		this.target = { x, z, rotationY };
		this.root.position.set(x, y, z);
		this.root.rotation.y = rotationY + MODEL_YAW_OFFSET;
	}

	setTarget(x: number, z: number, rotationY: number) {
		this.target = { x, z, rotationY };
	}

	/** Server-driven attack state; overrides the walk/idle selection. */
	setAttacking(attacking: boolean) {
		this.attacking = attacking;
	}

	/**
	 * Shows the monster name above its head: the label follows an anchor
	 * placed at the top of the model's bounding box.
	 */
	attachNameplate(ui: GUI.AdvancedDynamicTexture, name: string) {
		const bounds = this.root.getHierarchyBoundingVectors();
		const scaleY = this.root.scaling.y || 1;
		this.nameAnchor = new BABYLON.TransformNode(
			`${name}_nameAnchor`,
			this.root.getScene(),
		);
		this.nameAnchor.parent = this.root;
		this.nameAnchor.position.y =
			(bounds.max.y - this.root.position.y) / scaleY;
		this.nameLabel = new GUI.TextBlock(
			`${name}_nameLabel`,
			name.charAt(0).toUpperCase() + name.slice(1),
		);
		this.nameLabel.color = this.isBoss ? BOSS_NAME_COLOR : NAME_COLOR;
		this.nameLabel.fontSize = this.isBoss
			? BOSS_NAME_FONT_SIZE
			: NAME_FONT_SIZE;
		this.nameLabel.outlineColor = 'black';
		this.nameLabel.outlineWidth = 3;
		this.nameLabel.resizeToFit = true;
		ui.addControl(this.nameLabel);
		this.nameLabel.linkWithMesh(this.nameAnchor);
		this.nameLabel.linkOffsetY = NAME_OFFSET_PX;
	}

	getPosition(): BABYLON.Vector3 {
		return this.root.position;
	}

	play(animation: MonsterAnimation, loop: boolean = true) {
		if (this.currentAnimation === animation) return;
		const group = this.animations.get(animation);
		if (!group) return;
		this.animations.get(this.currentAnimation ?? '')?.stop();
		group.play(loop);
		this.currentAnimation = animation;
	}

	update(deltaTime: number, groundHeight: number) {
		const lerpFactor = Math.min(1, deltaTime * LERP_SPEED);
		const position = this.root.position;
		const distance = Math.hypot(
			this.target.x - position.x,
			this.target.z - position.z,
		);
		position.x = BABYLON.Scalar.Lerp(position.x, this.target.x, lerpFactor);
		position.z = BABYLON.Scalar.Lerp(position.z, this.target.z, lerpFactor);
		position.y = groundHeight;
		this.root.rotation.y = BABYLON.Scalar.LerpAngle(
			this.root.rotation.y,
			this.target.rotationY + MODEL_YAW_OFFSET,
			lerpFactor,
		);
		if (this.attacking) this.play('attack');
		else this.play(distance > MOVE_EPSILON ? 'walk' : 'idle');
	}

	dispose() {
		this.nameLabel?.dispose();
		this.nameAnchor?.dispose();
		this.animations.forEach((group) => group.dispose());
		this.animations.clear();
		this.root.dispose();
	}
}
