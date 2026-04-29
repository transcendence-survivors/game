import { Scene } from '@babylonjs/core';
import {
	AdvancedDynamicTexture, Button, Control, Rectangle, StackPanel, TextBlock,
} from '@babylonjs/gui';
import type { HealthSystem } from '../systems/HealthSystem';

export class HUD {
	private readonly _ui: AdvancedDynamicTexture;
	private readonly _hpContainer: Rectangle;
	private readonly _hpBarFill: Rectangle;
	private readonly _hpText: TextBlock;
	private readonly _gameOverText: TextBlock;
	private readonly _statsPanel: StackPanel;
	private readonly _fpsText: TextBlock;
	private readonly _enemyCountText: TextBlock;
	private readonly _timerText: TextBlock;
	private readonly _pauseOverlay: Rectangle;
	private readonly _mainMenuOverlay: Rectangle;
	private readonly _loadingOverlay: Rectangle;
	private readonly _loadingTimerText: TextBlock;
	private readonly _loadingBarFill: Rectangle;
	private readonly _loadingPercentText: TextBlock;
	private readonly _networkStatusText: TextBlock;
	private readonly _pingText: TextBlock;
	private readonly _resumeHandlers: (() => void)[] = [];
	private readonly _restartHandlers: (() => void)[] = [];
	private readonly _startGameHandlers: (() => void)[] = [];

	constructor(scene: Scene) {
		this._ui = AdvancedDynamicTexture.CreateFullscreenUI('UI', true, scene);
		const hp = this._buildHpBar();
		this._hpContainer = hp.container;
		this._hpBarFill = hp.fill;
		this._hpText = hp.text;
		this._gameOverText = this._buildGameOverText();
		const stats = this._buildStatsPanel();
		this._statsPanel = stats.panel;
		this._fpsText = stats.fps;
		this._enemyCountText = stats.enemies;
		this._timerText = stats.timer;
		this._pauseOverlay = this._buildPauseOverlay();
		const mainMenu = this._buildMainMenuOverlay();
		this._mainMenuOverlay = mainMenu.overlay;
		this._networkStatusText = mainMenu.statusText;
		this._pingText = this._buildPingText();
		const loading = this._buildLoadingOverlay();
		this._loadingOverlay = loading.overlay;
		this._loadingTimerText = loading.timer;
		this._loadingBarFill = loading.barFill;
		this._loadingPercentText = loading.percent;

		this.setGameplayUiVisible(false);
	}

	bindHealth(health: HealthSystem): void {
		this._renderHp(health.current, health.max);
		health.onChange((current, max) => this._renderHp(current, max));
	}

	showGameOver(): void {
		this._gameOverText.isVisible = true;
	}

	setPaused(paused: boolean): void {
		this._pauseOverlay.isVisible = paused;
	}

	setGameplayUiVisible(visible: boolean): void {
		this._hpContainer.isVisible = visible;
		this._statsPanel.isVisible = visible;
	}

	showMainMenu(): void {
		this._mainMenuOverlay.isVisible = true;
		this._loadingOverlay.isVisible = false;
	}

	hideMainMenu(): void {
		this._mainMenuOverlay.isVisible = false;
	}

	showLoadingScreen(): void {
		this._loadingOverlay.isVisible = true;
		this._loadingTimerText.text = '0.00 s';
		this.updateLoadingProgress(0);
	}

	hideLoadingScreen(): void {
		this._loadingOverlay.isVisible = false;
	}

	updateLoadingTime(elapsedMs: number): void {
		this._loadingTimerText.text = `${(elapsedMs / 1000).toFixed(2)} s`;
	}

	updateLoadingProgress(ratio: number): void {
		const clamped = Math.max(0, Math.min(1, ratio));
		this._loadingBarFill.width = clamped;
		this._loadingPercentText.text = `${Math.round(clamped * 100)}%`;
	}

	onResume(handler: () => void): void {
		this._resumeHandlers.push(handler);
	}

	onRestart(handler: () => void): void {
		this._restartHandlers.push(handler);
	}

	onStartGame(handler: () => void): void {
		this._startGameHandlers.push(handler);
	}

	updateFps(fps: number): void {
		this._fpsText.text = `FPS: ${fps.toFixed()}`;
	}

	updateEnemyCount(count: number, max: number): void {
		this._enemyCountText.text = `Enemies: ${count} / ${max}`;
	}

	updatePing(latencyMs: number | null): void {
		if (latencyMs === null) {
			this._pingText.text = 'Ping: --';
			this._pingText.color = '#888888';
			return;
		}
		const rounded = Math.round(latencyMs);
		this._pingText.text = `Ping: ${rounded} ms`;
		if (rounded < 50) this._pingText.color = '#3aa05a';
		else if (rounded < 150) this._pingText.color = '#daa520';
		else this._pingText.color = '#aa3a3a';
	}

