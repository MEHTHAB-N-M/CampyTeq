"use client";

import React from "react";
import { useAuth } from "@/lib/auth";
import { AdminDashboard } from "@/components/dashboard/admin-dashboard";
import { FacultyDashboard } from "@/components/dashboard/faculty-dashboard";
import { StudentDashboard } from "@/components/dashboard/student-dashboard";

import { Navigate } from "react-router-dom";

export default function DashboardPage() {
  const { user } = useAuth();

  if (!user) return null;

  if (user.role === "HOD" || user.email?.toLowerCase().includes("hod")) {
    return <AdminDashboard />;
  }

  switch (user.role) {
    case "PRINT_STAFF":
      return <Navigate to="/dashboard/printshop" replace />;
    case "LIBRARY_STAFF":
      return <Navigate to="/dashboard/library" replace />;
    case "SECURITY":
      return <Navigate to="/dashboard/cameras" replace />;
    case "ACCOUNTANT":
      return <Navigate to="/dashboard/fees" replace />;
    case "STUDENT":
    case "PARENT":
      return <StudentDashboard />;
    case "FACULTY":
    case "MENTOR":
      return <FacultyDashboard />;
    case "PRINCIPAL":
    case "SUPER_ADMIN":
    default:
      return <AdminDashboard />;
  }
}
