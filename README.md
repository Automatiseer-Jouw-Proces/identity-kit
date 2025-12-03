@automatiseerjouwproces/identity-kit
===================================

Een compacte auth-kit voor Next.js App Router met een kant-en-klare Azure AD (Entra ID) loginflow, sessie-cookie en React-context.

Installatie
-----------

```
pnpm add @automatiseerjouwproces/identity-kit
```

Configuratie (auth.config.ts)
-----------------------------

```ts
import { createAuthConfig } from "@automatiseerjouwproces/identity-kit";

export const authConfig = createAuthConfig({
  provider: "azure",
  postLoginRedirectPath: "/",
  jwtSecret: process.env.AJP_IDENTITY_JWT_SECRET ?? "",
  azure: {
    tenantId: process.env.AZURE_TENANT_ID ?? "",
    clientId: process.env.AZURE_CLIENT_ID ?? "",
    clientSecret: process.env.AZURE_CLIENT_SECRET ?? "",
    redirectUri: `${process.env.APP_ORIGIN}/api/auth/callback`,
    scopes: ["openid", "profile", "email"],
  },
});
```

API routes (App Router)
-----------------------

```ts
// app/api/auth/login/route.ts
import { createAppRouterHandlers } from "@automatiseerjouwproces/identity-kit";
import { authConfig } from "../../../auth.config";

const handlers = createAppRouterHandlers(authConfig);
export const GET = handlers.loginHandler;

// app/api/auth/callback/route.ts
export const GET = handlers.callbackHandler;

// app/api/auth/logout/route.ts
export const GET = handlers.logoutHandler;

// app/api/auth/session/route.ts (voor client-side status)
export const GET = handlers.sessionHandler;
```

Server utilities
----------------

```ts
// app/protected/route.tsx
import { requireAuth } from "@automatiseerjouwproces/identity-kit";
import { authConfig } from "../auth.config";

export default async function ProtectedPage({ request }: { request: Request }) {
  const userOrRedirect = await requireAuth(request, authConfig);
  if (userOrRedirect instanceof Response) return userOrRedirect;

  return <div>Welkom {userOrRedirect.name}</div>;
}
```

React integratie
----------------

```tsx
// app/layout.tsx
import { IdentityProvider } from "@automatiseerjouwproces/identity-kit/react";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <body>
        <IdentityProvider>{children}</IdentityProvider>
      </body>
    </html>
  );
}
```

```tsx
// app/login/page.tsx
import { LoginPage } from "@automatiseerjouwproces/identity-kit/react";

export default function Login() {
  return <LoginPage />;
}
```

Middleware (optioneel)
----------------------

```ts
// middleware.ts
import { createAuthMiddleware } from "@automatiseerjouwproces/identity-kit";
import { authConfig } from "./auth.config";

const authMiddleware = createAuthMiddleware(authConfig, {
  protectedPaths: ["/app/*"],
  redirectTo: "/login",
});

export async function middleware(request: Request) {
  return authMiddleware(request);
}
```

Belangrijk
----------

- Gebruik altijd een sterk `AJP_IDENTITY_JWT_SECRET`.
- De React-provider stuurt je naar `/api/auth/login` en `/api/auth/logout`; zorg dat deze routes bestaan.
- De `sessionHandler` geeft `{ user }` terug voor de client-side status; voeg deze route toe.
