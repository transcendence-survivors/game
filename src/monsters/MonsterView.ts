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

const NAME_OFFSET_PX = -30;
const BOSS_NAME_OFFSET_PX = -42;

const BAR_WIDTH_PX = 68;
const BAR_HEIGHT_PX = 11;
const BOSS_BAR_WIDTH_PX = 140;
const BOSS_BAR_HEIGHT_PX = 17;
const BAR_OFFSET_PX = -12;
const BOSS_BAR_OFFSET_PX = -18;
const BAR_PADDING_PX = 2;
const HEALTH_HEALTHY = '#4ade4a';
const HEALTH_WOUNDED = '#ffb028';
const HEALTH_CRITICAL = '#ff4d4d';

const MODEL_YAW_OFFSET = Math.PI;

const BODY_HIDE_MARGIN = 0.4;
const BODY_SHOW_MARGIN = 1.6;

export class MonsterView {
	private root!: BABYLON.TransformNode;
	private animations = new Map<string, BABYLON.AnimationGroup>();
	private currentAnimation: MonsterAnimation | null = null;
	private target = { x: 0, z: 0, rotationY: 0 };
	private attacking = false;
	private isBoss = false;
	private nameLabel: GUI.TextBlock | null = null;
	private nameAnchor: BABYLON.TransformNode | null = null;
	private healthFrame: GUI.Rectangle | null = null;
	private healthFill: GUI.Rectangle | null = null;
	private lastHealthRatio = -1;
	private childMeshes: BABYLON.AbstractMesh[] | null = null;
	/** Volume englobant approché (cylindre), mesuré une seule fois. */
	private bodyMeasured = false;
	private bodyRadiusXZ = 0;
	private bodyMinY = 0;
	private bodyMaxY = 0;
	private bodyHidden = false;

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
		if (!this.childMeshes) this.childMeshes = this.root.getChildMeshes();
		return this.childMeshes;
	}

	private measureBody() {
		if (this.bodyMeasured) return;
		this.bodyMeasured = true;
		const bounds = this.root.getHierarchyBoundingVectors();
		const position = this.root.position;
		this.bodyRadiusXZ = Math.max(
			bounds.max.x - position.x,
			position.x - bounds.min.x,
			bounds.max.z - position.z,
			position.z - bounds.min.z,
		);
		this.bodyMinY = bounds.min.y - position.y;
		this.bodyMaxY = bounds.max.y - position.y;
	}

	private updateCameraOcclusion(cameraPosition: BABYLON.Vector3) {
		this.measureBody();
		const position = this.root.position;
		const distanceXZ = Math.hypot(
			cameraPosition.x - position.x,
			cameraPosition.z - position.z,
		);
		const margin = this.bodyHidden ? BODY_SHOW_MARGIN : BODY_HIDE_MARGIN;
		const inside =
			distanceXZ < this.bodyRadiusXZ + margin &&
			cameraPosition.y > position.y + this.bodyMinY - margin &&
			cameraPosition.y < position.y + this.bodyMaxY + margin;
		if (inside === this.bodyHidden) return;
		this.bodyHidden = inside;
		for (const mesh of this.getMeshes()) mesh.isVisible = !inside;
	}

	snapTo(x: number, z: number, y: number, rotationY: number) {
		this.target = { x, z, rotationY };
		this.root.position.set(x, y, z);
		this.root.rotation.y = rotationY + MODEL_YAW_OFFSET;
	}

	setTarget(x: number, z: number, rotationY: number) {
		this.target = { x, z, rotationY };
	}

	setAttacking(attacking: boolean) {
		this.attacking = attacking;
	}

	private ensureHeadAnchor(): BABYLON.TransformNode {
		if (this.nameAnchor) return this.nameAnchor;
		this.measureBody();
		const scaleY = this.root.scaling.y || 1;
		this.nameAnchor = new BABYLON.TransformNode(
			`${this.root.name}_headAnchor`,
			this.root.getScene(),
		);
		this.nameAnchor.parent = this.root;
		this.nameAnchor.position.y = this.bodyMaxY / scaleY;
		return this.nameAnchor;
	}

	attachNameplate(ui: GUI.AdvancedDynamicTexture, name: string) {
		const anchor = this.ensureHeadAnchor();
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
		this.nameLabel.linkWithMesh(anchor);
		this.nameLabel.linkOffsetY = this.isBoss
			? BOSS_NAME_OFFSET_PX
			: NAME_OFFSET_PX;
	}

	attachHealthBar(ui: GUI.AdvancedDynamicTexture) {
		const anchor = this.ensureHeadAnchor();
		const width = this.isBoss ? BOSS_BAR_WIDTH_PX : BAR_WIDTH_PX;
		const height = this.isBoss ? BOSS_BAR_HEIGHT_PX : BAR_HEIGHT_PX;
		const radius = Math.round(height / 2);

		this.healthFrame = new GUI.Rectangle(`${this.root.name}_hpFrame`);
		this.healthFrame.width = `${width}px`;
		this.healthFrame.height = `${height}px`;
		this.healthFrame.cornerRadius = radius;
		this.healthFrame.thickness = 1.5;
		this.healthFrame.color = 'rgba(0, 0, 0, 0.85)';
		this.healthFrame.background = 'rgba(15, 15, 18, 0.8)';
		this.healthFrame.paddingLeft = `${BAR_PADDING_PX}px`;
		this.healthFrame.paddingRight = `${BAR_PADDING_PX}px`;
		this.healthFrame.paddingTop = `${BAR_PADDING_PX}px`;
		this.healthFrame.paddingBottom = `${BAR_PADDING_PX}px`;
		this.healthFrame.shadowColor = 'rgba(0, 0, 0, 0.6)';
		this.healthFrame.shadowBlur = 4;
		this.healthFrame.shadowOffsetY = 1;
		ui.addControl(this.healthFrame);
		this.healthFrame.linkWithMesh(anchor);
		this.healthFrame.linkOffsetY = this.isBoss
			? BOSS_BAR_OFFSET_PX
			: BAR_OFFSET_PX;

		this.healthFill = new GUI.Rectangle(`${this.root.name}_hpFill`);
		this.healthFill.height = '100%';
		this.healthFill.width = 1;
		this.healthFill.thickness = 0;
		this.healthFill.cornerRadius = Math.max(1, radius - BAR_PADDING_PX);
		this.healthFill.background = HEALTH_HEALTHY;
		this.healthFill.horizontalAlignment =
			GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
		this.healthFrame.addControl(this.healthFill);
	}

	updateHealth(current: number, max: number) {
		if (!this.healthFill) return;
		const ratio = max > 0 ? Math.min(1, Math.max(0, current / max)) : 0;
		if (Math.abs(ratio - this.lastHealthRatio) < 0.001) return;
		this.lastHealthRatio = ratio;
		this.healthFill.width = ratio;
		this.healthFill.background =
			ratio > 0.5
				? HEALTH_HEALTHY
				: ratio > 0.25
					? HEALTH_WOUNDED
					: HEALTH_CRITICAL;
	}

	getHeadWorldPosition(): BABYLON.Vector3 {
		return this.ensureHeadAnchor().getAbsolutePosition().clone();
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

	update(
		deltaTime: number,
		groundHeight: number,
		cameraPosition: BABYLON.Vector3 | null,
	) {
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
		if (cameraPosition) this.updateCameraOcclusion(cameraPosition);
	}

	dispose() {
		this.nameLabel?.dispose();
		this.healthFill?.dispose();
		this.healthFrame?.dispose();
		this.nameAnchor?.dispose();
		this.animations.forEach((group) => group.dispose());
		this.animations.clear();
		this.root.dispose();
	}
}
