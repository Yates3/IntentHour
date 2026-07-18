/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PADDLE_CLIENT_TOKEN?: string;
  readonly VITE_PADDLE_ENVIRONMENT?: "sandbox" | "production";
  readonly VITE_TURNSTILE_SITE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
