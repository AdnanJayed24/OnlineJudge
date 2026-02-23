import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { login, logout, me, refresh, register } from "../lib/authApi";
import { connectSocket, disconnectSocket } from "../lib/socketClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        await refresh();
        const currentUser = await me();
        if (mounted) {
          setUser(currentUser);
          connectSocket();
        }
      } catch {
        if (mounted) setUser(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    bootstrap();
    return () => {
      mounted = false;
    };
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      async login(payload) {
        const result = await login(payload);
        setUser(result.user);
        connectSocket();
        return result;
      },
      async register(payload) {
        const result = await register(payload);
        setUser(result.user);
        connectSocket();
        return result;
      },
      async logout() {
        await logout();
        setUser(null);
        disconnectSocket();
      },
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
