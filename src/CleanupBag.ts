export class CleanupBag {
	private readonly callbacks: (() => void)[] = [];
	private disposed = false;

	add(...callbacks: (() => void)[]): void {
		if (this.disposed) for (const callback of callbacks) callback();
		else this.callbacks.push(...callbacks);
	}

	dispose(): void {
		if (this.disposed) return;
		this.disposed = true;
		while (this.callbacks.length) this.callbacks.pop()!();
	}
}

export class CleanupRegistry<TKey> {
	private readonly scopes = new Map<TKey, CleanupBag>();
	private disposed = false;

	replace(key: TKey): CleanupBag {
		this.delete(key);
		const scope = new CleanupBag();
		if (this.disposed) scope.dispose();
		else this.scopes.set(key, scope);
		return scope;
	}

	isCurrent(key: TKey, scope: CleanupBag): boolean {
		return this.scopes.get(key) === scope;
	}

	delete(key: TKey): void {
		const scope = this.scopes.get(key);
		if (!scope) return;
		this.scopes.delete(key);
		scope.dispose();
	}

	dispose(): void {
		if (this.disposed) return;
		this.disposed = true;
		for (const scope of this.scopes.values()) scope.dispose();
		this.scopes.clear();
	}
}
