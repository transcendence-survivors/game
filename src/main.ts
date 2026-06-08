import './global.css';

import { App } from './App';

// function startup(): void {
// 	// Check that the canvas exist in the DOM
// 	const canvas = document.querySelector<HTMLCanvasElement>('#game');
// 	if (canvas === null) {
// 		throw new Error('[main] Game canvas not found in index.html');
// 	}
// 	// Create Config
// 	const config = loadConfig();
// 	console.log(`[client] config — endpoint=${config.network.endpoint}`);

// 	const engine = new GameEngine(canvas);
// 	const menuScene = createMenuScene(engine, config.render);
// 	engine.setScene(menuScene);
// 	engine.start();
// 	// Create ui
// 	const ui = AdvancedDynamicTexture.CreateFullscreenUI(
// 		'menu-ui',
// 		true,
// 		menuScene,
// 	);

// 	// Create Network
// 	const network = new NetworkClient(config.network.endpoint);

// 	let teardown: (() => void) | null = null;
// 	const clearTeardown = (): void => {
// 		teardown?.();
// 		teardown = null;
// 	};

// 	const showMenu = (): void => {
// 		clearTeardown();
// 		const menu = new MenuScreen({
// 			ui,
// 			network,
// 			config: config.lobby,
// 			onEnterRoom: (room) => showLobby(room),
// 		});
// 		menu.mount();
// 		teardown = () => menu.dispose();
// 	};

// 	const showLobby = (room: Room): void => {
// 		clearTeardown();
// 		const lobby = new LobbyScreen({
// 			ui,
// 			room,
// 			onStart: (started) => showGame(started),
// 			onKicked: (reason) => {
// 				console.log(`[client] kicked: ${reason}`);
// 				void room.leave();
// 				showMenu();
// 			},
// 			onLeave: () => {
// 				void room.leave();
// 				showMenu();
// 			},
// 		});
// 		lobby.mount();
// 		teardown = () => lobby.dispose();
// 	};

// 	const showGame = (room: Room): void => {
// 		clearTeardown();
// 		teardown = startInGame(engine, room, config);
// 	};

// 	showMenu();

// 	window.addEventListener('beforeunload', () => {
// 		clearTeardown();
// 		engine.dispose();
// 	});
// }

try {
	const app = new App();
	app.startup();
} catch (err: unknown) {
	const message = err instanceof Error ? err.message : String(err);
	console.error('[client] bootstrap failed', err);
	document.body.insertAdjacentHTML(
		'beforeend',
		`<pre style="position:fixed;inset:1rem;background:#000c;color:#f87171;padding:1rem;font:14px monospace;white-space:pre-wrap;z-index:9999">Boot error: ${message}</pre>`,
	);
}
