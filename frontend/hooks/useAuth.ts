"use client";

import { useCallback, useEffect, useState } from "react";

import { api } from "@/lib/api";
import { clearStoredToken, getStoredToken, setStoredToken } from "@/lib/storage";
import type { AuthProvidersResponse, LoginPayload, RegisterPayload, UserRead } from "@/lib/types";

interface UseAuthResult {
  token: string | null;
  user: UserRead | null;
  providers: AuthProvidersResponse | null;
  loading: boolean;
  error: string | null;
  setToken: (token: string | null) => void;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export function useAuth(): UseAuthResult {
  const [token, setTokenState] = useState<string | null>(null);
  const [user, setUser] = useState<UserRead | null>(null);
  const [providers, setProviders] = useState<AuthProvidersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const setToken = useCallback((value: string | null) => {
    setTokenState(value);
    if (value) {
      setStoredToken(value);
    } else {
      clearStoredToken();
      setUser(null);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const activeToken = getStoredToken();
    if (!activeToken) {
      setTokenState(null);
      setUser(null);
      return;
    }

    try {
      const nextUser = await api.me(activeToken);
      setTokenState(activeToken);
      setUser(nextUser);
      setError(null);
    } catch (err) {
      clearStoredToken();
      setTokenState(null);
      setUser(null);
      setError(err instanceof Error ? err.message : "Authentication failed");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      setLoading(true);
      try {
        const [providerState] = await Promise.all([
          api.getProviders(),
          refreshUser(),
        ]);

        if (!cancelled) {
          setProviders(providerState);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load auth state");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void boot();

    return () => {
      cancelled = true;
    };
  }, [refreshUser]);

  const login = useCallback(async (payload: LoginPayload) => {
    const response = await api.login(payload);
    setToken(response.access_token);
    const nextUser = await api.me(response.access_token);
    setUser(nextUser);
    setError(null);
  }, [setToken]);

  const register = useCallback(async (payload: RegisterPayload) => {
    const response = await api.register(payload);
    setToken(response.access_token);
    const nextUser = await api.me(response.access_token);
    setUser(nextUser);
    setError(null);
  }, [setToken]);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // client-side token drop is sufficient for the current backend
    }
    setToken(null);
    setUser(null);
  }, [setToken]);

  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key !== "planit.token") return;
      void refreshUser();
    }

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [refreshUser]);

  return {
    token,
    user,
    providers,
    loading,
    error,
    setToken,
    login,
    register,
    logout,
    refreshUser,
  };
}
