/**
 * @file Loads, validates and caches all client-side configs.
 *
 * Same data-driven philosophy as the server: every gameplay or rendering
 * parameter lives in a JSON file under `src/data/`, never inlined in code.
 *
 * The JSON files are imported statically so Vite bundles them at build time;
 * a config change therefore requires a rebuild (or HMR in dev).
 */

import controls from '../data/controls.json' with { type: 'json' };
import network from '../data/network.json' with { type: 'json' };
import physics from '../data/physics.json' with { type: 'json' };
import render from '../data/render.json' with { type: 'json' };

/** Keyboard `KeyboardEvent.code` for each action. */
export interface ControlsConfig {
	readonly moveForward: string;
	readonly moveBackward: string;
	readonly moveLeft: string;
	readonly moveRight: string;
	readonly jump: string;
	/** Key that toggles the in-game latency panel on / off. */
	readonly togglePanel: string;
}

/** Rendering / scene appearance parameters. Colors are CSS hex strings. */
export interface RenderConfig {
	readonly clearColor: string;
	readonly ambientIntensity: number;
	/** ArcRotateCamera horizontal angle (radians). */
	readonly cameraAlpha: number;
	/** ArcRotateCamera vertical angle (radians). */
	readonly cameraBeta: number;
	/** ArcRotateCamera distance from target (meters). */
	readonly cameraRadius: number;
	/** Y coordinate the camera looks at. */
	readonly cameraTargetY: number;
	readonly groundSize: number;
	readonly groundColor: string;
	readonly localPlayerColor: string;
	readonly remotePlayerColor: string;
	/**
	 * Convergence rate (per second) of the snapshot-position lerp. Higher =
	 * snappier but closer to a raw snap; lower = smoother but more visibly
	 * lagging behind the server.
	 */
	readonly interpRate: number;
}

/** Network endpoint + outbound input rate. */
export interface NetworkConfig {
	readonly endpoint: string;
	readonly sendRateHz: number;
	/** How often the client emits a latency probe (ms). */
	readonly pingIntervalMs: number;
}

/**
 * Client-side mirror of the server gameplay constants needed for prediction.
 *
 * These MUST match the server's `physics.json` — if they drift, the client's
 * predicted motion will diverge from the authoritative simulation and the
 * reconciliation will visibly correct it every snapshot.
 */
export interface PhysicsConfig {
	/** Horizontal speed when an axis is fully held (m/s). Mirrors server. */
	readonly moveSpeed: number;
}

export interface ClientConfig {
	readonly controls: ControlsConfig;
	readonly render: RenderConfig;
	readonly network: NetworkConfig;
	readonly physics: PhysicsConfig;
}

/**
 * Resolve the game-server endpoint when no explicit `VITE_GAME_SOCKET_URL` is
 * set. In a browser, reuse the host the page was served from and keep the port
 * declared in the JSON config — so a client opened at `http://<host>:5173`
 * connects to `ws://<host>:4000` with no hardcoded IP, even when that host's
 * address changes between sessions. Outside a browser (tests) the JSON value
 * is used verbatim.
 */
function deriveEndpoint(jsonEndpoint: string): string {
	if (typeof window === 'undefined') {
		return jsonEndpoint;
	}
	const port = new URL(jsonEndpoint).port || '4000';
	const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
	return `${scheme}://${window.location.hostname}:${port}`;
}

let cached: ClientConfig | null = null;

/**
 * Returns the singleton {@link ClientConfig}.
 *
 * Vite env variables (e.g. `VITE_GAME_SOCKET_URL`) take precedence over the
 * JSON-declared `network.endpoint` so deployments can override without
 * shipping a different bundle.
 */
export function loadConfig(): ClientConfig {
	if (cached !== null) {
		return cached;
	}
	const envEndpoint = import.meta.env.VITE_GAME_SOCKET_URL as string | undefined;
	// `||` falls back on both undefined and an empty string; the spread carries
	// over every other network field automatically.
	const finalNetwork: NetworkConfig = {
		...network,
		endpoint: envEndpoint || deriveEndpoint(network.endpoint),
	};
	cached = Object.freeze({
		controls: Object.freeze({ ...controls }),
		render: Object.freeze({ ...render }),
		network: Object.freeze(finalNetwork),
		physics: Object.freeze({ ...physics }),
	});
	return cached;
}
