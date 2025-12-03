/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { type AuthStatus, type User } from "../core/types.js";
import { IdentityContext, type IdentityContextValue } from "./IdentityContext.js";

export type IdentityProviderConfig = {
  loginPath?: string;
  logoutPath?: string;
  sessionEndpoint?: string;
};

export type IdentityProviderProps = {
  children: ReactNode;
  config?: IdentityProviderConfig;
  initialUser?: User | null;
};

const DEFAULT_CONFIG: Required<IdentityProviderConfig> = {
  loginPath: "/api/auth/login",
  logoutPath: "/api/auth/logout",
  sessionEndpoint: "/api/auth/session",
};

export function IdentityProvider({ children, config, initialUser = null }: IdentityProviderProps) {
  const [user, setUser] = useState<User | null>(initialUser);
  const [status, setStatus] = useState<AuthStatus>(initialUser ? "authenticated" : "loading");
  const mergedConfig = useMemo(() => ({ ...DEFAULT_CONFIG, ...config }), [config]);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(mergedConfig.sessionEndpoint, {
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok) {
        setUser(null);
        setStatus("unauthenticated");
        return;
      }
      const data = (await response.json()) as { user: User | null };
      setUser(data.user);
      setStatus(data.user ? "authenticated" : "unauthenticated");
    } catch {
      setUser(null);
      setStatus("unauthenticated");
    }
  }, [mergedConfig.sessionEndpoint]);

  useEffect(() => {
    if (initialUser) {
      setStatus("authenticated");
      return;
    }
    void refresh();
  }, [initialUser, refresh]);

  const login = useCallback(
    (options?: { redirect?: string }) => {
      const target =
        options?.redirect && options.redirect.length > 0
          ? `${mergedConfig.loginPath}?redirect=${encodeURIComponent(options.redirect)}`
          : mergedConfig.loginPath;
      window.location.assign(target);
    },
    [mergedConfig.loginPath],
  );

  const logout = useCallback(() => {
    window.location.assign(mergedConfig.logoutPath);
  }, [mergedConfig.logoutPath]);

  const value: IdentityContextValue = {
    user,
    status,
    login,
    logout,
    refresh,
  };

  return <IdentityContext.Provider value={value}>{children}</IdentityContext.Provider>;
}
