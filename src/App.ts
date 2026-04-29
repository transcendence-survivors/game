import { Vector3 } from '@babylonjs/core';
import { GameEngine } from './core/GameEngine';
import { TerrainGenerator } from './world/TerrainGenerator';
import { ChunkManager } from './world/ChunkManager';
import { Player } from './entities/Player';
import { MonsterSpawner } from './entities/MonsterSpawner';
import { HealthSystem } from './systems/HealthSystem';
import { InputManager } from './systems/InputManager';
import { HUD } from './ui/HUD';

const TILE_SIZE = 1;
const PLAYER_MAX_HP = 10_000_000;

export class App {
	private readonly _engine: GameEngine;
	private readonly _input: InputManager;
	private readonly _terrain: TerrainGenerator;
	private readonly _chunks: ChunkManager;
	private readonly _player: Player;
	private readonly _spawner: MonsterSpawner;
	private readonly _health: HealthSystem;
	private readonly _hud: HUD;

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
			attackRange: 2.0,
			attackCooldownMs: 1000,
			stoppingDistance: TILE_SIZE * 1.1,
			separationWeight: 1.5,
		});

		this._health = new HealthSystem(PLAYER_MAX_HP);
		this._hud = new HUD(this._engine.scene);
		this._hud.bindHealth(this._health);

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

	private _startLoop(): void {
		this._engine.run(() => {
			this._hud.updateFps(this._engine.getFps());
			this._hud.updateEnemyCount(this._spawner.count, this._spawner.max);

			if (this._isGameOver) return;

			const dt = this._engine.getDeltaTime();
			this._player.update();
			this._chunks.update(this._player.position.x, this._player.position.z);
			this._spawner.update(dt, this._player.position, this._health);
		});
	}
}
