import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  getProfile,
  loginUser,
  loginWithGoogle,
  logoutUser,
  refreshSession,
  registerUser,
  setAccessToken,
  updateProfile,
} from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const applyAuthPayload = useCallback((payload) => {
    setAccessToken(payload.access_token);
    setUser(payload.user);
    return payload.user;
  }, []);

  useEffect(() => {
    let isMounted = true;

    refreshSession()
      .then((payload) => {
        if (isMounted) {
          applyAuthPayload(payload);
        }
      })
      .catch(() => {
        setAccessToken("");
        if (isMounted) {
          setUser(null);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [applyAuthPayload]);

  const login = useCallback(
    async (payload) => {
      const result = await loginUser(payload);
      return applyAuthPayload(result);
    },
    [applyAuthPayload],
  );

  const register = useCallback(
    async (payload) => {
      const result = await registerUser(payload);
      return applyAuthPayload(result);
    },
    [applyAuthPayload],
  );

  const googleLogin = useCallback(
    async (credential, role) => {
      const result = await loginWithGoogle(credential, role);
      return applyAuthPayload(result);
    },
    [applyAuthPayload],
  );

  const refreshUser = useCallback(async () => {
    const profile = await getProfile();
    setUser(profile);
    return profile;
  }, []);

  const saveProfile = useCallback(async (payload) => {
    const profile = await updateProfile(payload);
    setUser(profile);
    return profile;
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutUser();
    } finally {
      setAccessToken("");
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      login,
      register,
      googleLogin,
      logout,
      refreshUser,
      saveProfile,
    }),
    [googleLogin, isLoading, login, logout, refreshUser, register, saveProfile, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }
  return context;
}
