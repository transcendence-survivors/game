import { Client, Room } from 'colyseus.js';

export interface RunStartedPayload {
	runId: string;
	startedAt: number;
}

export interface ReportRunPayload {
	score: number;
	survivedMs: number;
}

export interface RunRecordedPayload {
	runId: string;
	score: number;
	survivedMs: number;
}

interface PendingPing {
	resolve: (latency: number | null) => void;
	sentAt: number;
	timer: ReturnType<typeof setTimeout>;
}

export class NetworkClient {
	private readonly _serverUrl: string;
	private _client: Client | null = null;
	private _room: Room | null = null;
	private _connected: boolean = false;
	private readonly _pendingPings: PendingPing[] = [];

	constructor(serverUrl: string) {
		this._serverUrl = serverUrl;
	}

	get isConnected(): boolean {
		return this._connected;
	}

	get sessionId(): string | null {
		return this._room?.sessionId ?? null;
	}

	async connect(timeoutMs: number = 3000): Promise<boolean> {
		if (this._connected) return true;
		try {
			this._client = new Client(this._serverUrl);
			const joinPromise = this._client.joinOrCreate('survivor');
			const room = await Promise.race([
				joinPromise,
				new Promise<never>((_, reject) =>
					setTimeout(() => reject(new Error('connect timeout')), timeoutMs),
				),
			]);
			this._room = room as Room;
			this._connected = true;

			this._room.onMessage('latency_probe_ack', () => {
				const pending = this._pendingPings.shift();
				if (!pending) return;
				clearTimeout(pending.timer);
				pending.resolve(performance.now() - pending.sentAt);
			});

			this._room.onLeave(() => {
				this._connected = false;
				this._cancelPendingPings();
			});

			return true;
		} catch {
			this._connected = false;
			return false;
		}
	}

	startRun(): Promise<RunStartedPayload | null> {
		if (!this._room || !this._connected) return Promise.resolve(null);
		return Promise.resolve({
			runId: this._room.sessionId,
			startedAt: Date.now(),
		});
	}

	reportRun(payload: ReportRunPayload): Promise<RunRecordedPayload | null> {
		const room = this._room;
		if (!room || !this._connected) return Promise.resolve(null);
		room.send('report_run', payload);
		return Promise.resolve({
			runId: room.sessionId,
			score: payload.score,
			survivedMs: payload.survivedMs,
		});
	}

	ping(timeoutMs: number = 2000): Promise<number | null> {
		const room = this._room;
		if (!room || !this._connected) return Promise.resolve(null);
		return new Promise((resolve) => {
			const sentAt = performance.now();
			const timer = setTimeout(() => {
				const idx = this._pendingPings.findIndex(p => p.sentAt === sentAt);
				if (idx >= 0) {
					this._pendingPings.splice(idx, 1);
					resolve(null);
				}
			}, timeoutMs);
			this._pendingPings.push({ resolve, sentAt, timer });
			room.send('latency_probe');
		});
	}

	disconnect(): void {
		this._cancelPendingPings();
		this._room?.leave();
		this._room = null;
		this._client = null;
		this._connected = false;
	}

	private _cancelPendingPings(): void {
		for (const p of this._pendingPings) {
			clearTimeout(p.timer);
			p.resolve(null);
		}
		this._pendingPings.length = 0;
	}
}
