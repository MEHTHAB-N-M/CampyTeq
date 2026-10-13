"use client";

import React from "react";
import { useAuth } from "@/lib/auth";
import { AdminDashboard } from "@/components/dashboard/admin-dashboard";
import { FacultyDashboard } from "@/components/dashboard/faculty-dashboard";
import { StudentDashboard } from "@/components/dashboard/student-dashboard";

export default function DashboardPage() {
  const { user } = useAuth();

  if (!user) return null;

  switch (user.role) {
    case "STUDENT":
    case "PARENT":
      return <StudentDashboard />;
    case "FACULTY":
    case "HOD":
    case "MENTOR":
      return <FacultyDashboard />;
    case "PRINCIPAL":
    case "MANAGEMENT":
    case "ACCOUNTANT":
    case "PRINT_STAFF":
    case "LIBRARY_STAFF":
    default:
      return <AdminDashboard />;
  }
}
