export interface DisposableView {
	dispose(): void;
}

export class AsyncViewRegistry<TView extends DisposableView> {
	private readonly views = new Map<string, TView>();
	private readonly pending = new Map<string, object>();
	private disposed = false;

	async add(id: string, create: () => Promise<TView>): Promise<void> {
		if (this.disposed) return;
		const token = {};
		this.pending.set(id, token);
		const view = await create();
		if (this.disposed || this.pending.get(id) !== token) {
			view.dispose();
			return;
		}
		this.pending.delete(id);
		this.views.get(id)?.dispose();
		this.views.set(id, view);
	}

	remove(id: string): void {
		this.pending.delete(id);
		this.views.get(id)?.dispose();
		this.views.delete(id);
	}

	forEach(callback: (view: TView, id: string) => void): void {
		this.views.forEach(callback);
	}

	dispose(): void {
		this.disposed = true;
		this.pending.clear();
		this.views.forEach((view) => view.dispose());
		this.views.clear();
	}
}
