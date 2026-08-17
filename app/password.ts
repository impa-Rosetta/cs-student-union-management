// 密码哈希工具（正式认证基础）。
// 使用 Web Crypto PBKDF2-SHA256（100k 迭代，兼容 Cloudflare Workers 与 Node）。
// 存储格式：`<salt_hex>:<derived_key_hex>`。

const ITERATIONS = 100_000;
const KEY_BITS = 256;

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomSaltHex(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return toHex(bytes);
}

async function derive(password: string, salt: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const keyMaterial = await globalThis.crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await globalThis.crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: encoder.encode(salt), iterations: ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    KEY_BITS,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomSaltHex();
  const derived = await derive(password, salt);
  return `${salt}:${toHex(derived)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const derived = toHex(await derive(password, salt));
  if (derived.length !== hash.length) return false;
  // 常量时间比较，避免时序侧信道。
  let diff = 0;
  for (let i = 0; i < derived.length; i++) {
    diff |= derived.charCodeAt(i) ^ hash.charCodeAt(i);
  }
  return diff === 0;
}
