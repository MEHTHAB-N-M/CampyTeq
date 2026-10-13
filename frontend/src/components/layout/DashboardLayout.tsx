import React, { useEffect } from "react";
import { useNavigate, Outlet } from "react-router-dom";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { useAuth } from "@/lib/auth";

export function DashboardLayout() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/login", { replace: true });
    }
  }, [user, isLoading, navigate]);

  if (isLoading || !user) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 text-center px-4 max-w-sm">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-white">
              {isLoading ? "Verifying Session..." : "Authentication Required"}
            </p>
            <p className="text-xs text-muted-foreground">
              {isLoading
                ? "Connecting to CampyTeq ecosystem..."
                : "Redirecting you to institutional sign in..."}
            </p>
          </div>
          {!isLoading && !user && (
            <button
              onClick={() => navigate("/login")}
              className="mt-2 inline-flex items-center justify-center px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition-all"
            >
              Go to Sign In
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 p-6 overflow-y-auto max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
