import { type CookieAttributes, type SessionCookie } from "../core/jwtSession.js";

export type CookieDefinition = {
  name: string;
  value: string;
  attributes: CookieAttributes;
};

export function serializeCookie(cookie: CookieDefinition | SessionCookie): string {
  const parts = [`${cookie.name}=${encodeURIComponent(cookie.value)}`];
  const { path, httpOnly, secure, sameSite, maxAge, expires } = cookie.attributes;
  if (path) parts.push(`Path=${path}`);
  if (httpOnly) parts.push("HttpOnly");
  if (secure) parts.push("Secure");
  if (sameSite) parts.push(`SameSite=${capitalize(sameSite)}`);
  if (typeof maxAge === "number") parts.push(`Max-Age=${Math.floor(maxAge)}`);
  if (expires) parts.push(`Expires=${expires.toUTCString()}`);
  return parts.join("; ");
}

export function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  return header.split(";").reduce<Record<string, string>>((acc, raw) => {
    const [name, ...rest] = raw.trim().split("=");
    if (!name) return acc;
    acc[name] = decodeURIComponent(rest.join("="));
    return acc;
  }, {});
}

function capitalize(value: string): string {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}
