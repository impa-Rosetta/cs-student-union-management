export type PlatformIdentity = {
  externalUserId: string;
  email: string;
  fullName: string;
};

function decodeHeader(value: string | null) {
  if (!value) return "";
  try { return decodeURIComponent(value); } catch { return value; }
}

export function platformIdentityFromHeaders(headers: Headers): PlatformIdentity | null {
  const email = headers.get("oai-authenticated-user-email")?.trim().toLowerCase() || "";
  if (!email) return null;

  return {
    externalUserId: headers.get("oai-authenticated-user-id")?.trim() || `email:${email}`,
    email,
    fullName: decodeHeader(headers.get("oai-authenticated-user-full-name")).trim(),
  };
}
