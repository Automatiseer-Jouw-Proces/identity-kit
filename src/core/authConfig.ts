import type { ProviderName } from "./types.js";

export type AzureAuthConfig = {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes?: string[];
};

export type AuthConfig = {
  provider: ProviderName;
  postLoginRedirectPath: string;
  azure: AzureAuthConfig;
  /**
   * Secret used for signing session JWTs. Keep this private.
   */
  jwtSecret: string;
  /**
   * Optional override for the cookie name that carries the session JWT.
   */
  sessionCookieName?: string;
};

export type AuthConfigInput = Omit<AuthConfig, "azure"> & {
  azure: AzureAuthConfig;
};

const DEFAULT_SCOPES = ["openid", "profile", "email"];
const DEFAULT_REDIRECT = "/";
const DEFAULT_SESSION_COOKIE = "ajp_identity_session";

export function createAuthConfig(config: AuthConfigInput): AuthConfig {
  if (config.provider !== "azure") {
    throw new Error(`Unsupported provider: ${config.provider}`);
  }

  assertPresent(config.jwtSecret, "jwtSecret");

  const azureConfig = {
    ...config.azure,
    scopes: config.azure.scopes && config.azure.scopes.length > 0 ? config.azure.scopes : DEFAULT_SCOPES,
  };

  assertPresent(azureConfig.tenantId, "azure.tenantId");
  assertPresent(azureConfig.clientId, "azure.clientId");
  assertPresent(azureConfig.clientSecret, "azure.clientSecret");
  assertPresent(azureConfig.redirectUri, "azure.redirectUri");

  return {
    provider: "azure",
    postLoginRedirectPath: config.postLoginRedirectPath || DEFAULT_REDIRECT,
    azure: azureConfig,
    jwtSecret: config.jwtSecret,
    sessionCookieName: config.sessionCookieName || DEFAULT_SESSION_COOKIE,
  };
}

function assertPresent(value: string | undefined, name: string): asserts value is string {
  if (!value) {
    throw new Error(`Missing required config value: ${name}`);
  }
}
