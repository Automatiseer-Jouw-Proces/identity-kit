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

  async mapToUser(validated: ValidatedIdToken, tokens?: ProviderCallbackResult): Promise<User> {
    const name = typeof validated.name === "string" ? validated.name : null;
    const email =
      typeof validated.email === "string"
        ? validated.email
        : typeof validated.preferred_username === "string"
          ? validated.preferred_username
          : null;

    const baseRoles = normalizeStringArray(validated.roles) ?? [];
    const baseGroups = Array.isArray(validated.groups) ? validated.groups : undefined;
    const roles = new Set<string>(baseRoles);
    const groups = baseGroups ? new Set<string>(baseGroups) : new Set<string>();

    const shouldFetchAppRoles =
      !!this.config.azure.servicePrincipalId &&
      tokens?.accessToken &&
      this.config.azure.fetchAppRolesFromGraph !== false;

    if (shouldFetchAppRoles && tokens?.accessToken) {
      const appRoles = await fetchAppRolesFromGraph(
        tokens.accessToken,
        this.config.azure.servicePrincipalId as string,
        this.config.azure.roleMapping,
      );
      appRoles.forEach((role) => roles.add(role));

      if (roles.size === 0 && this.config.azure.groupRoleMapping) {
        const groupResult = await fetchGroupRolesFromGraph(
          tokens.accessToken,
          this.config.azure.groupRoleMapping,
        );
        groupResult.roles.forEach((role) => roles.add(role));
        groupResult.groups.forEach((group) => groups.add(group));
      }
    }

    const resolvedRoles = roles.size > 0 ? Array.from(roles) : undefined;
    const resolvedGroups = groups.size > 0 ? Array.from(groups) : undefined;

    return {
      id: validated.sub,
      name,
      email,
      roles: resolvedRoles,
      groups: resolvedGroups,
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

async function fetchAppRolesFromGraph(
  accessToken: string,
  servicePrincipalId: string,
  roleMapping?: Record<string, string>,
): Promise<string[]> {
  try {
    const response = await fetch("https://graph.microsoft.com/v1.0/me/appRoleAssignments", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) return [];
    const data = (await response.json()) as { value?: Array<{ appRoleId?: string; resourceId?: string }> };
    const roles = (data.value ?? [])
      .filter((assignment) => !servicePrincipalId || assignment.resourceId === servicePrincipalId)
      .map((assignment) => mapRole(assignment.appRoleId, roleMapping))
      .filter((role): role is string => !!role);
    return Array.from(new Set(roles));
  } catch {
    return [];
  }
}

async function fetchGroupRolesFromGraph(
  accessToken: string,
  groupRoleMapping: Record<string, string>,
): Promise<{ roles: string[]; groups: string[] }> {
  try {
    const response = await fetch(
      "https://graph.microsoft.com/v1.0/me/transitiveMemberOf/microsoft.graph.group?$select=displayName,id",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    if (!response.ok) return { roles: [], groups: [] };
    const data = (await response.json()) as { value?: Array<{ displayName?: string; id?: string }> };
    const groups = (data.value ?? [])
      .map((group) => group.displayName || group.id)
      .filter((value): value is string => !!value);

    const roles = groups
      .map((groupName) => {
        for (const [key, mappedRole] of Object.entries(groupRoleMapping)) {
          if (groupName.includes(key)) {
            return mappedRole;
          }
        }
        return null;
      })
      .filter((role): role is string => !!role);

    return { roles: Array.from(new Set(roles)), groups };
  } catch {
    return { roles: [], groups: [] };
  }
}

function mapRole(appRoleId: string | undefined, roleMapping?: Record<string, string>): string | null {
  if (!appRoleId) return null;
  return roleMapping?.[appRoleId] ?? appRoleId;
}
