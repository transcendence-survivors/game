export function getCachedPromise<TKey, TValue>(
	cache: Map<TKey, Promise<TValue>>,
	key: TKey,
	create: () => Promise<TValue>,
): Promise<TValue> {
	const cached = cache.get(key);
	if (cached) return cached;

	const pending = create();
	cache.set(key, pending);
	void pending.catch(() => {
		if (cache.get(key) === pending) cache.delete(key);
	});
	return pending;
}
