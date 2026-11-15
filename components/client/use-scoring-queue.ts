"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { submitScoringOp } from "@/app/admin/(protected)/scoring/actions";
import {
  applyOp,
  createOpQueue,
  type ActionResult,
  type OpQueue,
  type ScoringOp,
  type ScoringOpDraft,
  type ScoringState,
} from "@/lib/scoring-view";

// The scorekeeper's offline-safe save loop (schedule overview §6.1).
//
// * Every tap becomes an absolute SET op, stamped and persisted in localStorage by the
//   per-game OpQueue, then sent to the server one at a time, oldest first.
// * The screen renders OPTIMISTICALLY: the last confirmed state (`base`) with every pending
//   op re-applied on top (applyOp). A reload re-reads the pending ops from storage, so taps
//   made offline survive and replay.
// * A send that THROWS (no network, server unreachable) leaves the op queued and marks the
//   loop "offline"; it retries on the browser's `online` event and on a timer. A send the
//   server REFUSES ({ ok: false }) is dropped, its message shown, and the page refreshed so
//   the screen shows the server's truth.
// * Undo pushes the inverse SET op (the value before the tap) through the same queue.

export type SyncState = "saved" | "saving" | "offline";

const RETRY_MS = 4_000;
const UNDO_LIMIT = 100;

interface Snapshot {
  base: ScoringState;
  pending: ScoringOp[];
}

// External store over the OpQueue + confirmed base, so an ack updates `base` and `pending`
// in ONE emit (no frame where the op is neither pending nor applied). localStorage is
// touched only on the client (getServerSnapshot never reads it → hydration-safe).
class ScoringStore {
  private queue: OpQueue | null = null;
  private snap: Snapshot;
  private readonly serverSnap: Snapshot;
  private readonly listeners = new Set<() => void>();

  constructor(
    private readonly gameId: string,
    base: ScoringState,
  ) {
    this.snap = { base, pending: [] };
    this.serverSnap = this.snap;
  }

  private q(): OpQueue {
    if (!this.queue) {
      this.queue = createOpQueue(window.localStorage, this.gameId);
      this.snap = { ...this.snap, pending: this.queue.list() };
    }
    return this.queue;
  }

  private emit(next: Snapshot) {
    this.snap = next;
    for (const l of this.listeners) l();
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): Snapshot => {
    this.q();
    return this.snap;
  };

  getServerSnapshot = (): Snapshot => this.serverSnap;

  enqueue(draft: ScoringOpDraft) {
    const q = this.q();
    q.enqueue(draft);
    this.emit({ ...this.snap, pending: q.list() });
  }

  peek(): ScoringOp | null {
    return this.q().peek();
  }

  // The server answered `op`: drop it from the queue; fold it into base if accepted.
  settle(op: ScoringOp, accepted: boolean) {
    const q = this.q();
    q.ack(op.seq);
    this.emit({ base: accepted ? applyOp(this.snap.base, op) : this.snap.base, pending: q.list() });
  }

  // Fresh server state arrived (a re-render): it becomes the confirmed base.
  resetBase(base: ScoringState) {
    if (base !== this.snap.base) this.emit({ ...this.snap, base });
  }
}

const noopSubscribe = () => () => {};

function subscribeOnline(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

export function useScoringQueue(initial: ScoringState) {
  const router = useRouter();
  const [store] = useState(() => new ScoringStore(initial.id, initial));
  const { base, pending } = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );
  // false during SSR + hydration: the pill reads "saving" and taps are not yet wired, so a
  // test (or a fast thumb) never taps a not-yet-hydrated button and loses the tap.
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);

  const [stalled, setStalled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [undoStack, setUndoStack] = useState<ScoringOpDraft[]>([]);
  const sending = useRef(false);

  // A server re-render (after a refresh / revalidation) hands us fresh confirmed state.
  useEffect(() => {
    store.resetBase(initial);
  }, [store, initial]);

  const flush = useCallback(async () => {
    if (sending.current) return;
    sending.current = true;
    let refused = false;
    try {
      for (let op = store.peek(); op; op = store.peek()) {
        let result: ActionResult;
        try {
          result = await submitScoringOp(op);
        } catch {
          setStalled(true); // network / server unreachable: keep it queued, retry later
          return;
        }
        setStalled(false);
        if (!result.ok) {
          refused = true;
          setError(result.error);
        }
        store.settle(op, result.ok);
      }
    } finally {
      sending.current = false;
    }
    if (refused) router.refresh();
  }, [store, router]);

  // Send whatever is queued on load (taps saved offline before a reload) and when the
  // browser comes back online.
  useEffect(() => {
    if (online) void flush();
  }, [online, flush]);

  // While a send is failing, keep retrying.
  useEffect(() => {
    if (!stalled) return;
    const timer = window.setInterval(() => void flush(), RETRY_MS);
    return () => window.clearInterval(timer);
  }, [stalled, flush]);

  const state = pending.reduce<ScoringState>(applyOp, base);

  // Record a tap: `draft` is the new absolute value; `inverse` restores the old one (null =
  // not undoable).
  const commit = useCallback(
    (draft: ScoringOpDraft, inverse: ScoringOpDraft | null) => {
      store.enqueue(draft);
      if (inverse) setUndoStack((s) => [...s.slice(-(UNDO_LIMIT - 1)), inverse]);
      setError(null);
      void flush();
    },
    [store, flush],
  );

  const undo = useCallback(() => {
    const last = undoStack.at(-1);
    if (!last) return;
    setUndoStack((s) => s.slice(0, -1));
    store.enqueue(last);
    setError(null);
    void flush();
  }, [undoStack, store, flush]);

  const clearUndo = useCallback(() => setUndoStack([]), []);

  const status: SyncState = !hydrated
    ? "saving"
    : !online || (stalled && pending.length > 0)
      ? "offline"
      : pending.length > 0
        ? "saving"
        : "saved";

  return {
    state,
    status,
    ready: hydrated,
    error,
    dismissError: () => setError(null),
    canUndo: hydrated && undoStack.length > 0,
    commit,
    undo,
    clearUndo,
  };
}

// What the scoring sections receive.
export type Scoring = ReturnType<typeof useScoringQueue>;
