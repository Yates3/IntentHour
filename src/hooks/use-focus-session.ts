import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  FocusSession,
  Interruption,
  InterruptionCategory,
  SessionOutcome,
} from "../../shared/contracts";
import { recordInterruption } from "../../shared/focus-interruption";
import {
  discardSession,
  finishSession,
  pauseSession,
  resumeSession,
} from "../../shared/focus-session-lifecycle";
import { startSession } from "../../shared/focus-session-start";
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
    const result = startSession(
      { intention, targetMinutes },
      {
        nowMs: Date.now(),
        deviceId: await getDeviceId(),
        ids: { uuid: () => crypto.randomUUID() },
      },
    );
    if (!result.ok) return;
    const next = result.value;
    await localDb.sessions.put(next);
    setSession(next);
    setInterruptions([]);
    setNow(Date.now());
  }, []);

  const togglePause = useCallback(async () => {
    if (!session) return;
    const nowMs = Date.now();
    const result = session.status === "paused"
      ? resumeSession(session, nowMs)
      : pauseSession(session, nowMs);
    if (!result.ok) return;
    const next = result.value;
    await localDb.sessions.put(next);
    setSession(next);
    setNow(Date.now());
  }, [session]);

  const markInterruption = useCallback(
    async (category: InterruptionCategory, note?: string) => {
      if (!session) return;
      const result = recordInterruption(
        session,
        { category, note },
        {
          nowMs: Date.now(),
          ids: { uuid: () => crypto.randomUUID() },
        },
      );
      if (!result.ok) return;
      const mark = result.value;
      await localDb.interruptions.put(mark);
      setInterruptions((items) => [...items, mark]);
    },
    [session],
  );

  const finish = useCallback(
    async (outcome: SessionOutcome, outcomeNote?: string) => {
      if (!session) return;
      const result = finishSession(session, { outcome, outcomeNote }, Date.now());
      if (!result.ok) return;
      const next = result.value;
      await localDb.sessions.put(next);
      setSession(undefined);
      setInterruptions([]);
      if (onSessionCompleted) void onSessionCompleted().catch(() => undefined);
    },
    [session, onSessionCompleted],
  );

  const discard = useCallback(async () => {
    if (!session) return;
    const result = discardSession(session, Date.now());
    if (!result.ok) return;
    await localDb.sessions.put(result.value);
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
