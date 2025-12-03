import { createAuthConfig, type AuthConfig } from "./authConfig.js";
import { AzureAuthProvider } from "./azureProvider.js";
import { type User } from "./types.js";

export type ProviderCallbackParams = {
  code: string;
  state: string;
  sessionState?: string;
};

export type ProviderCallbackResult = {
  idToken: string;
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  tokenType?: string;
  raw?: unknown;
};

export type ValidatedIdToken = {
  sub: string;
  name?: string;
  email?: string;
  preferred_username?: string;
  nonce?: string;
  roles?: string[] | string;
  groups?: string[];
  [key: string]: unknown;
};

export interface AuthProvider {
  getAuthorizationUrl(state: string, nonce: string): string;
  handleCallback(params: ProviderCallbackParams): Promise<ProviderCallbackResult>;
  validateIdToken(idToken: string, nonce: string): Promise<ValidatedIdToken>;
  mapToUser(validated: ValidatedIdToken): User;
}

export function createAuthProvider(config: AuthConfig): AuthProvider {
  const normalizedConfig = createAuthConfig(config);

  switch (normalizedConfig.provider) {
    case "azure":
      return new AzureAuthProvider(normalizedConfig);
    default:
      throw new Error(`Unsupported provider: ${normalizedConfig.provider}`);
  }
}
