import { createContext } from "react";
import { type AuthStatus, type User } from "../core/types.js";

export type IdentityContextValue = {
  user: User | null;
  status: AuthStatus;
  login: (options?: { redirect?: string }) => void;
  logout: () => void;
  refresh: () => Promise<void>;
};

export const IdentityContext = createContext<IdentityContextValue | undefined>(undefined);
