import { type AuthConfig } from "../../core/authConfig.js";
import { createAuthConfig } from "../../core/authConfig.js";
import { getServerUser } from "../server/user.js";

export type AuthMiddlewareOptions = {
  protectedPaths: string[];
  redirectTo?: string;
};

/**
 * Minimal middleware helper for Next.js middleware.
 * Returns a Response redirecting to the login page when the path is protected and no session is present.
 */
export function createAuthMiddleware(config: AuthConfig, options: AuthMiddlewareOptions) {
  const normalizedConfig = createAuthConfig(config);
  return async function authMiddleware(request: Request): Promise<Response | undefined> {
    const url = new URL(request.url);
    const isProtected = options.protectedPaths.some((pattern) => matchesPattern(url.pathname, pattern));
    if (!isProtected) return undefined;

    const user = await getServerUser(request, normalizedConfig);
    if (user) return undefined;

    const redirectTo = options.redirectTo ?? "/login";
    const redirectUrl = new URL(redirectTo, url.origin);
    return new Response(null, {
      status: 302,
      headers: {
        Location: redirectUrl.toString(),
        "Cache-Control": "no-store",
      },
    });
  };
}

function matchesPattern(pathname: string, pattern: string): boolean {
  if (pattern.endsWith("*")) {
    const prefix = pattern.slice(0, -1);
    return pathname.startsWith(prefix);
  }
  return pathname === pattern;
}
