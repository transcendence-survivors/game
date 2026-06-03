/**
 * @file Waiting-room screen, drawn with Babylon GUI onto the shared fullscreen
 * texture (same pipeline as {@link MenuScreen} and the in-scene LatencyPanel).
 *
 * Rendering strategy: the lobby **rebuilds its whole card** from scratch on each
 * state change, exactly like {@link MenuScreen} swaps a card per view. Mutating
 * controls in place (e.g. `roster.clearControls()` + re-add inside a
 * ScrollViewer) did not reliably trigger a Babylon GUI redraw — the room creator
 * stayed stuck on an empty roster. A full rebuild is the reliable path; a state
 * signature gates it so we only rebuild when something actually changed (no
 * flicker, no rebuild on idle poll ticks).
 *
 * State is mirrored two ways for robustness: `onStateChange` (instant) plus a
 * light poll (covers the creator missing its initial `onStateChange`).
 *
 * When `state.phase` flips to `playing` it invokes {@link LobbyOptions.onStart};
 * if the server kicks the local client it invokes {@link LobbyOptions.onKicked};
 * a manual Leave invokes {@link LobbyOptions.onLeave}.
 */

import type { Room } from 'colyseus.js';
import type { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture';
import type { Control } from '@babylonjs/gui/2D/controls/control';
import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle';
import { StackPanel } from '@babylonjs/gui/2D/controls/stackPanel';
import { Grid } from '@babylonjs/gui/2D/controls/grid';
import { ScrollViewer } from '@babylonjs/gui/2D/controls/scrollViewers/scrollViewer';
import {
	ClientMessage,
	ServerMessage,
	RoomMode,
	RoomPhase,
	type KickedPayload,
	type KickPayload,
} from '@transcendence/game-shared';

import { Palette, badge, button, card, centered, endCard, gap, heading, subtitle } from './guiTheme';

/** Wiring the lobby screen needs from its host. */
export interface LobbyOptions {
	/** The shared fullscreen GUI texture to render into. */
	ui: AdvancedDynamicTexture;
	room: Room;
	/** Called once when the game leaves the lobby (phase → playing). */
	onStart: (room: Room) => void;
	/** Called when the host ejects this client. */
	onKicked: (reason: string) => void;
	/** Called when the local player leaves voluntarily. */
	onLeave: () => void;
}

/** Structural view of a player in the lobby (subset we render). */
interface LobbyPlayer {
	id: string;
	name: string;
	ready: boolean;
}

/** Structural view of the lobby's room state (read-only access we need). */
interface LobbyState {
	phase: string;
	hostId: string;
	roomName: string;
	mode: string;
	players: {
		forEach(callback: (value: LobbyPlayer, key: string) => void): void;
	};
}

export class LobbyScreen {
	private readonly ui: AdvancedDynamicTexture;
	private readonly room: Room;
	private readonly onStart: (room: Room) => void;
	private readonly onKicked: (reason: string) => void;
	private readonly onLeave: () => void;

	/** True once {@link onStart} has fired, so the transition runs exactly once. */
	private started = false;
	/** Unsubscribers for room listeners, drained on {@link dispose}. */
	private readonly offs: Array<() => void> = [];
	/** Last rendered state signature — skips redundant rebuilds (no flicker). */
	private lastSig = '';
	/** Safety-net poll timer that guarantees eventual consistency of the roster. */
	private pollTimer: ReturnType<typeof setInterval> | null = null;
	/** The card currently mounted on the texture, replaced wholesale on change. */
	private root: Control | null = null;

	constructor(options: LobbyOptions) {
		this.ui = options.ui;
		this.room = options.room;
		this.onStart = options.onStart;
		this.onKicked = options.onKicked;
		this.onLeave = options.onLeave;
	}

	/** Render the lobby and start mirroring room state. */
	mount(): void {
		// Register listeners FIRST. When a client *creates* a room, `create()`
		// resolves before the initial state has synced, so the very first
		// `refresh()` sees no state yet. The poll + onStateChange then paint it as
		// soon as it arrives — but only if they were registered, which a throwing
		// initial render must never prevent.
		const onState = (): void => this.refresh();
		this.room.onStateChange(onState);
		this.offs.push(() => this.room.onStateChange.remove(onState));

		this.pollTimer = setInterval(() => this.refresh(), 250);

		const offKicked = this.room.onMessage(ServerMessage.Kicked, (msg: KickedPayload) => {
			this.onKicked(msg?.reason ?? 'Kicked');
		});
		this.offs.push(typeof offKicked === 'function' ? offKicked : () => undefined);

		this.refresh();
	}

	/** Stop all room listeners and remove the lobby from the texture. */
	dispose(): void {
		if (this.pollTimer !== null) {
			clearInterval(this.pollTimer);
			this.pollTimer = null;
		}
		for (const off of this.offs) {
			off();
		}
		this.offs.length = 0;
		if (this.root !== null) {
			this.ui.removeControl(this.root);
			this.root = null;
		}
	}

	/**
	 * Reconcile the view with the current room state. Cheap to call often: it
	 * fingerprints the parts of the state it renders and only rebuilds the card
	 * when that fingerprint changes. Also drives the one-shot start transition.
	 */
	private refresh(): void {
		const state = this.room.state as LobbyState | undefined;
		// State may not have synced yet (notably right after `create()`); the
		// poll/onStateChange will call back once it has.
		if (state === undefined || typeof state.players?.forEach !== 'function') {
			return;
		}

		if (state.phase === RoomPhase.Playing && !this.started) {
			this.started = true;
			this.onStart(this.room);
			return;
		}

		const parts: string[] = [];
		state.players.forEach((p) => parts.push(`${p.id}:${p.name}:${p.ready ? 1 : 0}`));
		const sig = `${state.roomName}|${state.mode}|${state.hostId}|${parts.sort().join(',')}`;
		if (sig === this.lastSig) {
			return;
		}
		this.lastSig = sig;
		this.rebuild();
	}

	/** Replace the mounted card with a freshly built one for the current state. */
	private rebuild(): void {
		const next = this.buildCard();
		if (this.root !== null) {
			this.ui.removeControl(this.root);
		}
		this.root = next;
		this.ui.addControl(this.root);
	}

	/** Build the entire lobby card from the current room state. */
	private buildCard(): Control {
		const state = this.room.state as LobbyState;
		const localId = this.room.sessionId;
		const isHost = state.hostId === localId;

		const players: LobbyPlayer[] = [];
		state.players.forEach((p) => players.push({ id: p.id, name: p.name, ready: p.ready }));

		const body = card('lobby');

		body.addControl(centered(heading(state.roomName || 'Lobby')));
		gap(body, 2);
		const modeLabel = state.mode === RoomMode.Private ? 'Private' : 'Public';
		body.addControl(centered(subtitle(`${modeLabel} game — waiting room`)));
		gap(body, 18);

		const scroll = new ScrollViewer('lobby-scroll');
		scroll.width = '100%';
		scroll.height = '240px';
		scroll.thickness = 0;
		scroll.barColor = Palette.border;
		const roster = new StackPanel('roster');
		roster.isVertical = true;
		roster.width = '100%';
		for (const p of players) {
			roster.addControl(this.playerRow(p, p.id === localId, p.id === state.hostId, isHost));
		}
		scroll.addControl(roster);
		body.addControl(scroll);
		gap(body, 10);

		const readyCount = players.filter((p) => p.ready).length;
		body.addControl(subtitle(`${readyCount} / ${players.length} ready — game starts when everyone is ready.`));
		gap(body, 8);

		const local = players.find((p) => p.id === localId);
		const ready = Boolean(local?.ready);
		const readyBtn = button(ready ? 'Not ready' : "I'm ready", ready ? 'ghost' : 'primary');
		readyBtn.onPointerClickObservable.add(() => this.room.send(ClientMessage.ToggleReady));
		body.addControl(readyBtn);
		gap(body, 8);

		const leave = button('Leave', 'ghost');
		leave.onPointerClickObservable.add(() => this.onLeave());
		body.addControl(leave);
		endCard(body);

		return body.parent as Control;
	}

	/** One roster row: name + "you" on the left, badges + optional kick on the right. */
	private playerRow(player: LobbyPlayer, isLocal: boolean, isHost: boolean, localIsHost: boolean): Rectangle {
		const row = new Rectangle();
		row.height = '46px';
		row.thickness = 1;
		row.color = Palette.border;
		row.background = Palette.field;
		row.cornerRadius = 8;
		row.paddingTop = '3px';
		row.paddingBottom = '3px';

		// A Grid gives deterministic cell widths — avoids the auto-sizing
		// (`adaptWidthToChildren`) quirks of a horizontal StackPanel.
		const grid = new Grid();
		grid.width = '100%';
		grid.height = '100%';
		grid.addColumnDefinition(1); // name — takes the remaining width
		grid.addColumnDefinition(70, true); // host badge
		grid.addColumnDefinition(86, true); // ready/waiting badge
		grid.addColumnDefinition(76, true); // kick

		// `subtitle` is already left-aligned.
		const name = subtitle(player.name + (isLocal ? '  (you)' : ''));
		name.color = Palette.textPrimary;
		name.paddingLeft = '14px';
		grid.addControl(name, 0, 0);

		if (isHost) {
			grid.addControl(badge('Host', 'host'), 0, 1);
		}
		grid.addControl(badge(player.ready ? 'Ready' : 'Waiting', player.ready ? 'ready' : 'waiting'), 0, 2);

		if (localIsHost && !isLocal) {
			const kick = button('Kick', 'danger');
			kick.width = '60px';
			kick.height = '28px';
			kick.onPointerClickObservable.add(() => {
				const payload: KickPayload = { targetId: player.id };
				this.room.send(ClientMessage.Kick, payload);
			});
			grid.addControl(kick, 0, 3);
		}

		row.addControl(grid);
		return row;
	}
}
