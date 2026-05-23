import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { AuthUser } from "../shared/types";
import * as api from "./api";

interface AuthCtx {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<string | null>;
  register: (username: string, password: string) => Promise<string | null>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  updateProfile: (data: { displayName?: string; bio?: string; bannerColor?: string; avatarUrl?: string }) => Promise<void>;
}

const Ctx = createContext<AuthCtx>(null!);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = async () => {
    const token = localStorage.getItem("app:token");
    if (!token) { setLoading(false); return; }
    try {
      const u = await api.verify();
      localStorage.setItem("app:token", u.token);
      setUser(u);
    } catch {
      localStorage.removeItem("app:token");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUser(); }, []);

  const login = useCallback(async (username: string, password: string) => {
    try {
      const u = await api.login(username, password);
      localStorage.setItem("app:token", u.token);
      setUser(u);
      return null;
    } catch (e) { return (e as Error).message; }
  }, []);

  const register = useCallback(async (username: string, password: string) => {
    try {
      const u = await api.register(username, password);
      localStorage.setItem("app:token", u.token);
      setUser(u);
      return null;
    } catch (e) { return (e as Error).message; }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("app:token");
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => { await loadUser(); }, []);

  const updateProfile = useCallback(async (data: Parameters<AuthCtx["updateProfile"]>[0]) => {
    await api.updateProfile(data);
    setUser(u => u ? { ...u, ...data } : u);
  }, []);

  return (
    <Ctx.Provider value={{ user, loading, login, register, logout, refreshUser, updateProfile }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
