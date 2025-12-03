export type ProviderName = "azure";

export type AuthStatus = "authenticated" | "unauthenticated" | "loading";

export type User = {
  id: string;
  name: string | null;
  email: string | null;
  roles?: string[];
  groups?: string[];
  // Allow future extensibility without breaking v1 consumers
  [key: string]: unknown;
};

export type SessionPayload = {
  userId: string;
  name?: string | null;
  email?: string | null;
  roles?: string[];
  groups?: string[];
  issuedAt?: number;
  expiresAt?: number;
};
