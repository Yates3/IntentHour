import { safeEqual } from "./security";

interface PaddleSignature {
  ts: number;
  signatures: string[];
}

export async function verifyPaddleWebhook(rawBody: string, header: string | null, secret: string): Promise<boolean> {
  if (!header || !secret) return false;
  const parsed = parseSignature(header);
  if (!parsed || Math.abs(Date.now() / 1000 - parsed.ts) > 300) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${parsed.ts}:${rawBody}`));
  const expected = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return parsed.signatures.some((signature) => safeEqual(signature, expected));
}

function parseSignature(header: string): PaddleSignature | null {
  const values = header.split(";").map((part) => part.trim().split("="));
  const timestamp = values.find(([key]) => key === "ts")?.[1];
  const signatures = values.filter(([key]) => key === "h1").map(([, value]) => value).filter((value): value is string => Boolean(value));
  if (!timestamp || signatures.length === 0 || !Number.isFinite(Number(timestamp))) return null;
  return { ts: Number(timestamp), signatures };
}
