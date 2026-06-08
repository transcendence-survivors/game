import type { Room } from 'colyseus.js';
import type { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture';
import type { TextBlock } from '@babylonjs/gui/2D/controls/textBlock';
import type { Control } from '@babylonjs/gui/2D/controls/control';
import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle';
import { StackPanel } from '@babylonjs/gui/2D/controls/stackPanel';
import { Grid } from '@babylonjs/gui/2D/controls/grid';
import { ScrollViewer } from '@babylonjs/gui/2D/controls/scrollViewers/scrollViewer';
import {
	RoomMode,
	RoomPhase,
	type RoomListItem,
	type RoomModeName,
} from '@transcendence/game-shared';

import type { LobbyConfig } from '../core/ConfigLoader';
import type { NetworkClient } from '../network/NetworkClient';
import {
	Palette,
	button,
	card,
	centered,
	endCard,
	errorLine,
	gap,
	heading,
	label,
	passwordInput,
	subtitle,
	textInput,
} from './guiTheme';

/** Wiring the menu needs from its host. */
export interface MenuOptions {
	/** The shared fullscreen GUI texture to render into. */
	ui: AdvancedDynamicTexture;
	/** The matchmaking client. */
	network: NetworkClient;
	/** Lobby/UI input limits. */
	config: LobbyConfig;
	/** Called with the joined room once the player creates/joins a game. */
	onEnterRoom: (room: Room) => void;
}

export class MenuScreen {
	private readonly ui: AdvancedDynamicTexture;
	private readonly network: NetworkClient;
	private readonly config: LobbyConfig;
	private readonly onEnterRoom: (room: Room) => void;

	/** Persisted across views so the pseudonym survives navigation. */
	private playerName = '';
	/** Selected mode in the create view. */
	private createMode: RoomModeName = RoomMode.Public;
	/** Create-view field values, persisted so a mode toggle re-render keeps them. */
	private createRoomName = '';
	private createPassword = '';

	/** The control currently mounted at the root (a card), replaced per view. */
	private current: Control | null = null;
	/** Inline error text block of the current view, if any. */
	private error: TextBlock | null = null;

	/** Live public-room list, keyed by roomId (only populated in the find view). */
	private readonly rooms = new Map<string, RoomListItem>();
	/** The lobby directory room, while the find view is open. */
	private lobbyRoom: Room | null = null;
	/** The scrollable stack that holds the room rows (find view). */
	private listStack: StackPanel | null = null;

	constructor(options: MenuOptions) {
		this.ui = options.ui;
		this.network = options.network;
		this.config = options.config;
		this.onEnterRoom = options.onEnterRoom;
	}

	/** Render the home view. */
	mount(): void {
		this.renderHome();
	}

	/** Remove the menu from the texture and drop any lobby subscription. */
	dispose(): void {
		void this.closeLobby();
		this.setRoot(null);
	}

	// ----------------------------------------------------------------- plumbing

	/** Swap the mounted root control (removing the previous one). */
	private setRoot(control: Control | null): void {
		if (this.current !== null) {
			this.ui.removeControl(this.current);
		}
		this.current = control;
		this.error = null;
		this.listStack = null;
		if (control !== null) {
			this.ui.addControl(control);
		}
	}

	private setError(text: string): void {
		if (this.error !== null) {
			this.error.text = text;
		}
	}

	// -------------------------------------------------------------------- views

	private renderHome(): void {
		void this.closeLobby();
		const body = card('menu-home');
		body.addControl(centered(heading('Transcendence Survivors')));
		gap(body, 2);
		body.addControl(
			centered(
				subtitle('Create a game or join one — then ready up to start.'),
			),
		);
		gap(body, 22);
		body.addControl(label('Your name'));
		gap(body, 4);
		const name = textInput('Pseudo', this.config.maxPlayerNameLength);
		name.text = this.playerName;
		name.onTextChangedObservable.add(() => {
			this.playerName = name.text.trim();
		});
		body.addControl(name);
		gap(body, 16);

		const create = button('Create a game', 'primary');
		const find = button('Find a game online', 'ghost');
		const joinPriv = button('Join a private game', 'ghost');
		body.addControl(create);
		gap(body, 8);
		body.addControl(find);
		gap(body, 8);
		body.addControl(joinPriv);
		gap(body, 6);
		const err = errorLine();
		body.addControl(err);
		endCard(body);

		this.setRoot(body.parent as Control);
		this.error = err;

		create.onPointerClickObservable.add(() =>
			this.guardName(() => this.renderCreate()),
		);
		find.onPointerClickObservable.add(() =>
			this.guardName(() => this.renderFind()),
		);
		joinPriv.onPointerClickObservable.add(() =>
			this.guardName(() => this.renderJoinPrivate()),
		);
	}

	/**
	 * Render the create view for the current {@link createMode}. Toggling the
	 * mode simply re-renders (field values live in instance state, so they
	 * survive the rebuild) — far simpler than splicing the password row in/out.
	 */
	private renderCreate(): void {
		const isPrivate = this.createMode === RoomMode.Private;
		const body = card('menu-create');
		body.addControl(centered(heading('Create a game')));
		gap(body, 20);
		body.addControl(label('Game name'));
		gap(body, 4);
		const roomName = textInput('My game', this.config.maxRoomNameLength);
		roomName.text = this.createRoomName;
		roomName.onTextChangedObservable.add(() => {
			this.createRoomName = roomName.text;
		});
		body.addControl(roomName);
		gap(body, 14);

		// Public / private segmented toggle. A Grid (not a horizontal StackPanel)
		// so the two halves resolve their width from the grid columns — a
		// horizontal StackPanel auto-sizes to its children and would collapse
		// percentage-width buttons to nothing.
		body.addControl(label('Visibility'));
		gap(body, 4);
		const modes = new Grid('modes');
		modes.height = '44px';
		modes.width = '100%';
		modes.addColumnDefinition(0.5);
		modes.addColumnDefinition(0.5);
		const publicBtn = button(
			'Public',
			this.createMode === RoomMode.Public ? 'primary' : 'ghost',
		);
		const privateBtn = button('Private', isPrivate ? 'primary' : 'ghost');
		publicBtn.width = '94%';
		privateBtn.width = '94%';
		publicBtn.height = '44px';
		privateBtn.height = '44px';
		modes.addControl(publicBtn, 0, 0);
		modes.addControl(privateBtn, 0, 1);
		body.addControl(modes);
		gap(body, 14);

		if (isPrivate) {
			body.addControl(
				label(`Password (min ${this.config.minPasswordLength})`),
			);
			gap(body, 4);
			const pw = passwordInput('••••', this.config.maxPasswordLength);
			pw.text = this.createPassword;
			pw.onTextChangedObservable.add(() => {
				this.createPassword = pw.text;
			});
			body.addControl(pw);
			gap(body, 14);
		}

		const err = errorLine();
		body.addControl(err);
		gap(body, 4);
		const submit = button('Create & enter lobby', 'primary');
		const back = button('Back', 'ghost');
		body.addControl(submit);
		gap(body, 8);
		body.addControl(back);
		endCard(body);

		this.setRoot(body.parent as Control);
		this.error = err;

		publicBtn.onPointerClickObservable.add(() => {
			this.createMode = RoomMode.Public;
			this.renderCreate();
		});
		privateBtn.onPointerClickObservable.add(() => {
			this.createMode = RoomMode.Private;
			this.renderCreate();
		});
		submit.onPointerClickObservable.add(() => void this.submitCreate());
		back.onPointerClickObservable.add(() => this.renderHome());
	}

	private renderFind(): void {
		const body = card('menu-find');
		body.addControl(centered(heading('Find a game online')));
		gap(body, 2);
		body.addControl(
			centered(subtitle('Live list — public games waiting for players.')),
		);
		gap(body, 16);

		const scroll = new ScrollViewer('room-scroll');
		scroll.width = '100%';
		scroll.height = '260px';
		scroll.thickness = 0;
		scroll.barColor = Palette.border;
		const list = new StackPanel('room-list');
		list.isVertical = true;
		list.width = '100%';
		scroll.addControl(list);
		body.addControl(scroll);
		gap(body, 10);

		const err = errorLine();
		body.addControl(err);
		gap(body, 4);
		const back = button('Back', 'ghost');
		body.addControl(back);
		endCard(body);

		this.setRoot(body.parent as Control);
		this.error = err;
		this.listStack = list;

		back.onPointerClickObservable.add(() => this.renderHome());
		this.renderRoomList();
		void this.openLobby();
	}

	private renderJoinPrivate(): void {
		const body = card('menu-join');
		body.addControl(centered(heading('Join a private game')));
		gap(body, 20);
		body.addControl(label('Game name'));
		gap(body, 4);
		const roomName = textInput(
			'Exact game name',
			this.config.maxRoomNameLength,
		);
		body.addControl(roomName);
		gap(body, 14);
		body.addControl(label('Password'));
		gap(body, 4);
		const pw = passwordInput('••••', this.config.maxPasswordLength);
		body.addControl(pw);
		gap(body, 14);
		const err = errorLine();
		body.addControl(err);
		gap(body, 4);
		const submit = button('Join', 'primary');
		const back = button('Back', 'ghost');
		body.addControl(submit);
		gap(body, 8);
		body.addControl(back);
		endCard(body);

		this.setRoot(body.parent as Control);
		this.error = err;

		submit.onPointerClickObservable.add(
			() => void this.submitJoinPrivate(roomName.text.trim(), pw.text),
		);
		back.onPointerClickObservable.add(() => this.renderHome());
	}

	// ---------------------------------------------------------------- live list

	private async openLobby(): Promise<void> {
		try {
			this.rooms.clear();
			this.lobbyRoom = await this.network.joinLobby({
				onReset: (list) => {
					this.rooms.clear();
					for (const r of list) {
						this.rooms.set(r.roomId, r);
					}
					this.renderRoomList();
				},
				onUpsert: (room) => {
					this.rooms.set(room.roomId, room);
					this.renderRoomList();
				},
				onRemove: (roomId) => {
					this.rooms.delete(roomId);
					this.renderRoomList();
				},
			});
		} catch (err) {
			this.setError(this.message(err));
		}
	}

	private async closeLobby(): Promise<void> {
		const lobby = this.lobbyRoom;
		this.lobbyRoom = null;
		if (lobby !== null) {
			try {
				await lobby.leave();
			} catch {
				/* already gone */
			}
		}
	}

	private renderRoomList(): void {
		const list = this.listStack;
		if (list === null) {
			return;
		}
		list.clearControls();
		const joinable = [...this.rooms.values()].filter(
			(r) => r.phase === RoomPhase.Lobby && r.clients < r.maxClients,
		);
		if (joinable.length === 0) {
			const empty = subtitle('No public games waiting. Create one!');
			empty.height = '60px';
			empty.textHorizontalAlignment = 2; // center
			list.addControl(empty);
			return;
		}
		for (const r of joinable) {
			list.addControl(this.roomRow(r));
		}
	}

	/** One row in the public-room list: name + count on the left, Join on the right. */
	private roomRow(room: RoomListItem): Rectangle {
		const row = new Rectangle();
		row.height = '52px';
		row.thickness = 1;
		row.color = Palette.border;
		row.background = Palette.field;
		row.cornerRadius = 8;
		row.paddingTop = '4px';
		row.paddingBottom = '4px';

		const info = subtitle(
			`${room.roomName}  —  ${room.clients}/${room.maxClients}`,
		);
		info.color = Palette.textPrimary;
		info.paddingLeft = '12px';
		info.width = '60%';
		info.horizontalAlignment = 0; // left
		row.addControl(info);

		const join = button('Join', 'primary');
		join.width = '90px';
		join.height = '34px';
		join.horizontalAlignment = 1; // right
		join.paddingRight = '10px';
		join.onPointerClickObservable.add(
			() => void this.submitJoinPublic(room.roomId),
		);
		row.addControl(join);
		return row;
	}

	// ------------------------------------------------------------------ actions

	private async submitCreate(): Promise<void> {
		const roomName = this.createRoomName.trim();
		const password = this.createPassword;
		if (roomName.length === 0) {
			this.setError('Please enter a game name.');
			return;
		}
		const isPrivate = this.createMode === RoomMode.Private;
		if (isPrivate && password.length < this.config.minPasswordLength) {
			this.setError(
				`Password must be at least ${this.config.minPasswordLength} characters.`,
			);
			return;
		}
		await this.enter(() =>
			this.network.createGame({
				roomName,
				mode: this.createMode,
				password: isPrivate ? password : undefined,
				playerName: this.playerName,
			}),
		);
	}

	private async submitJoinPublic(roomId: string): Promise<void> {
		await this.enter(() =>
			this.network.joinPublic(roomId, this.playerName),
		);
	}

	private async submitJoinPrivate(
		roomName: string,
		password: string,
	): Promise<void> {
		if (roomName.length === 0 || password.length === 0) {
			this.setError('Enter both the game name and password.');
			return;
		}
		await this.enter(() =>
			this.network.joinPrivate(roomName, password, this.playerName),
		);
	}

	/** Run a join/create thunk, hand the room to the host on success. */
	private async enter(join: () => Promise<Room>): Promise<void> {
		this.setError('');
		try {
			const room = await join();
			await this.closeLobby();
			this.onEnterRoom(room);
		} catch (err) {
			this.setError(this.message(err));
		}
	}

	// ------------------------------------------------------------------ helpers

	private guardName(next: () => void): void {
		if (this.playerName.length === 0) {
			this.setError('Please enter your name first.');
			return;
		}
		next();
	}

	/** Turn a Colyseus matchmaking error into a friendly message. */
	private message(err: unknown): string {
		const raw = err instanceof Error ? err.message : String(err);
		if (raw.includes('WRONG_PASSWORD')) {
			return 'Wrong password, or no game with that name.';
		}
		if (raw.includes('GAME_ALREADY_STARTED')) {
			return 'That game has already started.';
		}
		if (raw.includes('PASSWORD_TOO_SHORT')) {
			return `Password must be at least ${this.config.minPasswordLength} characters.`;
		}
		if (raw.includes('PASSWORD_TOO_LONG')) {
			return `Password must be at most ${this.config.maxPasswordLength} characters.`;
		}
		if (raw.includes('not found') || raw.includes('no rooms')) {
			return 'No game with that name was found.';
		}
		return raw || 'Something went wrong. Try again.';
	}
}
