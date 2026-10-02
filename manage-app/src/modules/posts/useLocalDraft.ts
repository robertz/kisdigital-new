import { useEffect, useState } from "react";

interface Stored<T> {
	data: T;
	savedAt: number;
}

function read<T>(key: string): Stored<T> | null {
	try {
		const raw = localStorage.getItem(key);
		const parsed = raw ? (JSON.parse(raw) as Stored<T>) : null;
		return parsed && parsed.data ? parsed : null;
	} catch {
		return null;
	}
}

function remove(key: string) {
	try {
		localStorage.removeItem(key);
	} catch {}
}

/**
 * Keeps a copy of unsaved edits in localStorage so a closed tab or a crash
 * doesn't lose work. `pending` is a stored copy that differs from what the
 * server has, offered once when the editor opens.
 */
export function useLocalDraft<T>(key: string, draft: T, synced: T) {
	const [pending, setPending] = useState<Stored<T> | null>(() => {
		const stored = read<T>(key);
		return stored && JSON.stringify(stored.data) !== JSON.stringify(synced) ? stored : null;
	});
	const [savedAt, setSavedAt] = useState<number | null>(null);

	const serialized = JSON.stringify(draft);
	const dirty = serialized !== JSON.stringify(synced);

	useEffect(() => {
		// An offered copy is left alone until it's restored or discarded.
		if (!dirty || pending) return;
		const timer = window.setTimeout(() => {
			try {
				localStorage.setItem(key, JSON.stringify({ data: JSON.parse(serialized), savedAt: Date.now() }));
				setSavedAt(Date.now());
			} catch {}
		}, 1500);
		return () => window.clearTimeout(timer);
	}, [key, serialized, dirty, pending]);

	return {
		dirty,
		pending,
		savedAt,
		dismissPending: () => setPending(null),
		discardPending: () => {
			remove(key);
			setPending(null);
		},
		clear: () => {
			remove(key);
			setSavedAt(null);
		},
	};
}