	updateTimer(elapsedMs: number): void {
		const totalSeconds = Math.floor(elapsedMs / 1000);
		const minutes = Math.floor(totalSeconds / 60);
		const seconds = totalSeconds % 60;
		const mm = String(minutes).padStart(2, '0');
		const ss = String(seconds).padStart(2, '0');
		this._timerText.text = `Time: ${mm}:${ss}`;
	}

	private _renderHp(current: number, max: number): void {
		this._hpText.text = `${current} / ${max}`;
		const ratio = max === 0 ? 0 : current / max;
		this._hpBarFill.width = `${ratio * 100}%`;
		if (ratio > 0.5) this._hpBarFill.background = 'green';
		else if (ratio > 0.2) this._hpBarFill.background = 'orange';
		else this._hpBarFill.background = 'red';
	}

	private _buildHpBar(): { container: Rectangle; fill: Rectangle; text: TextBlock } {
		const container = new Rectangle();
		container.width = '300px';
		container.height = '40px';
		container.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
		container.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
		container.left = '20px';
		container.top = '-20px';
		container.thickness = 2;
		container.background = 'black';
		container.color = 'white';
		this._ui.addControl(container);

		const fill = new Rectangle();
		fill.width = '100%';
		fill.height = '100%';
		fill.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
		fill.background = 'green';
		fill.thickness = 0;
		container.addControl(fill);

		const text = new TextBlock();
		text.color = 'white';
		text.fontSize = 20;
		text.fontWeight = 'bold';
		container.addControl(text);

		return { container, fill, text };
	}

	private _buildGameOverText(): TextBlock {
		const t = new TextBlock('gameOverText');
		t.text = 'GAME OVER';
		t.color = 'red';
		t.fontSize = 72;
		t.fontWeight = 'bold';
		t.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
		t.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
		t.isVisible = false;
		this._ui.addControl(t);
		return t;
	}

	private _buildPauseOverlay(): Rectangle {
		const overlay = new Rectangle('pauseOverlay');
		overlay.width = 1;
		overlay.height = 1;
		overlay.background = 'black';
		overlay.alpha = 0.6;
		overlay.thickness = 0;
		overlay.isVisible = false;
		this._ui.addControl(overlay);

		const stack = new StackPanel('pauseStack');
		stack.width = '320px';
		stack.isVertical = true;
		stack.spacing = 20;
		stack.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
		stack.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
		overlay.addControl(stack);

		const label = new TextBlock('pauseLabel');
		label.text = 'PAUSE';
		label.color = 'white';
		label.fontSize = 96;
		label.fontWeight = 'bold';
		label.height = '120px';
		label.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
		label.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
		stack.addControl(label);

		const resumeBtn = this._buildMenuButton('resumeBtn', 'Reprendre', () => {
			this._resumeHandlers.forEach(h => h());
		});
		stack.addControl(resumeBtn);

		const restartBtn = this._buildMenuButton('restartBtn', 'Recommencer', () => {
			this._restartHandlers.forEach(h => h());
		});
		stack.addControl(restartBtn);

		return overlay;
	}

	private _buildMainMenuOverlay(): { overlay: Rectangle; statusText: TextBlock } {
		const overlay = new Rectangle('mainMenuOverlay');
		overlay.width = 1;
		overlay.height = 1;
		overlay.background = '#0a0a0a';
		overlay.alpha = 1.0;
		overlay.thickness = 0;
		overlay.isVisible = false;
		this._ui.addControl(overlay);

		const stack = new StackPanel('mainMenuStack');
		stack.width = '420px';
		stack.isVertical = true;
		stack.spacing = 30;
		stack.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
		stack.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
		overlay.addControl(stack);

		const title = new TextBlock('mainMenuTitle');
		title.text = 'TRANSCENDENCE';
		title.color = 'white';
		title.fontSize = 72;
		title.fontWeight = 'bold';
		title.height = '100px';
		title.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
		title.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
		stack.addControl(title);

		const subtitle = new TextBlock('mainMenuSubtitle');
		subtitle.text = 'Survive as long as possible';
		subtitle.color = '#aaaaaa';
		subtitle.fontSize = 24;
		subtitle.height = '40px';
		subtitle.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
		subtitle.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
		stack.addControl(subtitle);

		const startBtn = this._buildMenuButton('startGameBtn', 'Démarrer une nouvelle partie', () => {
			this._startGameHandlers.forEach(h => h());
		});
		startBtn.width = '380px';
		stack.addControl(startBtn);

		const statusText = new TextBlock('networkStatus');
		statusText.text = 'Connexion au serveur...';
		statusText.color = '#888888';
		statusText.fontSize = 18;
		statusText.height = '30px';
		statusText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
		statusText.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
		stack.addControl(statusText);

		return { overlay, statusText };
	}

