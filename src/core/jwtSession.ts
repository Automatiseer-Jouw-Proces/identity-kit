import { SignJWT, jwtVerify } from "jose";
import { type AuthConfig } from "./authConfig.js";
import { type SessionPayload, type User } from "./types.js";

export type CookieAttributes = {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax" | "strict" | "none";
  path: string;
  maxAge?: number;
  expires?: Date;
};

export type SessionCookie = {
  name: string;
  value: string;
  attributes: CookieAttributes;
};

const DEFAULT_SESSION_MAX_AGE = 60 * 60 * 8; // 8 hours

export async function createSessionCookie(
  user: User,
  config: AuthConfig,
  options?: { maxAgeSeconds?: number },
): Promise<SessionCookie> {
  const maxAge = options?.maxAgeSeconds ?? DEFAULT_SESSION_MAX_AGE;
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + maxAge;

  const payload: SessionPayload = {
    userId: user.id,
    name: user.name,
    email: user.email,
    roles: user.roles,
    groups: user.groups,
    issuedAt,
    expiresAt,
  };

  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt(issuedAt)
    .setExpirationTime(expiresAt)
    .sign(encodeSecret(config.jwtSecret));

  return {
    name: config.sessionCookieName ?? "ajp_identity_session",
    value: token,
    attributes: {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge,
    },
  };
}

export async function parseSessionCookie(
  cookieHeader: string | undefined,
  config: AuthConfig,
): Promise<SessionPayload | null> {
  if (!cookieHeader) return null;
  const cookieValue = parseCookieValue(cookieHeader, config.sessionCookieName ?? "ajp_identity_session");
  if (!cookieValue) return null;

  try {
    const { payload } = await jwtVerify(cookieValue, encodeSecret(config.jwtSecret));
    const sessionPayload = payload as SessionPayload;
    if (!sessionPayload.userId) {
      return null;
    }
    return sessionPayload;
  } catch {
    return null;
  }
}

export function createEmptySessionCookie(config: AuthConfig): SessionCookie {
  return {
    name: config.sessionCookieName ?? "ajp_identity_session",
    value: "",
    attributes: {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    },
  };
}

function parseCookieValue(header: string, name: string): string | undefined {
  const cookies = header.split(";").map((chunk) => chunk.trim().split("="));
  for (const [cookieName, ...rest] of cookies) {
    if (cookieName === name) {
      return rest.join("=");
    }
  }
  return undefined;
}

function encodeSecret(secret: string) {
  return new TextEncoder().encode(secret);
}
