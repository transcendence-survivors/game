/**
 * Headless end-to-end check of the lobby/matchmaking server logic.
 * Drives a running game-server (ws://localhost:4000) via the colyseus.js SDK.
 *
 * Run: bun scripts/lobby-e2e.mjs   (from apps/game/client, server must be up)
 */
import { Client, getStateCallbacks } from 'colyseus.js';

const ENDPOINT = process.env.GAME_WS ?? 'ws://localhost:4000';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let passed = 0;
let failed = 0;
function check(name, cond) {
	if (cond) {
		passed += 1;
		console.log(`  ✓ ${name}`);
	} else {
		failed += 1;
		console.log(`  ✗ ${name}`);
	}
}

/** Wait until predicate(room.state) is true, or time out. */
async function until(room, predicate, timeoutMs = 3000) {
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		if (predicate(room.state)) return true;
		await wait(30);
	}
	return false;
}

async function main() {
	const client = new Client(ENDPOINT);

	// --- 1. Public create + live lobby listing -----------------------------
	console.log('\n[1] Public room shows up in the live lobby listing');
	const lobby = await client.joinOrCreate('lobby');
	const listed = new Map();
	lobby.onMessage('rooms', (rooms) => rooms.forEach((r) => listed.set(r.roomId, r)));
	lobby.onMessage('+', ([id, r]) => listed.set(id, r));
	lobby.onMessage('-', (id) => listed.delete(id));
	await wait(200);

	const alice = await client.create('game', {
		roomName: 'test-public',
		mode: 'public',
		playerName: 'Alice',
	});
	await wait(400);
	const pubEntry = [...listed.values()].find((r) => r.metadata?.roomName === 'test-public');
	check('public room appears in lobby listing', Boolean(pubEntry));
	check('listing carries roomName metadata', pubEntry?.metadata?.roomName === 'test-public');
	check('listing reports phase=lobby', pubEntry?.metadata?.phase === 'lobby');

	// --- 2. Join public by id + ready-up auto-start ------------------------
	console.log('\n[2] Second player joins by id, both ready -> auto start');
	const bob = await client.joinById(alice.roomId, { playerName: 'Bob' });
	await until(alice, (s) => s.players.size === 2);
	check('room has 2 players', alice.state.players.size === 2);
	check('Alice is host', alice.state.hostId === alice.sessionId);
	check('phase still lobby before ready', alice.state.phase === 'lobby');

	alice.send('toggleReady');
	await wait(100);
	check('not started with only host ready', alice.state.phase === 'lobby');
	bob.send('toggleReady');
	const started = await until(alice, (s) => s.phase === 'playing');
	check('phase flips to playing when all ready', started);
	check('players got spawn positions (x spread)', alice.state.players.get(bob.sessionId)?.x !== alice.state.players.get(alice.sessionId)?.x);

	// late join must be rejected (room locked / started)
	let lateRejected = false;
	try {
		await client.joinById(alice.roomId, { playerName: 'Late' });
	} catch {
		lateRejected = true;
	}
	check('late join after start is rejected', lateRejected);
	await alice.leave();
	await bob.leave();

	// --- 3. Private room: wrong vs right password --------------------------
	console.log('\n[3] Private room password gating');
	const host = await client.create('game', {
		roomName: 'secret-room',
		mode: 'private',
		password: 'hunter2',
		playerName: 'Host',
	});
	await wait(300);
	const hiddenFromList = ![...listed.values()].some((r) => r.metadata?.roomName === 'secret-room');
	check('private room is NOT in public listing', hiddenFromList);

	let wrongRejected = false;
	try {
		await client.join('game', { roomName: 'secret-room', password: 'nope', playerName: 'Intruder' });
	} catch {
		wrongRejected = true;
	}
	check('wrong password rejected', wrongRejected);

	const guest = await client.join('game', {
		roomName: 'secret-room',
		password: 'hunter2',
		playerName: 'Guest',
	});
	await until(host, (s) => s.players.size === 2);
	check('correct password joins', host.state.players.size === 2);

	// --- 4. Host kicks the guest ------------------------------------------
	console.log('\n[4] Host kicks a player');
	let kickedReason = null;
	getStateCallbacks(guest); // ensure callbacks initialised
	guest.onMessage('kicked', (m) => {
		kickedReason = m?.reason ?? 'kicked';
	});
	host.send('kick', { targetId: guest.sessionId });
	await until(host, (s) => s.players.size === 1);
	await wait(150);
	check('guest removed from room after kick', host.state.players.size === 1);
	check('guest received kicked message', typeof kickedReason === 'string');

	// non-host cannot kick: guest already gone; re-add and try
	await host.leave();
	await lobby.leave();

	console.log(`\nRESULT: ${passed} passed, ${failed} failed`);
	process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
	console.error('E2E crashed:', err);
	process.exit(2);
});
