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
// Le nom est repoussé au-dessus de la barre de vie (voir *_OFFSET_PX).
const NAME_OFFSET_PX = -30;
const BOSS_NAME_OFFSET_PX = -42;

// Barre de vie flottante, juste au-dessus de la tête, sous le nom.
const BAR_WIDTH_PX = 68;
const BAR_HEIGHT_PX = 11;
const BOSS_BAR_WIDTH_PX = 140;
const BOSS_BAR_HEIGHT_PX = 17;
const BAR_OFFSET_PX = -12;
const BOSS_BAR_OFFSET_PX = -18;
const BAR_PADDING_PX = 2; // marge intérieure entre le contour et le remplissage
const HEALTH_HEALTHY = '#4ade4a';
const HEALTH_WOUNDED = '#ffb028';
const HEALTH_CRITICAL = '#ff4d4d';

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
	private healthFrame: GUI.Rectangle | null = null;
	private healthFill: GUI.Rectangle | null = null;
	private lastHealthRatio = -1;

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
	 * Ancrage placé au sommet de la boîte englobante du modèle : nom et barre
	 * de vie s'y accrochent (créé une seule fois, réutilisé).
	 */
	private ensureHeadAnchor(): BABYLON.TransformNode {
		if (this.nameAnchor) return this.nameAnchor;
		const bounds = this.root.getHierarchyBoundingVectors();
		const scaleY = this.root.scaling.y || 1;
		this.nameAnchor = new BABYLON.TransformNode(
			`${this.root.name}_headAnchor`,
			this.root.getScene(),
		);
		this.nameAnchor.parent = this.root;
		this.nameAnchor.position.y =
			(bounds.max.y - this.root.position.y) / scaleY;
		return this.nameAnchor;
	}

	/**
	 * Shows the monster name above its head: the label follows an anchor
	 * placed at the top of the model's bounding box.
	 */
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

	/**
	 * Floating health bar above the monster's head. Its fill is updated from
	 * the server-authoritative life via {@link updateHealth}.
	 */
	attachHealthBar(ui: GUI.AdvancedDynamicTexture) {
		const anchor = this.ensureHeadAnchor();
		const width = this.isBoss ? BOSS_BAR_WIDTH_PX : BAR_WIDTH_PX;
		const height = this.isBoss ? BOSS_BAR_HEIGHT_PX : BAR_HEIGHT_PX;
		const radius = Math.round(height / 2);

		// Contour arrondi + piste sombre, avec ombre portée pour ressortir sur
		// le terrain clair.
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

		// Remplissage arrondi, ancré à gauche, largeur = ratio de PV.
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

	/**
	 * Met la barre à jour depuis les PV synchronisés (champs bruts : les
	 * objets décodés ne portent pas les méthodes du schéma Life). Ne repeint
	 * que lorsque le ratio change réellement.
	 */
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

	/** Position monde du sommet de la tête (pour ancrer les nombres de dégâts). */
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
		this.healthFill?.dispose();
		this.healthFrame?.dispose();
		this.nameAnchor?.dispose();
		this.animations.forEach((group) => group.dispose());
		this.animations.clear();
		this.root.dispose();
	}
}