	setNetworkStatus(status: 'online' | 'offline' | 'connecting'): void {
		if (status === 'online') {
			this._networkStatusText.text = '● Serveur connecté';
			this._networkStatusText.color = '#3aa05a';
		} else if (status === 'offline') {
			this._networkStatusText.text = '● Mode hors ligne';
			this._networkStatusText.color = '#aa3a3a';
		} else {
			this._networkStatusText.text = 'Connexion au serveur...';
			this._networkStatusText.color = '#888888';
		}
	}

	private _buildLoadingOverlay(): { overlay: Rectangle; timer: TextBlock; barFill: Rectangle; percent: TextBlock } {
		const overlay = new Rectangle('loadingOverlay');
		overlay.width = 1;
		overlay.height = 1;
		overlay.background = '#0a0a0a';
		overlay.alpha = 1.0;
		overlay.thickness = 0;
		overlay.isVisible = false;
		this._ui.addControl(overlay);

		const stack = new StackPanel('loadingStack');
		stack.width = '500px';
		stack.isVertical = true;
		stack.spacing = 18;
		stack.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
		stack.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
		overlay.addControl(stack);

		const label = new TextBlock('loadingLabel');
		label.text = 'Chargement...';
		label.color = 'white';
		label.fontSize = 48;
		label.fontWeight = 'bold';
		label.height = '70px';
		label.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
		label.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
		stack.addControl(label);

		const barContainer = new Rectangle('loadingBarContainer');
		barContainer.width = '480px';
		barContainer.height = '36px';
		barContainer.background = '#222222';
		barContainer.color = 'white';
		barContainer.thickness = 2;
		barContainer.cornerRadius = 4;
		stack.addControl(barContainer);

		const barFill = new Rectangle('loadingBarFill');
		barFill.width = 0;
		barFill.height = 1;
		barFill.background = '#3aa05a';
		barFill.thickness = 0;
		barFill.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
		barContainer.addControl(barFill);

		const percent = new TextBlock('loadingPercent');
		percent.text = '0%';
		percent.color = 'white';
		percent.fontSize = 22;
		percent.fontWeight = 'bold';
		percent.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
		percent.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
		barContainer.addControl(percent);

		const timer = new TextBlock('loadingTimer');
		timer.text = '0.00 s';
		timer.color = '#aaaaaa';
		timer.fontSize = 22;
		timer.height = '36px';
		timer.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
		timer.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
		stack.addControl(timer);

		return { overlay, timer, barFill, percent };
	}

	private _buildPingText(): TextBlock {
		const text = new TextBlock('pingText');
		text.text = 'Ping: --';
		text.color = '#888888';
		text.fontSize = 18;
		text.fontWeight = 'bold';
		text.width = '160px';
		text.height = '24px';
		text.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
		text.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
		text.top = '4px';
		text.left = '-10px';
		text.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
		this._ui.addControl(text);
		return text;
	}

	private _buildMenuButton(name: string, text: string, onClick: () => void): Button {
		const btn = Button.CreateSimpleButton(name, text);
		btn.width = '260px';
		btn.height = '60px';
		btn.color = 'white';
		btn.background = '#1f1f1f';
		btn.thickness = 2;
		btn.cornerRadius = 8;
		btn.fontSize = 28;
		btn.fontWeight = 'bold';
		if (btn.textBlock) btn.textBlock.color = 'white';
		btn.onPointerEnterObservable.add(() => { btn.background = '#3a3a3a'; });
		btn.onPointerOutObservable.add(() => { btn.background = '#1f1f1f'; });
		btn.onPointerUpObservable.add(() => onClick());
		return btn;
	}

	private _buildStatsPanel(): { panel: StackPanel; fps: TextBlock; enemies: TextBlock; timer: TextBlock } {
		const panel = new StackPanel();
		panel.width = '220px';
		panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
		panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
		panel.top = '40px';
		panel.left = '-20px';
		this._ui.addControl(panel);

		const fps = new TextBlock();
		fps.text = 'FPS: 0';
		fps.color = 'yellow';
		fps.fontSize = 22;
		fps.fontWeight = 'bold';
		fps.height = '30px';
		fps.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
		panel.addControl(fps);

		const enemies = new TextBlock();
		enemies.text = 'Enemies: 0';
		enemies.color = 'orange';
		enemies.fontSize = 22;
		enemies.fontWeight = 'bold';
		enemies.height = '30px';
		enemies.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
		panel.addControl(enemies);

		const timer = new TextBlock();
		timer.text = 'Time: 00:00';
		timer.color = 'cyan';
		timer.fontSize = 24;
		timer.fontWeight = 'bold';
		timer.height = '32px';
		timer.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
		panel.addControl(timer);

		return { panel, fps, enemies, timer };
	}
}
