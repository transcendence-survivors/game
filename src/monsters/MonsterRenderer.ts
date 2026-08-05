import * as BABYLON from '@babylonjs/core';
import * as GUI from '@babylonjs/gui';
import * as COLYSEUS from '@colyseus/sdk';
import type {
	GameState,
	Monster,
	MonsterDamageEvent,
} from '../../../shared-package';
import { MapGenerator } from '../map/MapGenerator';
import { MonsterAssetLibrary, type MonsterModel } from './MonsterAssetLibrary';
import { MonsterView } from './MonsterView';
import { DamageNumbers } from './DamageNumbers';

const FATAL_HEAD_OFFSET = 4;
const FATAL_BOSS_HEAD_OFFSET = 9;

export class MonsterRenderer {
	private scene!: BABYLON.Scene;
	private room!: COLYSEUS.Room<GameState>;
	private mapGen!: MapGenerator;
	private assets!: MonsterAssetLibrary;
	private nameplateUi!: GUI.AdvancedDynamicTexture;
	private damageNumbers!: DamageNumbers;
	private views = new Map<string, MonsterView>();
	private removedWhileLoading = new Set<string>();

	constructor(
		scene: BABYLON.Scene,
		room: COLYSEUS.Room<GameState>,
		mapGen: MapGenerator,
	) {
		this.scene = scene;
		this.room = room;
		this.mapGen = mapGen;
		this.assets = new MonsterAssetLibrary(scene);
		this.nameplateUi = GUI.AdvancedDynamicTexture.CreateFullscreenUI(
			'monsterNameplates',
			true,
			scene,
		);
		this.damageNumbers = new DamageNumbers(scene, this.nameplateUi);
	}

	listen() {
		const callbacks = COLYSEUS.Callbacks.get(this.room);
		callbacks.onAdd('monsters', (monster, monsterId) => {
			void this.addMonster(monster, monsterId);
		});
		callbacks.onRemove('monsters', (_monster, monsterId) => {
			this.removeMonster(monsterId);
		});
		this.room.onMessage('monsterDamage', (events: MonsterDamageEvent[]) =>
			this.onDamage(events),
		);
	}

	update(deltaTime: number) {
		const cameraPosition = this.scene.activeCamera?.globalPosition ?? null;
		for (const [monsterId, view] of this.views) {
			const { x, z } = view.getPosition();
			view.update(
				deltaTime,
				this.mapGen.getGroundHeight(x, z),
				cameraPosition,
			);
			const monster = this.room.state.monsters.get(monsterId);
			if (monster)
				view.updateHealth(monster.life.current, monster.life.max);
		}
		this.damageNumbers.update(deltaTime);
	}

	private onDamage(events: MonsterDamageEvent[]) {
		for (const event of events) {
			const view = this.views.get(event.id);
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
			const model = await this.assets.instantiate(monster.kind);
			const view = new MonsterView(
				model.root,
				model.animationGroups,
				monster.isBoss,
			);
			if (this.removedWhileLoading.delete(monsterId)) {
				view.dispose();
				return;
			}
			view.snapTo(
				monster.x,
				monster.z,
				this.mapGen.getGroundHeight(monster.x, monster.z),
				monster.rotationY,
			);
			view.getMeshes().forEach((mesh) =>
				this.mapGen.addShadowCaster(mesh),
			);
			view.attachNameplate(this.nameplateUi, monster.kind);
			view.attachHealthBar(this.nameplateUi);
			view.updateHealth(monster.life.current, monster.life.max);
			view.setAttacking(monster.animState === 'attack');
			this.views.set(monsterId, view);
			const callbacks = COLYSEUS.Callbacks.get(this.room);
			callbacks.onChange(monster, () => {
				view.setTarget(monster.x, monster.z, monster.rotationY);
				view.setAttacking(monster.animState === 'attack');
			});
		} catch (error) {
			console.error(`failed to render monster '${monster.kind}'`, error);
		}
	}

	private removeMonster(monsterId: string) {
		const view = this.views.get(monsterId);
		if (!view) {
			this.removedWhileLoading.add(monsterId);
			return;
		}
		view.dispose();
		this.views.delete(monsterId);
	}

	dispose() {
		this.views.forEach((view) => view.dispose());
		this.views.clear();
		this.removedWhileLoading.clear();
		this.damageNumbers.dispose();
		this.assets.dispose();
		this.nameplateUi.dispose();
	}
}
