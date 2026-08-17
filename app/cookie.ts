// Cookie 读取助手（用于会话令牌）。

export function getCookie(request: Request, name: string): string | null {
  const header = request.headers.get("Cookie") || "";
  const match = header
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  if (!match) return null;
  const value = match.slice(name.length + 1);
  return value ? decodeURIComponent(value) : null;
}
