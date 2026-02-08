/**
 * Polyfill for crypto.randomUUID().
 *
 * @tambo-ai/react calls `crypto.randomUUID()` directly without a fallback.
 * This fails in:
 *   - Browsers in non-secure contexts (HTTP, not localhost)
 *   - Node.js < 19 during SSR
 *
 * This polyfill ensures it's always available.
 */
if (typeof globalThis.crypto === "undefined") {
  // Node.js < 19 SSR case — use the built-in crypto module
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nodeCrypto = require("crypto");
  globalThis.crypto = nodeCrypto as unknown as Crypto;
} else if (typeof globalThis.crypto.randomUUID !== "function") {
  // Browser in non-secure context, or older environment
  globalThis.crypto.randomUUID = function randomUUID(): `${string}-${string}-${string}-${string}-${string}` {
    // RFC 4122 version 4 UUID using getRandomValues (available in all modern browsers)
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    // Set version (4) and variant (10xx) bits
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
      ""
    );
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}` as `${string}-${string}-${string}-${string}-${string}`;
  };
}
