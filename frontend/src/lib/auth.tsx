import React, { createContext, useContext, useState, useEffect } from "react";
import { apiRequest } from "./api";

export type BaseRole =
  | "SUPER_ADMIN"
  | "PRINCIPAL"
  | "HOD"
  | "FACULTY"
  | "LAB_FACULTY"
  | "ACCOUNTANT"
  | "LIBRARY_FACULTY"
  | "PRINT_STAFF"
  | "SECURITY"
  | "STUDENT"
  | "PARENT";

export type AssignmentRole = "CLASS_INCHARGE" | "MENTOR";
export type UserRole = BaseRole | AssignmentRole | string;

export interface RoleItem {
  role: string;
  source: "base" | "assignment";
  is_active: boolean;
}

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
  role: string;
  active_role?: string;
  available_roles?: RoleItem[];
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
  switchRole: (newRole: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function getRoleHome(role: string): string {
  switch (role) {
    case "LIBRARY_FACULTY":
      return "/dashboard/library";
    case "HOD":
      return "/dashboard/analytics";
    case "MENTOR":
      return "/dashboard/mentorship";
    case "CLASS_INCHARGE":
    case "FACULTY":
    case "LAB_FACULTY":
      return "/dashboard/academics";
    case "ACCOUNTANT":
      return "/dashboard/finance";
    case "PRINT_STAFF":
      return "/dashboard/printshop";
    case "SECURITY":
      return "/dashboard/cameras";
    case "PARENT":
      return "/dashboard/parent";
    case "STUDENT":
      return "/dashboard/academics";
    default:
      return "/dashboard";
  }
}

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
    const home = getRoleHome(tokens.user.active_role || tokens.user.role);
    window.location.href = home;
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
    const actingRole = user.active_role || user.role;
    if (actingRole === "PRINCIPAL" || actingRole === "SUPER_ADMIN") return true;
    return user.permissions?.includes(permissionCode) || false;
  };

  const isRole = (roles: UserRole | UserRole[]) => {
    if (!user) return false;
    const current = user.active_role || user.role;
    if (Array.isArray(roles)) {
      return roles.includes(current);
    }
    return current === roles;
  };

  const switchRole = async (newRole: string) => {
    if (!user) return;
    try {
      const res = await apiRequest("/accounts/switch-role/", {
        method: "POST",
        body: JSON.stringify({ role: newRole }),
      });
      if (res.access) {
        localStorage.setItem("campyteq_access_token", res.access);
      }
      if (res.refresh) {
        localStorage.setItem("campyteq_refresh_token", res.refresh);
      }
      const updatedUser: User = {
        ...user,
        role: newRole,
        active_role: newRole,
        permissions: res.permissions || user.permissions,
      };
      setUser(updatedUser);
      localStorage.setItem("campyteq_user", JSON.stringify(updatedUser));
      const targetHome = getRoleHome(newRole);
      window.location.href = targetHome;
    } catch (err: any) {
      console.error("switch-role failed:", err);
      throw err;
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
