import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  FocusSession,
  Interruption,
  InterruptionCategory,
  SessionOutcome,
} from "../../shared/contracts";
import {
  getCurrentSession,
  getDeviceId,
  getSessionInterruptions,
  localDb,
  pruneFreeHistory,
} from "../lib/local-db";
import { remainingMs } from "../lib/time";

interface StartInput {
  intention: string;
  targetMinutes: number;
}

export function useFocusSession(onSessionCompleted?: () => Promise<void>) {
  const [session, setSession] = useState<FocusSession>();
  const [interruptions, setInterruptions] = useState<Interruption[]>([]);
  const [now, setNow] = useState(Date.now());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await pruneFreeHistory();
      const current = await getCurrentSession();
      const marks = current ? await getSessionInterruptions(current.id) : [];
      if (!cancelled) {
        setSession(current);
        setInterruptions(marks);
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!session || session.status === "paused") return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [session]);

  const start = useCallback(async ({ intention, targetMinutes }: StartInput) => {
    const timestamp = new Date().toISOString();
    const next: FocusSession = {
      id: crypto.randomUUID(),
      deviceId: await getDeviceId(),
      intention: intention.trim(),
      targetMinutes,
      status: "running",
      startedAt: timestamp,
      pausedAt: null,
      endedAt: null,
      totalPausedMs: 0,
      outcome: null,
      outcomeNote: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await localDb.sessions.put(next);
    setSession(next);
    setInterruptions([]);
    setNow(Date.now());
  }, []);

  const togglePause = useCallback(async () => {
    if (!session) return;
    const timestamp = new Date().toISOString();
    const next: FocusSession = session.status === "paused"
      ? {
          ...session,
          status: "running",
          totalPausedMs:
            session.totalPausedMs +
            (session.pausedAt ? Date.now() - Date.parse(session.pausedAt) : 0),
          pausedAt: null,
          updatedAt: timestamp,
        }
      : { ...session, status: "paused", pausedAt: timestamp, updatedAt: timestamp };
    await localDb.sessions.put(next);
    setSession(next);
    setNow(Date.now());
  }, [session]);

  const markInterruption = useCallback(
    async (category: InterruptionCategory, note?: string) => {
      if (!session) return;
      const timestamp = new Date().toISOString();
      const mark: Interruption = {
        id: crypto.randomUUID(),
        sessionId: session.id,
        category,
        occurredAt: timestamp,
        offsetSeconds: Math.floor((Date.now() - Date.parse(session.startedAt)) / 1000),
        note: note?.trim() || null,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      await localDb.interruptions.put(mark);
      setInterruptions((items) => [...items, mark]);
    },
    [session],
  );

  const finish = useCallback(
    async (outcome: SessionOutcome, outcomeNote?: string) => {
      if (!session) return;
      const timestamp = new Date().toISOString();
      const currentPause = session.status === "paused" && session.pausedAt
        ? Date.now() - Date.parse(session.pausedAt)
        : 0;
      const next: FocusSession = {
        ...session,
        status: "completed",
        endedAt: timestamp,
        pausedAt: null,
        totalPausedMs: session.totalPausedMs + currentPause,
        outcome,
        outcomeNote: outcomeNote?.trim() || null,
        updatedAt: timestamp,
      };
      await localDb.sessions.put(next);
      setSession(undefined);
      setInterruptions([]);
      if (onSessionCompleted) void onSessionCompleted().catch(() => undefined);
    },
    [session, onSessionCompleted],
  );

  const discard = useCallback(async () => {
    if (!session) return;
    const timestamp = new Date().toISOString();
    await localDb.sessions.put({
      ...session,
      status: "discarded",
      endedAt: timestamp,
      pausedAt: null,
      updatedAt: timestamp,
    });
    setSession(undefined);
    setInterruptions([]);
  }, [session]);

  return useMemo(
    () => ({
      ready,
      session,
      interruptions,
      remaining: session ? remainingMs(session, now) : 0,
      start,
      togglePause,
      markInterruption,
      finish,
      discard,
    }),
    [ready, session, interruptions, now, start, togglePause, markInterruption, finish, discard],
  );
}
