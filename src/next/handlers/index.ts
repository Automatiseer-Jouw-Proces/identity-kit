import { createAuthProvider } from "../../core/authProvider.js";
import { createAuthConfig, type AuthConfig } from "../../core/authConfig.js";
import { createEmptySessionCookie, createSessionCookie, parseSessionCookie } from "../../core/jwtSession.js";
import { type User } from "../../core/types.js";
import { parseCookies, serializeCookie } from "../cookies.js";

const STATE_COOKIE_NAME = "ajp_identity_state";
const NONCE_COOKIE_NAME = "ajp_identity_nonce";
const REDIRECT_COOKIE_NAME = "ajp_identity_redirect";
const STATE_COOKIE_MAX_AGE = 60 * 5; // 5 minutes

export type AppRouterHandlers = {
  loginHandler: (request: Request) => Promise<Response>;
  callbackHandler: (request: Request) => Promise<Response>;
  logoutHandler: (request: Request) => Promise<Response>;
  sessionHandler: (request: Request) => Promise<Response>;
};

export function createAppRouterHandlers(config: AuthConfig): AppRouterHandlers {
  const normalizedConfig = createAuthConfig(config);
  const provider = createAuthProvider(normalizedConfig);

  return {
    loginHandler: async (request: Request) => {
      const state = generateNonce();
      const nonce = generateNonce();
      const redirectParam = new URL(request.url).searchParams.get("redirect");
      const redirectOverride = redirectParam && isSafeRedirect(redirectParam) ? redirectParam : undefined;

      const authorizationUrl = provider.getAuthorizationUrl(state, nonce);
      const headers = new Headers({
        Location: authorizationUrl,
        "Cache-Control": "no-store",
      });

      headers.append(
        "Set-Cookie",
        serializeCookie({
          name: STATE_COOKIE_NAME,
          value: state,
          attributes: {
            httpOnly: true,
            secure: true,
            sameSite: "lax",
            path: "/",
            maxAge: STATE_COOKIE_MAX_AGE,
          },
        }),
      );

      headers.append(
        "Set-Cookie",
        serializeCookie({
          name: NONCE_COOKIE_NAME,
          value: nonce,
          attributes: {
            httpOnly: true,
            secure: true,
            sameSite: "lax",
            path: "/",
            maxAge: STATE_COOKIE_MAX_AGE,
          },
        }),
      );

      if (redirectOverride) {
        headers.append(
          "Set-Cookie",
          serializeCookie({
            name: REDIRECT_COOKIE_NAME,
            value: redirectOverride,
            attributes: {
              httpOnly: true,
              secure: true,
              sameSite: "lax",
              path: "/",
              maxAge: STATE_COOKIE_MAX_AGE,
            },
          }),
        );
      }

      return new Response(null, { status: 302, headers });
    },

    callbackHandler: async (request: Request) => {
      const url = new URL(request.url);
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      if (!code || !state) {
        return new Response("Missing code or state", { status: 400 });
      }

      const cookies = parseCookies(request.headers.get("cookie") || undefined);
      if (cookies[STATE_COOKIE_NAME] !== state) {
        return new Response("Invalid state", { status: 400 });
      }

      const nonce = cookies[NONCE_COOKIE_NAME];
      if (!nonce) {
        return new Response("Missing nonce", { status: 400 });
      }

      try {
        const callbackResult = await provider.handleCallback({ code, state });
        const validatedToken = await provider.validateIdToken(callbackResult.idToken, nonce);
        const user = provider.mapToUser(validatedToken);
        const sessionCookie = await createSessionCookie(user, normalizedConfig);
        const redirectCookie = cookies[REDIRECT_COOKIE_NAME];

        const headers = new Headers({
          Location:
            redirectCookie && isSafeRedirect(redirectCookie) ? redirectCookie : normalizedConfig.postLoginRedirectPath,
          "Cache-Control": "no-store",
        });

        headers.append("Set-Cookie", serializeCookie(sessionCookie));
        headers.append(
          "Set-Cookie",
          serializeCookie({
            name: STATE_COOKIE_NAME,
            value: "",
            attributes: {
              httpOnly: true,
              secure: true,
              sameSite: "lax",
              path: "/",
              maxAge: 0,
            },
          }),
        );
        headers.append(
          "Set-Cookie",
          serializeCookie({
            name: NONCE_COOKIE_NAME,
            value: "",
            attributes: {
              httpOnly: true,
              secure: true,
              sameSite: "lax",
              path: "/",
              maxAge: 0,
            },
          }),
        );
        headers.append(
          "Set-Cookie",
          serializeCookie({
            name: REDIRECT_COOKIE_NAME,
            value: "",
            attributes: {
              httpOnly: true,
              secure: true,
              sameSite: "lax",
              path: "/",
              maxAge: 0,
            },
          }),
        );

        return new Response(null, { status: 302, headers });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return new Response(`Authentication failed: ${message}`, { status: 500 });
      }
    },

    logoutHandler: async (request: Request) => {
      const url = new URL(request.url);
      const redirectTo = url.searchParams.get("redirect") || "/login";
      const headers = new Headers({
        Location: redirectTo,
        "Cache-Control": "no-store",
      });

      headers.append("Set-Cookie", serializeCookie(createEmptySessionCookie(config)));
      headers.append(
        "Set-Cookie",
        serializeCookie({
          name: STATE_COOKIE_NAME,
          value: "",
          attributes: {
            httpOnly: true,
            secure: true,
            sameSite: "lax",
            path: "/",
            maxAge: 0,
          },
        }),
      );
      headers.append(
        "Set-Cookie",
        serializeCookie({
          name: NONCE_COOKIE_NAME,
          value: "",
          attributes: {
            httpOnly: true,
            secure: true,
            sameSite: "lax",
            path: "/",
            maxAge: 0,
          },
        }),
      );

      return new Response(null, { status: 302, headers });
    },

    sessionHandler: async (request: Request) => {
      const session = await parseSessionCookie(request.headers.get("cookie") || undefined, normalizedConfig);
      const user: User | null = session
        ? {
            id: session.userId,
            name: session.name ?? null,
            email: session.email ?? null,
            ...(session.roles ? { roles: session.roles } : {}),
            ...(session.groups ? { groups: session.groups } : {}),
          }
        : null;

      return new Response(JSON.stringify({ user }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      });
    },
  };
}

function generateNonce() {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function isSafeRedirect(url: string): boolean {
  return url.startsWith("/") && !url.startsWith("//");
}
