import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  FocusSession,
  Interruption,
  InterruptionCategory,
  SessionOutcome,
} from "../../../shared/contracts";
import { recordInterruption } from "../../../shared/focus-interruption";
import {
  discardSession,
  finishSession,
  pauseSession,
  resumeSession,
  type FocusLifecycleError,
} from "../../../shared/focus-session-lifecycle";
import {
  startSession,
  type StartSessionInput,
} from "../../../shared/focus-session-start";
import { getElapsedMs, getRemainingMs } from "../../../shared/focus-time";
import { parseTargetNotificationDeliveredPayload } from "../../ipc-contracts";
import { desktopLocalStore } from "./local-store";

function messageFor(error: FocusLifecycleError): string {
  switch (error) {
    case "INVALID_INTENTION":
      return "Enter a concrete outcome before starting.";
    case "INVALID_TARGET_DURATION":
      return "Choose a focus duration between 5 and 240 minutes.";
    case "SESSION_NOT_RUNNING":
      return "Resume the session before recording an interruption.";
    case "INVALID_RESULT_NOTE":
      return "Keep the result note under 500 characters.";
    default:
      return "That action could not be saved. Try again.";
  }
}

export function useDesktopFocus() {
  const [session, setSession] = useState<FocusSession>();
  const [interruptions, setInterruptions] = useState<Interruption[]>([]);
  const [history, setHistory] = useState<FocusSession[]>([]);
  const [historyInterruptionCounts, setHistoryInterruptionCounts] =
    useState<Record<string, number>>({});
  const [ready, setReady] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());
  const [error, setError] = useState<string>();
  const [targetReminderSessionId, setTargetReminderSessionId] =
    useState<string>();

  const refreshHistory = useCallback(async () => {
    const ended = await desktopLocalStore.listEndedSessions();
    const counts = await Promise.all(
      ended.map(async (item) => [
        item.id,
        (await desktopLocalStore.listInterruptionsBySession(item.id)).length,
      ] as const),
    );
    setHistory(ended);
    setHistoryInterruptionCounts(Object.fromEntries(counts));
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const active = await desktopLocalStore.getActiveSession();
      const marks = active
        ? await desktopLocalStore.listInterruptionsBySession(active.id)
        : [];
      const ended = await desktopLocalStore.listEndedSessions();
      const counts = await Promise.all(
        ended.map(async (item) => [
          item.id,
          (await desktopLocalStore.listInterruptionsBySession(item.id)).length,
        ] as const),
      );
      if (!cancelled) {
        setSession(active);
        setInterruptions(marks);
        setHistory(ended);
        setHistoryInterruptionCounts(Object.fromEntries(counts));
        setNowMs(Date.now());
        setReady(true);
      }
    })().catch(() => {
      if (!cancelled) {
        setError("Local focus data could not be opened.");
        setReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!session || session.status !== "running") return;
    const timer = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [session]);

  useEffect(() => {
    const desktopBridge = window.intentHourDesktop;
    if (!desktopBridge) return;
    return desktopBridge.onFocusTargetNotificationDelivered((value) => {
      const payload = parseTargetNotificationDeliveredPayload(value);
      if (payload) setTargetReminderSessionId(payload.sessionId);
    });
  }, []);

  useEffect(() => {
    const desktopBridge = window.intentHourDesktop;
    if (!desktopBridge || !session) return;

    if (session.status === "running") {
      const currentTime = Date.now();
      desktopBridge.scheduleFocusTargetNotification({
        sessionId: session.id,
        triggerAtMs: currentTime + getRemainingMs(session, currentTime),
      });
    } else {
      desktopBridge.cancelFocusTargetNotification({ sessionId: session.id });
    }

    return () => {
      desktopBridge.cancelFocusTargetNotification({ sessionId: session.id });
    };
  }, [
    session?.id,
    session?.status,
    session?.startedAt,
    session?.pausedAt,
    session?.totalPausedMs,
    session?.targetMinutes,
  ]);

  const start = useCallback(async (input: StartSessionInput) => {
    const result = startSession(input, {
      nowMs: Date.now(),
      deviceId: await desktopLocalStore.getDeviceId(),
      ids: { uuid: () => crypto.randomUUID() },
    });
    if (!result.ok) {
      setError(messageFor(result.error));
      return false;
    }

    await desktopLocalStore.saveSession(result.value);
    setSession(result.value);
    setInterruptions([]);
    setNowMs(Date.now());
    setError(undefined);
    return true;
  }, []);

  const togglePause = useCallback(async () => {
    if (!session) return false;
    const result = session.status === "paused"
      ? resumeSession(session, Date.now())
      : pauseSession(session, Date.now());
    if (!result.ok) {
      setError(messageFor(result.error));
      return false;
    }

    await desktopLocalStore.saveSession(result.value);
    setSession(result.value);
    setNowMs(Date.now());
    setError(undefined);
    return true;
  }, [session]);

  const markInterruption = useCallback(async (
    category: InterruptionCategory,
    note?: string,
  ) => {
    if (!session) return false;
    const result = recordInterruption(
      session,
      { category, note },
      {
        nowMs: Date.now(),
        ids: { uuid: () => crypto.randomUUID() },
      },
    );
    if (!result.ok) {
      setError(messageFor(result.error));
      return false;
    }

    await desktopLocalStore.saveInterruption(result.value);
    setInterruptions((current) => [...current, result.value]);
    setError(undefined);
    return true;
  }, [session]);

  const finish = useCallback(async (
    outcome: SessionOutcome,
    outcomeNote?: string,
  ) => {
    if (!session) return false;
    const result = finishSession(
      session,
      { outcome, outcomeNote },
      Date.now(),
    );
    if (!result.ok) {
      setError(messageFor(result.error));
      return false;
    }

    await desktopLocalStore.saveSession(result.value);
    setSession(undefined);
    setInterruptions([]);
    setError(undefined);
    await refreshHistory();
    return true;
  }, [refreshHistory, session]);

  const discard = useCallback(async () => {
    if (!session) return false;
    const result = discardSession(session, Date.now());
    if (!result.ok) {
      setError(messageFor(result.error));
      return false;
    }

    await desktopLocalStore.saveSession(result.value);
    setSession(undefined);
    setInterruptions([]);
    setError(undefined);
    await refreshHistory();
    return true;
  }, [refreshHistory, session]);

  return useMemo(() => ({
    ready,
    session,
    interruptions,
    history,
    historyInterruptionCounts,
    targetReminderSent: targetReminderSessionId === session?.id,
    error,
    elapsedMs: session ? getElapsedMs(session, nowMs) : 0,
    remainingMs: session ? getRemainingMs(session, nowMs) : 0,
    start,
    togglePause,
    markInterruption,
    finish,
    discard,
  }), [
    ready,
    session,
    interruptions,
    history,
    historyInterruptionCounts,
    targetReminderSessionId,
    error,
    nowMs,
    start,
    togglePause,
    markInterruption,
    finish,
    discard,
  ]);
}
