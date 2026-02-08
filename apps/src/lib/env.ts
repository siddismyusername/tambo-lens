/**
 * Validate required environment variables on server startup.
 * Import this module early (e.g. from db.ts or auth.ts) to get clear,
 * immediate errors instead of cryptic failures later.
 */

const required = [
  "DATABASE_URL",
  "ENCRYPTION_KEY",
  "AUTH_SECRET",
  "OPENAI_API_KEY",
  "NEXT_PUBLIC_TAMBO_API_KEY",
] as const;

const missing: string[] = [];

for (const key of required) {
  if (!process.env[key]) {
    missing.push(key);
  }
}

if (process.env.ENCRYPTION_KEY && process.env.ENCRYPTION_KEY.length !== 64) {
  console.warn(
    `[env] ENCRYPTION_KEY should be exactly 64 hex characters (got ${process.env.ENCRYPTION_KEY.length})`
  );
}

if (missing.length > 0 && typeof window === "undefined") {
  // Only warn on the server — client bundles won't have server-side vars
  console.error(
    `[env] Missing required environment variables:\n${missing.map((k) => `  - ${k}`).join("\n")}\n` +
      `Copy .env.example to .env and fill in the values.`
  );
}
