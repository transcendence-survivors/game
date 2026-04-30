import { Vector3 } from "@babylonjs/core";
import { GameEngine } from "./core/GameEngine";
import { ChunkManager } from "./world/ChunkManager";
import { Player } from "./entities/Player";
import { MonsterSpawner } from "./entities/MonsterSpawner";
import { Sword } from "./entities/Sword";
import { InputManager } from "./systems/InputManager";
import { HUD } from "./ui/HUD";
import {
  TerrainGenerator,
  HealthSystem,
  HitDetector,
  Vec3,
  DifficultyCurve,
  MonsterCatalog,
} from "@transcendence/game-shared";
import type { MonsterType } from "@transcendence/game-shared";
import { NetworkClient } from "./network/NetworkClient";

const { VITE_GAME_SOCKET_URL } = import.meta.env;

const SERVER_URL = VITE_GAME_SOCKET_URL;

const TILE_SIZE = 1;
const PLAYER_MAX_HP = 100;
const SWORD_DAMAGE = 25;
const SWORD_RANGE = 3.0;
const SWORD_HALF_ANGLE = Math.PI / 3;
const INITIAL_VIEW_DISTANCE = 10;

type GameState = "menu" | "loading" | "playing" | "paused" | "gameover";

const MONSTER_TYPES: MonsterType[] = [
  {
    id: "goblin",
    color: { r: 1, g: 0.5, b: 0 },
    maxHp: 100,
    damage: 5,
    speed: 0.06,
    width: 0.8,
    height: 1.8,
    radius: 0.7,
    attackRange: 2.0,
    attackCooldownMs: 1000,
    spawnWeight: 1.0,
  },
  {
    id: "wolf",
    color: { r: 0.4, g: 0.5, b: 0.7 },
    maxHp: 60,
    damage: 8,
    speed: 0.1,
    width: 0.6,
    height: 1.0,
    radius: 0.5,
    attackRange: 1.6,
    attackCooldownMs: 800,
    spawnWeight: 0.6,
  },
  {
    id: "orc",
    color: { r: 0.7, g: 0.2, b: 0.2 },
    maxHp: 250,
    damage: 12,
    speed: 0.045,
    width: 1.0,
    height: 2.2,
    radius: 0.85,
    attackRange: 2.4,
    attackCooldownMs: 1200,
    spawnWeight: 0.3,
  },
  {
    id: "demon",
    color: { r: 0.6, g: 0.2, b: 0.8 },
    maxHp: 500,
    damage: 18,
    speed: 0.07,
    width: 1.2,
    height: 2.5,
    radius: 1.0,
    attackRange: 2.6,
    attackCooldownMs: 1300,
    spawnWeight: 0.15,
  },
];

export class App {
  private readonly _engine: GameEngine;
  private readonly _input: InputManager;
  private readonly _hud: HUD;
  private readonly _network: NetworkClient;

  private _state: GameState = "menu";
  private _currentRunId: string | null = null;

  private _terrain?: TerrainGenerator;
  private _chunks?: ChunkManager;
  private _player?: Player;
  private _spawner?: MonsterSpawner;
  private _sword?: Sword;
  private _health?: HealthSystem;
  private _hitDetector?: HitDetector;

  private _gameStartMs: number = 0;
  private _loadingStartMs: number = 0;
  private _pauseStartedMs: number | null = null;
  private _totalPausedMs: number = 0;

  constructor() {
    const canvas = document.querySelector("#game") as HTMLCanvasElement;
    this._engine = new GameEngine(canvas);
    this._input = new InputManager(canvas);
    this._hud = new HUD(this._engine.scene);
    this._network = new NetworkClient(SERVER_URL);

    void this._network.connect().then((ok) => {
      this._hud.setNetworkStatus(ok ? "online" : "offline");
    });

    setInterval(() => {
      void this._tickPing();
    }, 250);

    this._hud.onStartGame(() => {
      void this._startNewGame();
    });
    this._hud.onResume(() => this._togglePause());
    this._hud.onRestart(() => window.location.reload());

    this._wireInput();
    this._engine.run(() => this._renderTick());
    this._hud.showMainMenu();
  }

  private _wireInput(): void {
    this._input.onKeyDown((ev) => {
      if (this._state !== "playing" && this._state !== "paused") return;
      if (ev.code === "F3") {
        ev.preventDefault();
        this._player?.toggleThirdPerson();
      }
      if (ev.shiftKey && ev.ctrlKey && ev.altKey && ev.code === "KeyI") {
        this._engine.toggleDebugLayer();
      }
      if (ev.code === "KeyH") this._health?.damage(10);
      if (ev.code === "KeyP") this._togglePause();
    });

    this._input.onClick(() => {
      if (this._state === "playing") this._input.requestPointerLock();
    });
    this._input.onResize(() => this._engine.resize());
  }

