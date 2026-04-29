import { io, Socket } from 'socket.io-client';

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

export class NetworkClient {
	private readonly _serverUrl: string;
	private _socket: Socket | null = null;
	private _connected: boolean = false;

	constructor(serverUrl: string) {
		this._serverUrl = serverUrl;
	}

	get isConnected(): boolean {
		return this._connected;
	}

	connect(timeoutMs: number = 3000): Promise<boolean> {
		if (this._connected) return Promise.resolve(true);

		return new Promise((resolve) => {
			const socket = io(`${this._serverUrl}/game`, {
				transports: ['websocket', 'polling'],
				timeout: timeoutMs,
				reconnection: false,
			});

			const timer = setTimeout(() => {
				socket.close();
				resolve(false);
			}, timeoutMs);

			socket.on('connect', () => {
				clearTimeout(timer);
				this._socket = socket;
				this._connected = true;
				socket.on('disconnect', () => { this._connected = false; });
				resolve(true);
			});

			socket.on('connect_error', () => {
				clearTimeout(timer);
				socket.close();
				resolve(false);
			});
		});
	}

	startRun(): Promise<RunStartedPayload | null> {
		const socket = this._socket;
		if (!socket || !this._connected) return Promise.resolve(null);
		return new Promise((resolve) => {
			const onStarted = (payload: RunStartedPayload): void => {
				socket.off('run_started', onStarted);
				resolve(payload);
			};
			socket.on('run_started', onStarted);
			socket.emit('start_run');
			setTimeout(() => {
				socket.off('run_started', onStarted);
				resolve(null);
			}, 5000);
		});
	}

	reportRun(payload: ReportRunPayload): Promise<RunRecordedPayload | null> {
		const socket = this._socket;
		if (!socket || !this._connected) return Promise.resolve(null);
		return new Promise((resolve) => {
			const onRecorded = (data: RunRecordedPayload): void => {
				socket.off('run_recorded', onRecorded);
				resolve(data);
			};
			socket.on('run_recorded', onRecorded);
			socket.emit('report_run', payload);
			setTimeout(() => {
				socket.off('run_recorded', onRecorded);
				resolve(null);
			}, 5000);
		});
	}

	ping(timeoutMs: number = 2000): Promise<number | null> {
		const socket = this._socket;
		if (!socket || !this._connected) return Promise.resolve(null);
		return new Promise((resolve) => {
			const start = performance.now();
			let resolved = false;
			const timer = setTimeout(() => {
				if (resolved) return;
				resolved = true;
				resolve(null);
			}, timeoutMs);
			socket.emit('latency_probe', () => {
				if (resolved) return;
				resolved = true;
				clearTimeout(timer);
				resolve(performance.now() - start);
			});
		});
	}

	disconnect(): void {
		this._socket?.close();
		this._socket = null;
		this._connected = false;
	}
}
