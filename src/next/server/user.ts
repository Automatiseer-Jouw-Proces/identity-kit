import { type AuthConfig } from "../../core/authConfig.js";
import { parseSessionCookie } from "../../core/jwtSession.js";
import { type User } from "../../core/types.js";

export async function getServerUser(request: Request, config: AuthConfig): Promise<User | null> {
  const session = await parseSessionCookie(request.headers.get("cookie") || undefined, config);
  if (!session?.userId) return null;

  return {
    id: session.userId,
    name: session.name ?? null,
    email: session.email ?? null,
    ...(session.roles ? { roles: session.roles } : {}),
    ...(session.groups ? { groups: session.groups } : {}),
  };
}

export async function requireAuth(
  request: Request,
  config: AuthConfig,
  options?: { redirectTo?: string },
): Promise<User | Response> {
  const user = await getServerUser(request, config);
  if (user) return user;

  const redirectTo = options?.redirectTo ?? "/login";
  return new Response(null, {
    status: 302,
    headers: {
      Location: redirectTo,
      "Cache-Control": "no-store",
    },
  });
}
