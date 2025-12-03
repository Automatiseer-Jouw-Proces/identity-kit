export {
  createAuthConfig,
  type AuthConfig,
  type AuthConfigInput,
  type AzureAuthConfig,
} from "./core/authConfig.js";
export {
  createAuthProvider,
  type AuthProvider,
  type ProviderCallbackParams,
  type ProviderCallbackResult,
  type ValidatedIdToken,
} from "./core/authProvider.js";
export { type ProviderName, type AuthStatus, type User, type SessionPayload } from "./core/types.js";
export { type AppRouterHandlers, createAppRouterHandlers } from "./next/handlers/index.js";
export { getServerUser, requireAuth } from "./next/server/user.js";
export { createAuthMiddleware, type AuthMiddlewareOptions } from "./next/middleware/index.js";
export {
  IdentityProvider,
  type IdentityProviderConfig,
  type IdentityProviderProps,
} from "./react/IdentityProvider.js";
export { useIdentity } from "./react/useIdentity.js";
export { LoginPage, type LoginPageProps } from "./react/LoginPage.js";
export { IdentityContext, type IdentityContextValue } from "./react/IdentityContext.js";
