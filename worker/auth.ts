import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth";
import { magicLink } from "better-auth/plugins";
import { Resend } from "resend";
import { authOrigins } from "./auth-origins";
import { database } from "./db/client";
import { account, session, user, verification } from "./db/schema";

type AuthEnvironment = Env & {
  APP_ALLOWED_ORIGINS?: string;
};

export function createAuth(env: AuthEnvironment) {
  const googleConfigured = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
  const origins = authOrigins(env);
  const primaryOrigin = origins[0] ?? env.BETTER_AUTH_URL ?? env.APP_URL;
  const isDevelopment = String(env.APP_ENV) === "development";
  return betterAuth({
    appName: "IntentHour",
    baseURL: primaryOrigin,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: origins,
    database: drizzleAdapter(database(env), {
      provider: "sqlite",
      schema: { user, session, account, verification },
    }),
    socialProviders: googleConfigured
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
          },
        }
      : undefined,
    plugins: [
      magicLink({
        expiresIn: 300,
        storeToken: "hashed",
        sendMagicLink: async ({ email, url }) => {
          if (!env.RESEND_API_KEY || !env.RESEND_FROM) {
            throw new Error("EMAIL_PROVIDER_NOT_CONFIGURED");
          }
          const result = await new Resend(env.RESEND_API_KEY).emails.send({
            from: env.RESEND_FROM,
            to: email,
            subject: "Your IntentHour sign-in link",
            html: `<div style="background:#071017;color:#f2f3f3;padding:32px;font-family:Arial,sans-serif"><h1 style="font-size:24px">Return to the work you chose.</h1><p style="color:#a5adb5;line-height:1.6">Use this single-use link to sign in to IntentHour. It expires in five minutes.</p><p><a href="${escapeHtml(url)}" style="display:inline-block;padding:14px 22px;border:1px solid #ff9d00;color:#ffad1f;text-decoration:none">SIGN IN TO INTENTHOUR</a></p><p style="color:#77818a;font-size:12px">If you did not request this, ignore this email.</p></div>`,
          });
          if (result.error) throw new Error("EMAIL_DELIVERY_FAILED");
        },
      }),
    ],
    rateLimit: { enabled: true, window: 60, max: 10 },
    advanced: {
      useSecureCookies: !isDevelopment,
      cookiePrefix: "intenthour",
      ipAddress: {
        ipAddressHeaders: ["cf-connecting-ip", "x-forwarded-for"],
      },
    },
  });
}

export async function getAuthSession(request: Request, env: AuthEnvironment) {
  return createAuth(env).api.getSession({ headers: withDevelopmentClientIp(request, env).headers });
}

export function withDevelopmentClientIp(request: Request, env: Env): Request {
  if (String(env.APP_ENV) === "production" || request.headers.has("cf-connecting-ip") || request.headers.has("x-forwarded-for")) return request;
  const headers = new Headers(request.headers);
  headers.set("x-forwarded-for", "127.0.0.1");
  return new Request(request, { headers });
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
