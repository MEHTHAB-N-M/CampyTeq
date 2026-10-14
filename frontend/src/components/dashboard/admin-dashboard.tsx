"use client";

import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Users,
  GraduationCap,
  CalendarCheck,
  CreditCard,
  Video,
  ShieldCheck,
  Building,
  Building2,
  ExternalLink,
  ChevronDown,
  Layers,
  Sparkles,
  CheckCircle,
  Clock,
  BookOpen,
  Calendar,
  AlertTriangle,
  ArrowUpRight,
  Plus,
  UserPlus,
  ShieldAlert,
  Library,
  Dumbbell,
  FileSpreadsheet,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/api";

interface CollegeOption {
  id: string;
  name: string;
  code: string;
}

export function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const isPrincipal = user?.role === "PRINCIPAL";
  const isHOD = user?.role === "HOD" || user?.email?.toLowerCase().includes("hod");

  // Super Admin: College selection dropdown
  const [colleges, setColleges] = useState<CollegeOption[]>([
    { id: "36275eb6-af17-4bd7-898a-1ac72550e37e", name: "Apex Institute of Technology", code: "APEX-TECH" },
    { id: "e84b72f7-5e2c-4fb3-81e6-1853039a086a", name: "Metropolitan College of Science", code: "METRO-SCI" },
  ]);
  const [selectedCollegeId, setSelectedCollegeId] = useState<string>("ALL");

  // Principal: Department selection dropdown
  const [departments, setDepartments] = useState([
    { id: "all", name: "All Departments" },
    { id: "cse", name: "Computer Science & Engineering" },
    { id: "it", name: "Information Technology" },
    { id: "ece", name: "Electronics & Communication" },
    { id: "mech", name: "Mechanical Engineering" },
    { id: "civil", name: "Civil Engineering" },
  ]);
  const [selectedDeptId, setSelectedDeptId] = useState<string>("all");

  // Dynamic Metrics state
  const [metricsData, setMetricsData] = useState({
    total_students: "4,821",
    total_faculty: "286",
    total_principals: "2",
    total_cameras: "14 / 14 Online",
    attendance_rate: "85.1%",
    fee_collection: "₹28.4L",
  });

  // Facility and Library Booking state (for Principal review & HOD visibility)
  const [facilityBookings, setFacilityBookings] = useState([
    {
      id: "book-1",
      facility: "Main Campus Seminar Hall A",
      type: "SEMINAR_HALL",
      requested_by: "Prof. Rajesh V (HOD CSE)",
      department: "Computer Science",
      date: "16 Oct 2026 (02:00 PM - 05:00 PM)",
      purpose: "National AI Symposium & Technical Keynote",
      status: "PENDING",
    },
    {
      id: "book-2",
      facility: "Olympic Green Sports Turf",
      type: "TURF",
      requested_by: "Prof. Priya Nair (Faculty)",
      department: "Computer Science",
      date: "17 Oct 2026 (04:00 PM - 06:30 PM)",
      purpose: "Inter-department Friendly Football League",
      status: "APPROVED",
    },
    {
      id: "book-3",
      facility: "Campus Gymnasium & Fitness Complex",
      type: "GYM",
      requested_by: "Prof. Anil Verma (Mentor)",
      department: "Information Tech",
      date: "18 Oct 2026 (06:00 AM - 08:00 AM)",
      purpose: "Student Athlete Conditioning Session",
      status: "PENDING",
    },
  ]);

  const [libraryBookings, setLibraryBookings] = useState([
    {
      id: "lib-1",
      class_name: "B.Tech CSE — 2026 Batch (Sem 3)",
      requested_by: "Prof. Priya Nair",
      date: "15 Oct 2026 (11:00 AM - 12:30 PM)",
      status: "APPROVED",
      notes: "Research paper referencing and IEEE transaction study",
    },
    {
      id: "lib-2",
      class_name: "BCA — Year 1 (Sem 2)",
      requested_by: "Prof. Anil Verma",
      date: "16 Oct 2026 (02:00 PM - 03:30 PM)",
      status: "PENDING",
      notes: "Python standard library documentation session",
    },
  ]);

  // Handle College Dropdown Selection for Super Admin
  const handleCollegeChange = (collegeId: string) => {
    setSelectedCollegeId(collegeId);
    if (collegeId === "ALL") {
      localStorage.removeItem("campyteq_active_college_id");
      localStorage.removeItem("campus360_active_college_id");
      setMetricsData({
        total_students: "4,821",
        total_faculty: "286",
        total_principals: "2",
        total_cameras: "14 / 14 Online",
        attendance_rate: "85.1%",
        fee_collection: "₹28.4L",
      });
    } else if (collegeId.includes("36275")) {
      localStorage.setItem("campyteq_active_college_id", collegeId);
      localStorage.setItem("campus360_active_college_id", collegeId);
      setMetricsData({
        total_students: "2,680",
        total_faculty: "152",
        total_principals: "1 (Dr. Sharma)",
        total_cameras: "8 / 8 Online",
        attendance_rate: "88.6%",
        fee_collection: "₹16.8L",
      });
    } else {
      localStorage.setItem("campyteq_active_college_id", collegeId);
      localStorage.setItem("campus360_active_college_id", collegeId);
      setMetricsData({
        total_students: "2,141",
        total_faculty: "134",
        total_principals: "1 (Dr. Mehta)",
        total_cameras: "6 / 6 Online",
        attendance_rate: "81.4%",
        fee_collection: "₹11.6L",
      });
    }
  };

  // Handle Principal Facility Approval/Rejection
  const handleReviewBooking = (bookingId: string, newStatus: "APPROVED" | "REJECTED") => {
    setFacilityBookings((prev) =>
      prev.map((b) => (b.id === bookingId ? { ...b, status: newStatus } : b))
    );
  };

  return (
    <div className="space-y-6">
      {/* =========================================================================
          TOP COMMAND BANNER (SUPER ADMIN / PRINCIPAL / HOD)
         ========================================================================= */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-indigo-950/70 via-slate-900/60 to-purple-950/60 border border-indigo-500/30 backdrop-blur-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-xs border-indigo-500/40 text-indigo-300">
                {isSuperAdmin
                  ? "👑 Super Admin Executive Command"
                  : isPrincipal
                  ? `🏛️ Principal Console • ${user?.college?.name || "Apex Institute of Tech"}`
                  : `🎓 HOD Command • Dept. of Computer Science`}
              </Badge>
              <span className="text-xs text-muted-foreground">Academic Year 2026-2027</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white mt-1">
              Welcome, {user?.first_name} {user?.last_name}!
            </h1>
            <p className="text-sm text-slate-300 mt-0.5">
              {isSuperAdmin
                ? "Unified Multi-College Campus Command. Manage colleges, principals, faculties, and cross-college AI Radar."
                : isPrincipal
                ? "College Leadership Console. Track department performance, approve gym/seminar bookings, and inspect camera tracking."
                : "Departmental Leadership Console. Oversee department faculties, manage timetables, and monitor student AI risk radar."}
            </p>
          </div>

          {/* Quick Action Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Direct Access to Django Admin for Super Admin */}
            {isSuperAdmin && (
              <a
                href="http://127.0.0.1:8000/admin/"
                target="_blank"
                rel="noreferrer"
                id="django-admin-btn"
                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md transition-all"
                title="Direct Access to Django Administration"
              >
                <span>Django Admin</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}

            {/* Principal / HOD Camera Sighting with Photo Upload */}
            {(isPrincipal || isHOD || isSuperAdmin) && (
              <Link to="/dashboard/cameras">
                <Button size="sm" variant="gradient" className="text-xs">
                  <Video className="h-4 w-4 mr-1.5" /> Track via Camera Photo
                </Button>
              </Link>
            )}

            {/* Leave requests overview */}
            <Link to="/dashboard/leave">
              <Button size="sm" variant="outline" className="text-xs border-border/70">
                <CalendarCheck className="h-4 w-4 mr-1.5 text-indigo-400" /> Leave Approvals
              </Button>
            </Link>
          </div>
        </div>

        {/* =========================================================================
            DROPDOWN FILTER:
            - Super Admin: Select between Colleges
            - Principal: Select between Departments
           ========================================================================= */}
        <div className="mt-5 pt-4 border-t border-border/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          {isSuperAdmin ? (
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <span className="text-xs font-semibold text-indigo-300 flex items-center gap-1.5 shrink-0">
                <Building2 className="h-4 w-4" /> Select College View:
              </span>
              <select
                id="superadmin-college-dropdown"
                value={selectedCollegeId}
                onChange={(e) => handleCollegeChange(e.target.value)}
                className="bg-secondary/80 border border-indigo-500/40 rounded-lg px-3 py-1.5 text-xs text-foreground font-semibold focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
              >
                <option value="ALL">🏢 Whole Campus (All Colleges Combined)</option>
                {colleges.map((col) => (
                  <option key={col.id} value={col.id}>
                    🏛️ {col.name} ({col.code})
                  </option>
                ))}
              </select>
            </div>
          ) : isPrincipal ? (
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <span className="text-xs font-semibold text-indigo-300 flex items-center gap-1.5 shrink-0">
                <Layers className="h-4 w-4" /> Filter Department:
              </span>
              <select
                id="principal-department-dropdown"
                value={selectedDeptId}
                onChange={(e) => setSelectedDeptId(e.target.value)}
                className="bg-secondary/80 border border-indigo-500/40 rounded-lg px-3 py-1.5 text-xs text-foreground font-semibold focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
              >
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-purple-300">
              <Building className="h-4 w-4" />
              <span>Department of Computer Science & Engineering • HOD Authority</span>
            </div>
          )}

          <div className="text-[11px] text-muted-foreground flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Multi-tenant Isolation Active • Role Enforced</span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          EXECUTIVE KPI METRIC CARDS
          Super Admin: Students, Teachers, Principals, Cameras, Attendance, Fee Collection
          Principal: Students, Teachers, Cameras, Attendance, Fee Collection
          HOD: Department Students, Teachers, Cameras, Attendance, Fee Collection
         ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Total Students */}
        <Card className="glass-panel-hover">
          <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0">
            <CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {isHOD ? "Dept Students" : isSuperAdmin ? "Campus Students" : "College Students"}
            </CardTitle>
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
              <GraduationCap className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-foreground">
              {isHOD ? "1,240" : metricsData.total_students}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Enrolled Roster</p>
          </CardContent>
        </Card>

        {/* Total Teachers / Faculty */}
        <Card className="glass-panel-hover">
          <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0">
            <CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {isHOD ? "Dept Teachers" : "Total Teachers"}
            </CardTitle>
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
              <Users className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-foreground">
              {isHOD ? "34 Faculty" : metricsData.total_faculty}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Professors & Mentors</p>
          </CardContent>
        </Card>

        {/* Total Principals (for Super Admin) / Department Status (for others) */}
        {isSuperAdmin ? (
          <Card className="glass-panel-hover">
            <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0">
              <CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Principals
              </CardTitle>
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                <Building2 className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-foreground">{metricsData.total_principals}</div>
              <p className="text-[10px] text-muted-foreground mt-0.5">Institutional Heads</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="glass-panel-hover">
            <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0">
              <CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Lab Classes
              </CardTitle>
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                <BookOpen className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-foreground">6 Labs Active</div>
              <p className="text-[10px] text-muted-foreground mt-0.5">CSE Practical Batches</p>
            </CardContent>
          </Card>
        )}

        {/* Authorized Cameras */}
        <Card className="glass-panel-hover">
          <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0">
            <CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {isHOD ? "Dept Cameras" : "Campus Cameras"}
            </CardTitle>
            <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400">
              <Video className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-foreground">
              {isHOD ? "4 / 4 Online" : metricsData.total_cameras}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">AI Sighting Active</p>
          </CardContent>
        </Card>

        {/* Attendance Rate */}
        <Card className="glass-panel-hover">
          <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0">
            <CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Attendance
            </CardTitle>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <CalendarCheck className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-emerald-400">
              {isHOD ? "89.2%" : metricsData.attendance_rate}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Above 75% Threshold</p>
          </CardContent>
        </Card>

        {/* Fee Collection */}
        <Card className="glass-panel-hover">
          <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0">
            <CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Fee Collection
            </CardTitle>
            <div className="p-2 rounded-lg bg-teal-500/10 text-teal-400">
              <CreditCard className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-foreground">
              {isHOD ? "₹9.4L" : metricsData.fee_collection}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Collected this term</p>
          </CardContent>
        </Card>
      </div>

      {/* =========================================================================
          SUPER ADMIN: CROSS-COLLEGE COMPARISON & AI RADAR
         ========================================================================= */}
      {isSuperAdmin && (
        <Card className="border-indigo-500/30">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-sm font-semibold">
                Multi-College Performance & AI Early-Warning Radar
              </CardTitle>
              <CardDescription className="text-xs">
                Comparative analytics across all colleges in the campus ecosystem
              </CardDescription>
            </div>
            <Link to="/dashboard/analytics">
              <Button size="sm" variant="outline" className="text-xs">
                <Sparkles className="h-3.5 w-3.5 mr-1 text-indigo-400" /> Deep AI Radar
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-border/60 text-muted-foreground uppercase text-[10px] tracking-wider">
                  <th className="pb-2.5">College Name</th>
                  <th className="pb-2.5">Code</th>
                  <th className="pb-2.5">Principal</th>
                  <th className="pb-2.5">Students</th>
                  <th className="pb-2.5">Faculty</th>
                  <th className="pb-2.5">Cameras</th>
                  <th className="pb-2.5">Attendance</th>
                  <th className="pb-2.5">Fee Collection</th>
                  <th className="pb-2.5">AI Risk Flags</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                <tr className="hover:bg-secondary/30 transition-colors">
                  <td className="py-3 font-semibold text-foreground">Apex Institute of Technology</td>
                  <td className="py-3 font-mono text-indigo-400">APEX-TECH</td>
                  <td className="py-3 text-slate-300">Dr. Sharma</td>
                  <td className="py-3">2,680</td>
                  <td className="py-3">152</td>
                  <td className="py-3">8 Online</td>
                  <td className="py-3 text-emerald-400 font-semibold">88.6%</td>
                  <td className="py-3 font-semibold">₹16.8L</td>
                  <td className="py-3">
                    <Badge variant="destructive" className="text-[10px]">
                      1 High • 2 Med
                    </Badge>
                  </td>
                </tr>
                <tr className="hover:bg-secondary/30 transition-colors">
                  <td className="py-3 font-semibold text-foreground">Metropolitan College of Science</td>
                  <td className="py-3 font-mono text-indigo-400">METRO-SCI</td>
                  <td className="py-3 text-slate-300">Dr. Vikram Mehta</td>
                  <td className="py-3">2,141</td>
                  <td className="py-3">134</td>
                  <td className="py-3">6 Online</td>
                  <td className="py-3 text-emerald-400 font-semibold">81.4%</td>
                  <td className="py-3 font-semibold">₹11.6L</td>
                  <td className="py-3">
                    <Badge variant="outline" className="text-[10px] text-amber-300 border-amber-500/40">
                      2 Med Risk
                    </Badge>
                  </td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* =========================================================================
          PRINCIPAL & HOD: DEPARTMENT ATTENDANCE & PERFORMANCE BARS
         ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">
                  Department Attendance & Academic Performance
                </CardTitle>
                <CardDescription>
                  {isHOD
                    ? "Class & batch wise attendance breakdown for CSE Department"
                    : "Real-time attendance rates across academic divisions"}
                </CardDescription>
              </div>
              <Badge variant="secondary" className="text-xs">
                Term 2026-27
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { name: "Computer Science & Engineering", count: "1,240 Students", rate: 89, color: "bg-indigo-500" },
              { name: "Information Technology", count: "940 Students", rate: 91, color: "bg-emerald-500" },
              { name: "Electronics & Communication", count: "980 Students", rate: 84, color: "bg-purple-500" },
              { name: "Civil Engineering", count: "841 Students", rate: 82, color: "bg-amber-500" },
              { name: "Mechanical Engineering", count: "820 Students", rate: 78, color: "bg-sky-500" },
            ].map((dept, i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-foreground">{dept.name}</span>
                  <span className="text-muted-foreground">
                    {dept.rate}% ({dept.count})
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-secondary/80 overflow-hidden">
                  <div className={`h-full rounded-full ${dept.color}`} style={{ width: `${dept.rate}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* HOD Specific Actions: Timetable, Mentor Assignment, Library Period */}
        {isHOD ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">HOD Academic Operations</CardTitle>
              <CardDescription>Department governance tools</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link to="/dashboard/timetable" className="block">
                <div className="p-3.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 transition-all flex items-center justify-between shadow-sm">
                  <div>
                    <div className="flex items-center gap-2">
                      <h5 className="text-xs font-bold text-foreground">Create & Manage Timetables</h5>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-500 text-white uppercase">HOD Tool</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Click here to create, edit, or delete faculty timetable slots</p>
                  </div>
                  <Button size="sm" variant="gradient" className="h-7 text-[10px] px-2.5 font-semibold">
                    <Plus className="h-3 w-3 mr-1" /> Create Slot
                  </Button>
                </div>
              </Link>

              <Link to="/dashboard/students" className="block">
                <div className="p-3 rounded-lg border border-border bg-secondary/30 hover:border-indigo-500/40 transition-colors flex items-center justify-between">
                  <div>
                    <h5 className="text-xs font-semibold text-foreground">Assign Mentors to Students</h5>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Pair cohort students with faculty</p>
                  </div>
                  <UserPlus className="h-4 w-4 text-purple-400" />
                </div>
              </Link>

              <Link to="/dashboard/library" className="block">
                <div className="p-3 rounded-lg border border-border bg-secondary/30 hover:border-indigo-500/40 transition-colors flex items-center justify-between">
                  <div>
                    <h5 className="text-xs font-semibold text-foreground">Book Library Class Period</h5>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Reserve reading hall for your class</p>
                  </div>
                  <Library className="h-4 w-4 text-emerald-400" />
                </div>
              </Link>

              <Link to="/dashboard/exams" className="block">
                <div className="p-3 rounded-lg border border-border bg-secondary/30 hover:border-indigo-500/40 transition-colors flex items-center justify-between">
                  <div>
                    <h5 className="text-xs font-semibold text-foreground">Department Exams & Results</h5>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Review Midterm & semester marks</p>
                  </div>
                  <FileSpreadsheet className="h-4 w-4 text-amber-400" />
                </div>
              </Link>
            </CardContent>
          </Card>
        ) : (
          /* Principal & Super Admin: Facility Approvals Card */
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold">Facility Bookings Approval</CardTitle>
                <CardDescription>Gym, Seminar Hall, and Turf requests</CardDescription>
              </div>
              <Link to="/dashboard/facilities" className="text-xs text-indigo-400 hover:underline">
                View All →
              </Link>
            </CardHeader>
            <CardContent className="space-y-3">
              {facilityBookings.map((b) => (
                <div
                  key={b.id}
                  className="p-3 rounded-lg border border-border/60 bg-secondary/30 space-y-2 text-xs"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-foreground">{b.facility}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {b.requested_by} • {b.department}
                      </p>
                    </div>
                    <Badge
                      variant={
                        b.status === "APPROVED"
                          ? "success"
                          : b.status === "REJECTED"
                          ? "destructive"
                          : "outline"
                      }
                      className="text-[10px]"
                    >
                      {b.status}
                    </Badge>
                  </div>

                  <p className="text-[10px] text-slate-300">{b.date}</p>

                  {isPrincipal && b.status === "PENDING" && (
                    <div className="flex items-center gap-2 pt-1 border-t border-border/40">
                      <Button
                        size="sm"
                        variant="gradient"
                        className="text-[10px] h-6 px-2.5"
                        onClick={() => handleReviewBooking(b.id, "APPROVED")}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-[10px] h-6 px-2 text-red-400 border-red-500/30"
                        onClick={() => handleReviewBooking(b.id, "REJECTED")}
                      >
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {/* =========================================================================
          LIBRARY PERIOD BOOKINGS & CLASS EXAMS (FOR PRINCIPAL & HOD)
         ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Class Library Bookings */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold">Library Class Bookings</CardTitle>
              <CardDescription>Scheduled library periods booked by academic classes</CardDescription>
            </div>
            <Link to="/dashboard/library" className="text-xs text-indigo-400 hover:underline">
              Library Console →
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {libraryBookings.map((lib) => (
              <div
                key={lib.id}
                className="p-3 rounded-lg border border-border/50 bg-secondary/20 flex items-center justify-between text-xs"
              >
                <div>
                  <h5 className="font-semibold text-foreground">{lib.class_name}</h5>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Booked by: {lib.requested_by} • {lib.date}
                  </p>
                  <p className="text-[10px] text-slate-300 italic mt-0.5">"{lib.notes}"</p>
                </div>
                <Badge
                  variant={lib.status === "APPROVED" ? "success" : "outline"}
                  className="text-[10px]"
                >
                  {lib.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Class & Department Exams / Results Quick Access */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold">Exams & Gradebook Telemetry</CardTitle>
              <CardDescription>Class-wise and department-wise examination results</CardDescription>
            </div>
            <Link to="/dashboard/exams" className="text-xs text-indigo-400 hover:underline">
              Full Results Roster →
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="p-3 rounded-lg border border-border/50 bg-secondary/20 flex items-center justify-between text-xs">
              <div>
                <h5 className="font-semibold text-foreground">B.Tech CSE — Midterm Evaluation (CS301 & CS302)</h5>
                <p className="text-[10px] text-muted-foreground mt-0.5">Class Average: 84.8% • 98% Pass Rate</p>
              </div>
              <Badge variant="success" className="text-[10px]">
                Entered & Verified
              </Badge>
            </div>

            <div className="p-3 rounded-lg border border-border/50 bg-secondary/20 flex items-center justify-between text-xs">
              <div>
                <h5 className="font-semibold text-foreground">BCA Year 1 — Programming Practical Viva</h5>
                <p className="text-[10px] text-muted-foreground mt-0.5">Lab 02 Assessment completed</p>
              </div>
              <Badge variant="outline" className="text-[10px] text-indigo-400 border-indigo-500/30">
                Evaluation Finalized
              </Badge>
            </div>

            <div className="p-3 rounded-lg border border-border/50 bg-secondary/20 flex items-center justify-between text-xs">
              <div>
                <h5 className="font-semibold text-foreground">B.Tech IT — Database Systems Lab Examination</h5>
                <p className="text-[10px] text-muted-foreground mt-0.5">Grade distribution ready for HOD sign-off</p>
              </div>
              <Link to="/dashboard/exams">
                <Button size="sm" variant="outline" className="text-[10px] h-7">
                  View Results
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
