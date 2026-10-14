import React, { createContext, useContext, useState, useEffect } from "react";
import { apiRequest } from "./api";

export type UserRole =
  | "SUPER_ADMIN"
  | "PRINCIPAL"
  | "HOD"
  | "MENTOR"
  | "FACULTY"
  | "ACCOUNTANT"
  | "STUDENT"
  | "PARENT"
  | "SECURITY"
  | "PRINT_STAFF"
  | "LIBRARY_STAFF";

export interface College {
  id: string;
  name: string;
  code: string;
  slug: string;
  domain?: string;
  email?: string;
  phone?: string;
  address?: string;
  status: string;
  logo_url?: string;
  settings?: Record<string, any>;
}

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  phone?: string;
  role: UserRole;
  status: string;
  college?: College | null;
  profile_photo_url?: string;
  is_mfa_enabled: boolean;
  permissions: string[];
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (tokens: { access: string; refresh: string; user: User }) => void;
  logout: () => void;
  hasPermission: (permissionCode: string) => boolean;
  isRole: (roles: UserRole | UserRole[]) => boolean;
  switchRole: (newRole: "FACULTY" | "MENTOR") => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check existing stored session on mount
    try {
      const storedUser = localStorage.getItem("campyteq_user") || localStorage.getItem("campus360_user");
      const token = localStorage.getItem("campyteq_access_token") || localStorage.getItem("campus360_access_token");

      if (storedUser && token) {
        const parsed = JSON.parse(storedUser);
        if (parsed.email?.toLowerCase().includes("hod") && parsed.role !== "HOD") {
          parsed.role = "HOD";
          localStorage.setItem("campyteq_user", JSON.stringify(parsed));
        }
        setUser(parsed);
      }
    } catch (err) {
      console.error("Failed to restore session", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = (tokens: { access: string; refresh: string; user: User }) => {
    localStorage.setItem("campyteq_access_token", tokens.access);
    localStorage.setItem("campyteq_refresh_token", tokens.refresh);
    localStorage.setItem("campyteq_user", JSON.stringify(tokens.user));
    setUser(tokens.user);
    window.location.href = "/dashboard";
  };

  const logout = () => {
    localStorage.removeItem("campyteq_access_token");
    localStorage.removeItem("campyteq_refresh_token");
    localStorage.removeItem("campyteq_user");
    localStorage.removeItem("campyteq_active_college_id");
    localStorage.removeItem("campus360_access_token");
    localStorage.removeItem("campus360_refresh_token");
    localStorage.removeItem("campus360_user");
    localStorage.removeItem("campus360_active_college_id");
    setUser(null);
    window.location.href = "/login";
  };

  const hasPermission = (permissionCode: string) => {
    if (!user) return false;
    if (user.role === "PRINCIPAL" || user.role === "SUPER_ADMIN") return true;
    return user.permissions?.includes(permissionCode) || false;
  };

  const isRole = (roles: UserRole | UserRole[]) => {
    if (!user) return false;
    if (Array.isArray(roles)) {
      return roles.includes(user.role);
    }
    return user.role === roles;
  };

  const switchRole = async (newRole: "FACULTY" | "MENTOR") => {
    if (!user) return;
    try {
      await apiRequest("/auth/switch-role/", {
        method: "POST",
        body: JSON.stringify({ role: newRole }),
      });
    } catch (err) {
      console.warn("Backend switch-role sync note:", err);
    }
    const updatedUser: User = { ...user, role: newRole };
    setUser(updatedUser);
    localStorage.setItem("campyteq_user", JSON.stringify(updatedUser));
    if (localStorage.getItem("campus360_user")) {
      localStorage.setItem("campus360_user", JSON.stringify(updatedUser));
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        logout,
        hasPermission,
        isRole,
        switchRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
