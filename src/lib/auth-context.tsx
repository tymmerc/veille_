"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type User = {
  id: string;
  username: string;
  avatar: string | null;
  discordId: string | null;
  email?: string | null;
  prompt: string | null;
  isPublic?: boolean;
};

export function discordAvatarUrl(user: { discordId: string | null; avatar: string | null }, size = 64): string | null {
  if (!user.discordId || !user.avatar) return null;
  return `https://cdn.discordapp.com/avatars/${user.discordId}/${user.avatar}.png?size=${size}`;
}

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  refresh: () => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  refresh: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = () => {
    fetch("/veille/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.user) setUser(data.user);
        else setUser(null);
        setLoading(false);
      })
      .catch(() => {
        setUser(null);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const logout = () => {
    fetch("/veille/api/auth/logout", { method: "POST" }).finally(() => {
      setUser(null);
      window.location.href = "/veille/";
    });
  };

  return (
    <AuthContext.Provider value={{ user, loading, refresh: fetchUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