  private async _startNewGame(): Promise<void> {
    this._state = "loading";
    this._hud.hideMainMenu();
    this._hud.showLoadingScreen();
    this._loadingStartMs = performance.now();

    if (this._network.isConnected) {
      const started = await this._network.startRun();
      this._currentRunId = started?.runId ?? null;
    }

    this._terrain = new TerrainGenerator(TILE_SIZE);
    this._chunks = new ChunkManager(this._engine.scene, this._terrain, {
      chunkSize: 80,
      viewDistance: 10,
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

    const curve = new DifficultyCurve({
      baseMaxMonsters: 5,
      monstersPerMinute: 15,
      hardCapMonsters: 80,
      baseSpawnIntervalMs: 2000,
      minSpawnIntervalMs: 200,
      spawnIntervalDecayPerSecondMs: 8,
      unlocks: [
        { typeId: "goblin", timeMs: 0 },
        { typeId: "wolf", timeMs: 30_000 },
        { typeId: "orc", timeMs: 90_000 },
        { typeId: "demon", timeMs: 180_000 },
      ],
    });
    const catalog = new MonsterCatalog(MONSTER_TYPES);

    this._spawner = new MonsterSpawner(
      this._engine.scene,
      this._terrain,
      {
        minSpawnRadius: 15.0,
        maxSpawnRadius: 100.0,
        flashDurationMs: 150,
        behavior: { stoppingDistance: TILE_SIZE * 1.1, separationWeight: 1.5 },
      },
      curve,
      catalog,
    );

    this._health = new HealthSystem(PLAYER_MAX_HP);
    this._hud.bindHealth(this._health);

    this._sword = new Sword(this._engine.scene, this._player.bodyAnchor, {
      rootUrl: "/models/",
      fileName: "sword.obj",
      offset: new Vector3(0.0, 0.0, 1.0),
      restRotation: new Vector3(0, -Math.PI, 0),
      scale: 0.05,
      gripAxis: "-z",
      swingDurationMs: 350,
      swingFromAngle: -Math.PI - Math.PI / 3,
      swingToAngle: -Math.PI + Math.PI / 3,
      hitWindowStart: 0.25,
      hitWindowEnd: 0.7,
    });

    this._hitDetector = new HitDetector({
      range: SWORD_RANGE,
      halfAngleRad: SWORD_HALF_ANGLE,
    });

    this._sword.onHit(() => this._dealSwordDamage());
    this._health.onDeath(() => this._onPlayerDeath());

    const totalChunks = (2 * INITIAL_VIEW_DISTANCE + 1) ** 2;
    const totalSteps = totalChunks + 1;
    let stepsDone = 0;

    await this._chunks.preGenerate(
      this._player.position.x,
      this._player.position.z,
      INITIAL_VIEW_DISTANCE,
      () => {
        stepsDone++;
        this._hud.updateLoadingProgress(stepsDone / totalSteps);
      },
    );
    await this._sword.load();
    stepsDone++;
    this._hud.updateLoadingProgress(stepsDone / totalSteps);

    this._hud.hideLoadingScreen();
    this._hud.setGameplayUiVisible(true);
    this._gameStartMs = performance.now();
    this._totalPausedMs = 0;
    this._pauseStartedMs = null;
    this._state = "playing";
  }

  private _togglePause(): void {
    if (this._state === "gameover") return;
    if (this._state === "playing") {
      this._state = "paused";
      this._hud.setPaused(true);
      this._input.setPaused(true);
      this._pauseStartedMs = performance.now();
      this._input.releasePointerLock();
    } else if (this._state === "paused") {
      this._state = "playing";
      this._hud.setPaused(false);
      this._input.setPaused(false);
      if (this._pauseStartedMs !== null) {
        this._totalPausedMs += performance.now() - this._pauseStartedMs;
        this._pauseStartedMs = null;
      }
      this._input.requestPointerLock();
    }
  }

  private _onPlayerDeath(): void {
    this._state = "gameover";
    this._hud.showGameOver();
    this._input.releasePointerLock();
    this._input.setEnabled(false);

    if (this._network.isConnected && this._currentRunId) {
      const survivedMs = this._elapsedGameMs(performance.now());
      void this._network.reportRun({
        score: Math.floor(survivedMs / 1000),
        survivedMs,
      });
    }
  }

  private _dealSwordDamage(): void {
    if (!this._player || !this._spawner || !this._hitDetector) return;
    const playerPos = this._player.position;
    const forward = this._player.forwardDirection;
    const center = Vec3.of(playerPos.x, playerPos.y, playerPos.z);
    const fwd = Vec3.of(forward.x, forward.y, forward.z);
    const targets = this._spawner.getPositions();
    const hits = this._hitDetector.computeHits(center, fwd, targets);
    this._spawner.damageInRange(hits, SWORD_DAMAGE, performance.now());
  }

  private async _tickPing(): Promise<void> {
    if (!this._network.isConnected) {
      this._hud.updatePing(null);
      return;
    }
    const latency = await this._network.ping();
    this._hud.updatePing(latency);
  }

  private _elapsedGameMs(now: number): number {
    let pausedDeduction = this._totalPausedMs;
    if (this._pauseStartedMs !== null) {
      pausedDeduction += now - this._pauseStartedMs;
    }
    return now - this._gameStartMs - pausedDeduction;
  }

  private _renderTick(): void {
    const now = performance.now();

    if (this._state === "loading") {
      this._hud.updateLoadingTime(now - this._loadingStartMs);
      return;
    }
    if (this._state === "menu") return;

    this._hud.updateFps(this._engine.getFps());
    if (this._spawner)
      this._hud.updateEnemyCount(this._spawner.count, this._spawner.max);
    const elapsed = this._elapsedGameMs(now);
    this._hud.updateTimer(elapsed);

    if (this._state === "gameover" || this._state === "paused") return;

    const dt = this._engine.getDeltaTime();
    this._player?.update();
    this._sword?.swing(now);
    this._sword?.update(now);
    if (this._chunks && this._player) {
      this._chunks.update(this._player.position.x, this._player.position.z);
    }
    if (this._spawner && this._player && this._health) {
      this._spawner.update(
        dt,
        now,
        elapsed,
        this._player.position,
        this._health,
      );
    }
  }
}
