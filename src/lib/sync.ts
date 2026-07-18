import type { FocusSession, Interruption } from "../../shared/contracts";
import { apiFetch } from "./api";
import { localDb } from "./local-db";

interface PullResponse {
  sessions: FocusSession[];
  interruptions: Interruption[];
  nextCursor: string | null;
}

export async function syncCompletedSessions(): Promise<void> {
  const sessions = await localDb.sessions
    .where("status")
    .equals("completed")
    .toArray();
  const ids = sessions.map((session) => session.id);
  const interruptions = ids.length
    ? await localDb.interruptions.where("sessionId").anyOf(ids).toArray()
    : [];
  for (let index = 0; index < sessions.length; index += 200) {
    const batch = sessions.slice(index, index + 200);
    const batchIds = new Set(batch.map((session) => session.id));
    await apiFetch("/api/sync/push", {
      method: "POST",
      body: JSON.stringify({
        sessions: batch,
        interruptions: interruptions.filter((item) => batchIds.has(item.sessionId)),
      }),
    });
  }
  let cursor: string | null = null;
  do {
    const result: PullResponse = await apiFetch(`/api/sync/pull${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`);
    await localDb.transaction("rw", localDb.sessions, localDb.interruptions, async () => {
      await localDb.sessions.bulkPut(result.sessions);
      await localDb.interruptions.bulkPut(result.interruptions);
    });
    cursor = result.nextCursor;
  } while (cursor);
}
