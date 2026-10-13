import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import { DashboardLayout } from "./components/layout/DashboardLayout";

import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/dashboard/DashboardOverview";
import AcademicsPage from "./pages/dashboard/academics";
import AnalyticsPage from "./pages/dashboard/analytics";
import AnnouncementsPage from "./pages/dashboard/announcements";
import AssignmentsPage from "./pages/dashboard/assignments";
import AttendancePage from "./pages/dashboard/attendance";
import CamerasAndTrackingPage from "./pages/dashboard/cameras";
import DocumentsPage from "./pages/dashboard/documents";
import ExamsPage from "./pages/dashboard/exams";
import FacilitiesPage from "./pages/dashboard/facilities";
import FacultyPage from "./pages/dashboard/faculty";
import FeesPage from "./pages/dashboard/fees";
import LeaveManagementPage from "./pages/dashboard/leave";
import LibraryPage from "./pages/dashboard/library";
import MessagesPage from "./pages/dashboard/messages";
import PayrollPage from "./pages/dashboard/payroll";
import PrintShopPage from "./pages/dashboard/printshop";
import StudentsPage from "./pages/dashboard/students";
import TimetablePage from "./pages/dashboard/timetable";

function RootRedirect() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading) {
      if (user) {
        navigate("/dashboard", { replace: true });
      } else {
        navigate("/login", { replace: true });
      }
    }
  }, [user, isLoading, navigate]);

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4 text-center px-4">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-white">CampyTeq Ecosystem</p>
          <p className="text-xs text-muted-foreground">Directing to institutional portal...</p>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<LoginPage />} />

          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="academics" element={<AcademicsPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="announcements" element={<AnnouncementsPage />} />
            <Route path="assignments" element={<AssignmentsPage />} />
            <Route path="attendance" element={<AttendancePage />} />
            <Route path="cameras" element={<CamerasAndTrackingPage />} />
            <Route path="documents" element={<DocumentsPage />} />
            <Route path="exams" element={<ExamsPage />} />
            <Route path="facilities" element={<FacilitiesPage />} />
            <Route path="faculty" element={<FacultyPage />} />
            <Route path="fees" element={<FeesPage />} />
            <Route path="leave" element={<LeaveManagementPage />} />
            <Route path="library" element={<LibraryPage />} />
            <Route path="messages" element={<MessagesPage />} />
            <Route path="payroll" element={<PayrollPage />} />
            <Route path="printshop" element={<PrintShopPage />} />
            <Route path="students" element={<StudentsPage />} />
            <Route path="timetable" element={<TimetablePage />} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
