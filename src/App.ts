import { Vector3 } from '@babylonjs/core';
import { GameEngine } from './core/GameEngine';
import { TerrainGenerator } from './world/TerrainGenerator';
import { ChunkManager } from './world/ChunkManager';
import { Player } from './entities/Player';
import { MonsterSpawner } from './entities/MonsterSpawner';
import { Sword } from './entities/Sword';
import { HealthSystem } from './systems/HealthSystem';
import { InputManager } from './systems/InputManager';
import { HUD } from './ui/HUD';
import { HitDetector } from './combat/HitDetector';
import { Vec3 } from './math/Vec3';

const TILE_SIZE = 1;
const PLAYER_MAX_HP = 10_000_000;
const SWORD_DAMAGE = 25;
const SWORD_RANGE = 3.0;
const SWORD_HALF_ANGLE = Math.PI / 3;

export class App {
	private readonly _engine: GameEngine;
	private readonly _input: InputManager;
	private readonly _terrain: TerrainGenerator;
	private readonly _chunks: ChunkManager;
	private readonly _player: Player;
	private readonly _spawner: MonsterSpawner;
	private readonly _health: HealthSystem;
	private readonly _hud: HUD;
	private readonly _sword: Sword;
	private readonly _hitDetector: HitDetector;

	private _isGameOver: boolean = false;

	constructor() {
		const canvas = document.querySelector('#game') as HTMLCanvasElement;
		this._engine = new GameEngine(canvas);
		this._input = new InputManager(canvas);
		this._terrain = new TerrainGenerator(TILE_SIZE);
		this._chunks = new ChunkManager(this._engine.scene, this._terrain, {
			chunkSize: 80,
			viewDistance: 2,
		});

		this._player = new Player(this._engine.scene, this._terrain, this._input, {
			speed: 0.15,
			gravity: -0.015,
			jumpForce: 0.3,
			mouseSensitivity: 0.002,
			tileSize: TILE_SIZE,
			radius: 0.35,
			startPosition: new Vector3(0, 50, 0),
		});

		this._spawner = new MonsterSpawner(this._engine.scene, this._terrain, {
			maxCount: 50,
			spawnIntervalMs: 2,
			minSpawnRadius: 15.0,
			maxSpawnRadius: 100.0,
			width: 0.8,
			height: 1.8,
			radius: 0.7,
			speed: 0.06,
			damage: 5,
			maxHp: 100,
			attackRange: 2.0,
			attackCooldownMs: 1000,
			stoppingDistance: TILE_SIZE * 1.1,
			separationWeight: 1.5,
			flashDurationMs: 150,
		});

		this._health = new HealthSystem(PLAYER_MAX_HP);
		this._hud = new HUD(this._engine.scene);
		this._hud.bindHealth(this._health);

		this._sword = new Sword(this._engine.scene, this._player.bodyAnchor, {
			rootUrl: '/models/',
			fileName: 'sword.obj',
			offset: new Vector3(0.0, 0.0, 1.0),
			restRotation: new Vector3(0, -Math.PI, 0),
			scale: 0.05,
			gripAxis: '-z',
			swingDurationMs: 350,
			// swingFromAngle: -Math.PI / 2 - Math.PI / 3,
			// swingToAngle: -Math.PI / 2 + 2 * Math.PI / 3,

			swingFromAngle: -Math.PI - Math.PI / 3,
			swingToAngle: -Math.PI + Math.PI / 3,
			hitWindowStart: 0.25,
			hitWindowEnd: 0.7,
		});
		void this._sword.load();

		this._hitDetector = new HitDetector({
			range: SWORD_RANGE,
			halfAngleRad: SWORD_HALF_ANGLE,
		});

		this._sword.onHit(() => this._dealSwordDamage());

		this._wireInput();
		this._wireGameOver();
		this._startLoop();
	}

	private _wireInput(): void {
		this._input.onKeyDown((ev) => {
			if (ev.code === 'F3') {
				ev.preventDefault();
				this._player.toggleThirdPerson();
			}
			if (ev.shiftKey && ev.ctrlKey && ev.altKey && ev.code === 'KeyI') {
				this._engine.toggleDebugLayer();
			}
			if (ev.code === 'KeyH') this._health.damage(10);
		});

		this._input.onClick(() => this._input.requestPointerLock());
		this._input.onResize(() => this._engine.resize());
	}

	private _wireGameOver(): void {
		this._health.onDeath(() => {
			this._isGameOver = true;
			this._hud.showGameOver();
			this._input.releasePointerLock();
			this._input.setEnabled(false);
		});
	}

	private _dealSwordDamage(): void {
		const playerPos = this._player.position;
		const forward = this._player.forwardDirection;
		const center = Vec3.of(playerPos.x, playerPos.y, playerPos.z);
		const fwd = Vec3.of(forward.x, forward.y, forward.z);
		const targets = this._spawner.getPositions();
		const hits = this._hitDetector.computeHits(center, fwd, targets);
		this._spawner.damageInRange(hits, SWORD_DAMAGE, performance.now());
	}

	private _startLoop(): void {
		this._engine.run(() => {
			const now = performance.now();
			this._hud.updateFps(this._engine.getFps());
			this._hud.updateEnemyCount(this._spawner.count, this._spawner.max);

			if (this._isGameOver) return;

			const dt = this._engine.getDeltaTime();
			this._player.update();
			this._sword.swing(now);
			this._sword.update(now);
			this._chunks.update(this._player.position.x, this._player.position.z);
			this._spawner.update(dt, now, this._player.position, this._health);
		});
	}
}
