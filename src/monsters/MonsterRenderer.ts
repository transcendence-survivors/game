import * as BABYLON from '@babylonjs/core';
import * as GUI from '@babylonjs/gui';
import * as COLYSEUS from '@colyseus/sdk';
import {
	ServerMessage,
	type GameState,
	type Monster,
	type MonsterDamageEvent,
} from '../../../shared-package';
import { MapGenerator } from '../map/MapGenerator';
import { ModelAssetLibrary } from '../assets/ModelAssetLibrary';
import { MonsterView } from './MonsterView';
import { DamageNumbers } from './DamageNumbers';
import { models, type MonsterGLB } from '../assets/models';
import { preserveWorldDepthForDebug } from '../combat/DebugRenderingGroups';
import { AsyncViewRegistry } from '../combat/AsyncViewRegistry';

const FATAL_HEAD_OFFSET = 4;
const FATAL_BOSS_HEAD_OFFSET = 9;

export class MonsterRenderer {
	private scene!: BABYLON.Scene;
	private room!: COLYSEUS.Room<GameState>;
	private mapGen!: MapGenerator;
	private assets!: ModelAssetLibrary;
	private nameplateUi!: GUI.AdvancedDynamicTexture;
	private damageNumbers!: DamageNumbers;
	private hitboxMaterial: BABYLON.StandardMaterial;
	private hitboxesVisible = false;
	private views = new AsyncViewRegistry<MonsterView>();

	constructor(
		scene: BABYLON.Scene,
		room: COLYSEUS.Room<GameState>,
		mapGen: MapGenerator,
	) {
		this.scene = scene;
		this.room = room;
		this.mapGen = mapGen;
		this.assets = new ModelAssetLibrary(scene);
		preserveWorldDepthForDebug(scene);
		this.hitboxMaterial = new BABYLON.StandardMaterial(
			'monsterHitboxMaterial',
			scene,
		);
		this.hitboxMaterial.disableLighting = true;
		this.hitboxMaterial.emissiveColor.set(1, 0.04, 0.02);
		this.hitboxMaterial.alpha = 0.9;
		this.hitboxMaterial.backFaceCulling = false;
		this.hitboxMaterial.wireframe = true;
		// Le debug ne doit pas remplacer la profondeur du décor utilisée par le
		// post-process radial, sinon ses grands volumes teintent toute l'image.
		this.hitboxMaterial.disableDepthWrite = true;
		this.nameplateUi = GUI.AdvancedDynamicTexture.CreateFullscreenUI(
			'monsterNameplates',
			true,
			scene,
		);
		this.damageNumbers = new DamageNumbers(scene, this.nameplateUi);
	}

	setHitboxesVisible(visible: boolean) {
		this.hitboxesVisible = visible;
		this.views.forEach((view) => view.setHitboxVisible(visible));
	}

	listen() {
		const callbacks = COLYSEUS.Callbacks.get(this.room);
		callbacks.onAdd('monsters', (monster, monsterId) => {
			void this.addMonster(monster, monsterId);
		});
		callbacks.onRemove('monsters', (_monster, monsterId) => {
			this.removeMonster(monsterId);
		});
		this.room.onMessage(
			ServerMessage.MonsterDamage,
			(events: MonsterDamageEvent[]) => this.onDamage(events),
		);
	}

	update(deltaTime: number) {
		const cameraPosition = this.scene.activeCamera?.globalPosition ?? null;
		this.views.forEach((view, monsterId) => {
			const { x, z } = view.getPosition();
			view.update(
				deltaTime,
				this.mapGen.getGroundHeight(x, z),
				cameraPosition,
				this.room.state.combatTimeS,
			);
			const monster = this.room.state.monsters.get(monsterId);
			if (monster)
				view.updateHealth(monster.life.current, monster.life.max);
		});
		this.damageNumbers.update(deltaTime);
	}

	private onDamage(events: MonsterDamageEvent[]) {
		for (const event of events) {
			const view = this.views.get(event.id);
			view?.flashDamage();
			const position = view
				? view.getHeadWorldPosition()
				: new BABYLON.Vector3(
						event.x,
						event.y +
							(event.isBoss
								? FATAL_BOSS_HEAD_OFFSET
								: FATAL_HEAD_OFFSET),
						event.z,
					);
			this.damageNumbers.spawn(
				position,
				event.amount,
				event.isBoss,
				event.fatal,
			);
		}
	}

	private async addMonster(monster: Monster, monsterId: string) {
		try {
			await this.views.add(monsterId, async () => {
				const model = await this.assets.instantiate(
					models.monster[monster.kind as MonsterGLB],
					monster.kind,
				);
				model.animationGroups.forEach((animation) => animation.stop());
				const view = new MonsterView(
					model.root,
					model.animationGroups,
					monster.kind,
					monster.isBoss,
					this.hitboxMaterial,
				);
				view.snapTo(
					monster.x,
					monster.z,
					this.mapGen.getGroundHeight(monster.x, monster.z),
					monster.rotationY,
				);
				view.getMeshes().forEach((mesh) =>
					this.mapGen.prepareRenderable(mesh),
				);
				view.attachNameplate(this.nameplateUi, monster.kind);
				view.attachHealthBar(this.nameplateUi);
				view.updateHealth(monster.life.current, monster.life.max);
				view.setAnimationState(monster.animState);
				view.setHitboxVisible(this.hitboxesVisible);
				return view;
			});
			const view = this.views.get(monsterId);
			if (!view) return;
			const callbacks = COLYSEUS.Callbacks.get(this.room);
			callbacks.onChange(monster, () => {
				view.setTarget(monster.x, monster.z, monster.rotationY);
				view.setAnimationState(monster.animState);
			});
		} catch (error) {
			console.error(`failed to render monster '${monster.kind}'`, error);
		}
	}

	private removeMonster(monsterId: string) {
		this.views.remove(monsterId);
	}

	dispose() {
		this.views.dispose();
		this.damageNumbers.dispose();
		this.assets.dispose();
		this.hitboxMaterial.dispose();
		this.nameplateUi.dispose();
	}
}
