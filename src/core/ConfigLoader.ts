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
import render from '../data/render.json' with { type: 'json' };

/** Keyboard `KeyboardEvent.code` for each action. */
export interface ControlsConfig {
	readonly moveForward: string;
	readonly moveBackward: string;
	readonly moveLeft: string;
	readonly moveRight: string;
	readonly jump: string;
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
}

/** Network endpoint + outbound input rate. */
export interface NetworkConfig {
	readonly endpoint: string;
	readonly sendRateHz: number;
}

export interface ClientConfig {
	readonly controls: ControlsConfig;
	readonly render: RenderConfig;
	readonly network: NetworkConfig;
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
	const finalNetwork: NetworkConfig = {
		endpoint: envEndpoint !== undefined && envEndpoint.length > 0 ? envEndpoint : network.endpoint,
		sendRateHz: network.sendRateHz,
	};
	cached = Object.freeze({
		controls: Object.freeze({ ...controls }),
		render: Object.freeze({ ...render }),
		network: Object.freeze(finalNetwork),
	});
	return cached;
}
