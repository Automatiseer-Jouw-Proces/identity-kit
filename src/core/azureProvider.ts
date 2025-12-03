import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { type AuthConfig } from "./authConfig.js";
import {
  type AuthProvider,
  type ProviderCallbackParams,
  type ProviderCallbackResult,
  type ValidatedIdToken,
} from "./authProvider.js";
import { type User } from "./types.js";

type AzureTokenResponse = {
  token_type: string;
  scope?: string;
  expires_in?: number;
  ext_expires_in?: number;
  access_token: string;
  refresh_token?: string;
  id_token: string;
};

export class AzureAuthProvider implements AuthProvider {
  constructor(private readonly config: AuthConfig) {}

  getAuthorizationUrl(state: string, nonce: string): string {
    const { tenantId, clientId, redirectUri, scopes } = this.config.azure;
    const authorizeUrl = new URL(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`);
    authorizeUrl.search = new URLSearchParams({
      client_id: clientId,
      response_type: "code",
      redirect_uri: redirectUri,
      response_mode: "query",
      scope: scopes?.join(" ") ?? "",
      state,
      nonce,
    }).toString();

    return authorizeUrl.toString();
  }

  async handleCallback(params: ProviderCallbackParams): Promise<ProviderCallbackResult> {
    const { tenantId, clientId, clientSecret, redirectUri, scopes } = this.config.azure;
    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code: params.code,
      redirect_uri: redirectUri,
      scope: scopes?.join(" ") ?? "",
    });

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "Unknown error");
      throw new Error(`Azure token exchange failed (${response.status}): ${text}`);
    }

    const data = (await response.json()) as AzureTokenResponse;

    if (!data.id_token || !data.access_token) {
      throw new Error("Azure token response missing id_token or access_token");
    }

    return {
      idToken: data.id_token,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in ?? data.ext_expires_in,
      tokenType: data.token_type,
      raw: data,
    };
  }

  async validateIdToken(idToken: string, nonce: string): Promise<ValidatedIdToken> {
    const { tenantId, clientId } = this.config.azure;
    const issuer = `https://login.microsoftonline.com/${tenantId}/v2.0`;
    const jwksUri = new URL(`https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`);
    const jwks = createRemoteJWKSet(jwksUri);

    const verified = await jwtVerify(idToken, jwks, {
      issuer,
      audience: clientId,
      nonce,
    });

    const payload = verified.payload as JWTPayload & ValidatedIdToken;

    if (nonce && payload.nonce !== nonce) {
      throw new Error("Invalid nonce in ID token");
    }

    if (!payload.sub) {
      throw new Error("ID token missing sub claim");
    }

    return payload;
  }

  mapToUser(validated: ValidatedIdToken): User {
    const name = typeof validated.name === "string" ? validated.name : null;
    const email =
      typeof validated.email === "string"
        ? validated.email
        : typeof validated.preferred_username === "string"
          ? validated.preferred_username
          : null;

    return {
      id: validated.sub,
      name,
      email,
      roles: normalizeStringArray(validated.roles),
      groups: Array.isArray(validated.groups) ? validated.groups : undefined,
    };
  }
}

function normalizeStringArray(value: unknown): string[] | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  if (typeof value === "string") {
    return [value];
  }
  return undefined;
}
