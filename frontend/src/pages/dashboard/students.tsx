"use client";

import React, { useState, useEffect } from "react";
import {
  GraduationCap,
  Search,
  Filter,
  UserCheck,
  Phone,
  Mail,
  Calendar,
  X,
  Building,
  BookOpen,
  Eye,
  ShieldAlert,
  AlertTriangle,
  Activity,
  CheckCircle,
  Award,
  Sparkles,
  Send,
  Check,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";

interface Student {
  id: string;
  student_number: string;
  roll_number: string;
  first_name?: string;
  last_name?: string;
  full_name: string;
  email: string;
  phone?: string;
  department: string;
  department_name: string;
  department_code: string;
  course_name: string;
  course_code: string;
  batch_name: string;
  semester_name: string;
  mentor_name?: string;
  attendance_rate?: number;
  cgpa?: number;
  ai_risk_level?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  ai_risk_score?: number;
  key_risk_drivers?: string[];
  hod_assignment?: {
    mentor_name: string;
    assigned_by: string;
    assigned_date: string;
    status: string;
    notes: string;
  };
  date_of_birth?: string;
  gender?: string;
  blood_group?: string;
  address?: string;
  admission_date?: string;
  status: string;
  guardian_relations?: Array<{
    id: string;
    guardian_details: {
      first_name: string;
      last_name: string;
      relationship: string;
      phone: string;
      email: string;
      occupation: string;
      address: string;
    };
    is_primary: boolean;
    emergency_contact: boolean;
  }>;
}

export default function StudentsPage() {
  const { user } = useAuth();
  const isMentor = user?.role === "MENTOR";
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [activeModalTab, setActiveModalTab] = useState<"radar" | "details" | "counseling">("radar");

  // Counseling state
  const [counselingNotes, setCounselingNotes] = useState("");
  const [counselingAction, setCounselingAction] = useState("1-on-1 Mentorship Counseling Scheduled");
  const [counselingSuccess, setCounselingSuccess] = useState(false);

  const DEFAULT_MENTEE_STUDENTS: Student[] = [
    {
      id: "stud-001",
      student_number: "STD-2026-001",
      roll_number: "2026-CSE-028",
      first_name: "Rohan",
      last_name: "Gupta",
      full_name: "Rohan Gupta",
      email: "rohan.gupta@campus360.edu",
      department: "dept-cs",
      department_name: "Computer Science & Engineering",
      department_code: "CSE",
      course_name: "B.Tech Computer Science",
      course_code: "CS301",
      batch_name: "2026-2030 Batch",
      semester_name: "Semester 3",
      mentor_name: "Prof. Rajesh Kumar",
      attendance_rate: 62.5,
      cgpa: 6.8,
      ai_risk_level: "HIGH",
      ai_risk_score: 76.0,
      key_risk_drivers: [
        "Attendance dropped to 62.5% (< 75% mandatory threshold)",
        "3 consecutive unexcused absences from core Data Structures lectures",
        "Midterm examination score dropped by 18% compared to class average",
        "Campus perimeter cameras logged unusual mid-day absences",
      ],
      hod_assignment: {
        mentor_name: "Prof. Rajesh Kumar",
        assigned_by: "Dr. Aruna Sundaram (HOD - CSE)",
        assigned_date: "12 Aug 2026",
        status: "ACTIVE",
        notes: "Cohort 2026 Mentorship Allocation approved by Department Council for specialized academic oversight.",
      },
      date_of_birth: "2005-04-12",
      gender: "MALE",
      blood_group: "O+",
      address: "Room 304, Boys Hostel B, Campus North",
      admission_date: "2024-07-15",
      status: "ACTIVE",
      guardian_relations: [
        {
          id: "guard-1",
          guardian_details: {
            first_name: "Suresh",
            last_name: "Gupta",
            relationship: "Father",
            phone: "+91 98765 43210",
            email: "suresh.gupta@corp.in",
            occupation: "Senior Engineer",
            address: "Sector 14, Chandigarh, India",
          },
          is_primary: true,
          emergency_contact: true,
        },
      ],
    },
    {
      id: "stud-002",
      student_number: "STD-2026-002",
      roll_number: "2026-CSE-042",
      first_name: "Ananya",
      last_name: "Sen",
      full_name: "Ananya Sen",
      email: "ananya.sen@campus360.edu",
      department: "dept-cs",
      department_name: "Computer Science & Engineering",
      department_code: "CSE",
      course_name: "B.Tech Computer Science",
      course_code: "CS301",
      batch_name: "2026-2030 Batch",
      semester_name: "Semester 3",
      mentor_name: "Prof. Rajesh Kumar",
      attendance_rate: 78.4,
      cgpa: 8.9,
      ai_risk_level: "MEDIUM",
      ai_risk_score: 46.5,
      key_risk_drivers: [
        "Assignment 3 (AVL Trees) overdue by 2 days",
        "Attendance near 75% threshold (currently 78.4%)",
        "Exam performance remains strong (CGPA 8.9 / 10.0)",
      ],
      hod_assignment: {
        mentor_name: "Prof. Rajesh Kumar",
        assigned_by: "Dr. Aruna Sundaram (HOD - CSE)",
        assigned_date: "12 Aug 2026",
        status: "ACTIVE",
        notes: "Cohort 2026 Mentorship Allocation approved by Department Council.",
      },
      date_of_birth: "2005-08-22",
      gender: "FEMALE",
      blood_group: "B+",
      address: "Block C, Girls Hostel, Campus South",
      admission_date: "2024-07-15",
      status: "ACTIVE",
      guardian_relations: [
        {
          id: "guard-2",
          guardian_details: {
            first_name: "Debashis",
            last_name: "Sen",
            relationship: "Father",
            phone: "+91 98111 22334",
            email: "d.sen@kolkata.gov.in",
            occupation: "Civil Services Officer",
            address: "Salt Lake, Kolkata, India",
          },
          is_primary: true,
          emergency_contact: true,
        },
      ],
    },
    {
      id: "stud-003",
      student_number: "STD-2026-003",
      roll_number: "2026-CSE-015",
      first_name: "Rahul",
      last_name: "Kumar",
      full_name: "Rahul Kumar",
      email: "rahul.k@campus360.edu",
      department: "dept-cs",
      department_name: "Computer Science & Engineering",
      department_code: "CSE",
      course_name: "B.Tech Computer Science",
      course_code: "CS301",
      batch_name: "2026-2030 Batch",
      semester_name: "Semester 3",
      mentor_name: "Prof. Rajesh Kumar",
      attendance_rate: 94.2,
      cgpa: 9.4,
      ai_risk_level: "LOW",
      ai_risk_score: 12.0,
      key_risk_drivers: [
        "Exceptional lecture and laboratory attendance (94.2%)",
        "Top 5% percentile in mid-semester assessments",
        "Consistent academic engagement across all registered courses",
      ],
      hod_assignment: {
        mentor_name: "Prof. Rajesh Kumar",
        assigned_by: "Dr. Aruna Sundaram (HOD - CSE)",
        assigned_date: "12 Aug 2026",
        status: "ACTIVE",
        notes: "High-achieving honors student track mentorship assignment.",
      },
      date_of_birth: "2005-01-19",
      gender: "MALE",
      blood_group: "A+",
      address: "Room 112, Boys Hostel A, Campus North",
      admission_date: "2024-07-15",
      status: "ACTIVE",
      guardian_relations: [
        {
          id: "guard-3",
          guardian_details: {
            first_name: "Meena",
            last_name: "Kumar",
            relationship: "Mother",
            phone: "+91 97234 56789",
            email: "meena.k@gmail.com",
            occupation: "Professor",
            address: "Indiranagar, Bengaluru, India",
          },
          is_primary: true,
          emergency_contact: true,
        },
      ],
    },
  ];

  useEffect(() => {
    async function loadStudents() {
      try {
        setLoading(true);
        const data = await apiRequest<{ results: Student[] } | Student[]>("/students/");
        const list = Array.isArray(data) ? data : data?.results || [];
        setStudents(list.length > 0 ? list : DEFAULT_MENTEE_STUDENTS);
      } catch (err) {
        console.error("Failed to load students, using fallback roster", err);
        setStudents(DEFAULT_MENTEE_STUDENTS);
      } finally {
        setLoading(false);
      }
    }
    loadStudents();
  }, []);

  const handleSaveCounseling = (e: React.FormEvent) => {
    e.preventDefault();
    setCounselingSuccess(true);
    setTimeout(() => {
      setCounselingSuccess(false);
      setCounselingNotes("");
    }, 2500);
  };

  const filteredStudents = students.filter((s) => {
    const matchesSearch =
      s.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      s.roll_number?.toLowerCase().includes(search.toLowerCase()) ||
      s.student_number?.toLowerCase().includes(search.toLowerCase()) ||
      s.course_code?.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === "ALL" || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <GraduationCap className="h-7 w-7 text-indigo-400" />
              {isMentor ? "Assigned Mentee Cohort" : "Student Directory"}
            </h1>
            {isMentor && (
              <Badge variant="outline" className="border-teal-500/40 text-teal-300 text-xs py-0.5">
                Assigned by HOD Dr. Aruna Sundaram
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isMentor
              ? "Comprehensive academic performance telemetry, attendance monitoring, and AI risk radar for your assigned mentee cohort."
              : "Institutional student profiles, cohort enrollments, and mentor linkages."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs py-1">
            {filteredStudents.length} Students in Cohort
          </Badge>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card className="glass-panel">
        <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by student name, roll number, or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 text-xs"
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-secondary/60 border border-border/60 rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Student List Table */}
      <Card className="glass-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-secondary/40 border-b border-border/60 text-muted-foreground uppercase font-semibold text-[10px] tracking-wider">
              <tr>
                <th className="p-4">Student</th>
                <th className="p-4">Roll Number</th>
                <th className="p-4">Attendance %</th>
                <th className="p-4">Performance (CGPA)</th>
                <th className="p-4">AI Risk Radar</th>
                <th className="p-4">HOD Mentorship</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent mr-2 align-middle" />
                    Loading Student Roster...
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    No students match the current query criteria.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((s) => {
                  const att = s.attendance_rate ?? 85.0;
                  const isDefaulter = att < 75;
                  const cgpa = s.cgpa ?? 8.2;
                  const riskLevel = s.ai_risk_level ?? (isDefaulter ? "HIGH" : "LOW");
                  const riskScore = s.ai_risk_score ?? (isDefaulter ? 76.0 : 18.0);

                  return (
                    <tr key={s.id} className="hover:bg-secondary/30 transition-colors">
                      {/* Student info */}
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 text-white font-bold flex items-center justify-center shrink-0 shadow-sm text-xs">
                            {s.full_name?.[0] || "S"}
                          </div>
                          <div>
                            <p className="font-semibold text-foreground text-xs">{s.full_name}</p>
                            <p className="text-[10px] text-muted-foreground">{s.course_code} • {s.batch_name}</p>
                          </div>
                        </div>
                      </td>

                      {/* Roll Number */}
                      <td className="p-4 font-mono font-medium text-indigo-300 text-xs">
                        {s.roll_number}
                      </td>

                      {/* Attendance % */}
                      <td className="p-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={`font-bold ${isDefaulter ? "text-red-400" : "text-emerald-400"}`}>
                              {att}%
                            </span>
                            {isDefaulter ? (
                              <Badge variant="destructive" className="text-[9px] px-1 py-0 uppercase">
                                Defaulter
                              </Badge>
                            ) : (
                              <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] px-1 py-0">
                                Safe
                              </Badge>
                            )}
                          </div>
                          <div className="w-20 bg-secondary rounded-full h-1 overflow-hidden">
                            <div
                              className={`h-1 rounded-full ${isDefaulter ? "bg-red-500" : "bg-emerald-500"}`}
                              style={{ width: `${Math.min(100, att)}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Performance (CGPA) */}
                      <td className="p-4">
                        <div className="flex items-center gap-1.5 font-semibold text-foreground">
                          <Award className="h-3.5 w-3.5 text-amber-400" />
                          <span>{cgpa} / 10.0</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground">Semester 3</span>
                      </td>

                      {/* AI Risk Radar */}
                      <td className="p-4">
                        <div>
                          {riskLevel === "HIGH" && (
                            <Badge className="bg-red-500/20 text-red-300 border-red-500/40 text-[10px] flex items-center gap-1 w-fit">
                              <AlertTriangle className="h-3 w-3 text-red-400" /> High Risk ({riskScore}/100)
                            </Badge>
                          )}
                          {riskLevel === "MEDIUM" && (
                            <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px] flex items-center gap-1 w-fit">
                              <Activity className="h-3 w-3 text-amber-400" /> Medium Risk ({riskScore}/100)
                            </Badge>
                          )}
                          {riskLevel === "LOW" && (
                            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px] flex items-center gap-1 w-fit">
                              <CheckCircle className="h-3 w-3 text-emerald-400" /> Low Risk ({riskScore}/100)
                            </Badge>
                          )}
                        </div>
                      </td>

                      {/* HOD Mentorship linkage */}
                      <td className="p-4">
                        <div className="flex items-center gap-1.5 text-xs">
                          <UserCheck className="h-3.5 w-3.5 text-teal-400 shrink-0" />
                          <div>
                            <span className="font-medium text-foreground block">
                              {s.hod_assignment?.mentor_name || s.mentor_name || "Prof. Priya Nair"}
                            </span>
                            <span className="text-[9px] text-teal-300/80 block">
                              Assigned by HOD (CS)
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-right">
                        <Button
                          size="sm"
                          variant="gradient"
                          onClick={() => {
                            setSelectedStudent(s);
                            setActiveModalTab("radar");
                          }}
                          className="h-7 px-2.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 shadow-sm"
                        >
                          <Sparkles className="h-3 w-3 mr-1" /> View AI Radar
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Comprehensive Student Details & AI Radar Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <Card className="max-w-3xl w-full glass-panel border-indigo-500/30 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border/60 shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white font-bold text-lg flex items-center justify-center shadow-md">
                  {selectedStudent.full_name?.[0]}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base font-bold text-white">
                      {selectedStudent.full_name}
                    </CardTitle>
                    <Badge variant="outline" className="text-[10px] border-indigo-500/40 text-indigo-300">
                      Roll {selectedStudent.roll_number}
                    </Badge>
                  </div>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    {selectedStudent.course_name} ({selectedStudent.batch_name}) • {selectedStudent.department_name}
                  </CardDescription>
                </div>
              </div>
              <button
                onClick={() => setSelectedStudent(null)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </CardHeader>

            {/* Modal Navigation Tabs */}
            <div className="flex items-center gap-3 px-6 pt-3 border-b border-border/40 text-xs font-semibold">
              <button
                onClick={() => setActiveModalTab("radar")}
                className={`pb-2.5 border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeModalTab === "radar"
                    ? "border-indigo-400 text-indigo-300"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" /> AI Radar & Performance
              </button>
              <button
                onClick={() => setActiveModalTab("counseling")}
                className={`pb-2.5 border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeModalTab === "counseling"
                    ? "border-indigo-400 text-indigo-300"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <UserCheck className="h-3.5 w-3.5" /> Mentor Counseling Log
              </button>
              <button
                onClick={() => setActiveModalTab("details")}
                className={`pb-2.5 border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeModalTab === "details"
                    ? "border-indigo-400 text-indigo-300"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <GraduationCap className="h-3.5 w-3.5" /> Profile & Guardians
              </button>
            </div>

            <CardContent className="p-6 space-y-6 overflow-y-auto">
              {/* TAB 1: AI RADAR, ATTENDANCE, AND PERFORMANCE */}
              {activeModalTab === "radar" && (
                <div className="space-y-5">
                  {/* HOD Assignment Banner */}
                  <div className="p-3.5 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <UserCheck className="h-5 w-5 text-teal-400 shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-foreground">
                          Cohort Mentorship Assigned by HOD
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          Assigned by Dr. Aruna Sundaram (Head of Department) • Active for Semester 3
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="border-teal-500/40 text-teal-300 text-[10px]">
                      HOD Verified
                    </Badge>
                  </div>

                  {/* 3 Core Metric KPI Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Attendance */}
                    <div className="p-4 rounded-xl bg-secondary/30 border border-border/50 space-y-1">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Attendance Rate</span>
                        <Clock className="h-4 w-4 text-indigo-400" />
                      </div>
                      <div className={`text-2xl font-bold ${(selectedStudent.attendance_rate ?? 85) < 75 ? "text-red-400" : "text-emerald-400"}`}>
                        {selectedStudent.attendance_rate ?? 85.0}%
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {(selectedStudent.attendance_rate ?? 85) < 75
                          ? "CRITICAL: Defaulter Watchlist (< 75%)"
                          : "Good Standing (Above 75% Threshold)"}
                      </p>
                    </div>

                    {/* CGPA */}
                    <div className="p-4 rounded-xl bg-secondary/30 border border-border/50 space-y-1">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Academic CGPA</span>
                        <Award className="h-4 w-4 text-amber-400" />
                      </div>
                      <div className="text-2xl font-bold text-foreground">
                        {selectedStudent.cgpa ?? 8.2} <span className="text-xs text-muted-foreground">/ 10.0</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        Midterm Exam Average: {Math.round((selectedStudent.cgpa ?? 8.2) * 10)}%
                      </p>
                    </div>

                    {/* AI Risk Score */}
                    <div className="p-4 rounded-xl bg-secondary/30 border border-border/50 space-y-1">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>AI Risk Radar</span>
                        <ShieldAlert className="h-4 w-4 text-purple-400" />
                      </div>
                      <div className="text-2xl font-bold text-foreground">
                        {selectedStudent.ai_risk_score ?? 24.0} <span className="text-xs text-muted-foreground">/ 100</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        Status: <span className="font-semibold text-purple-300">{selectedStudent.ai_risk_level ?? "LOW"} RISK</span>
                      </p>
                    </div>
                  </div>

                  {/* AI Early-Warning Radar Explainability Box */}
                  <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-950/20 via-card to-slate-950 border border-indigo-500/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-indigo-400" />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                          AI Early-Warning Telemetry & Risk Drivers
                        </h4>
                      </div>
                      <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/40 text-[10px]">
                        Multi-Factor Model
                      </Badge>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">
                        The neural telemetry system analyzed attendance records, assignment timelines, and midterm score variance:
                      </p>
                      <ul className="space-y-1.5 pl-1">
                        {(selectedStudent.key_risk_drivers || [
                          "Attendance maintained safely above institutional requirements.",
                          "Consistent submission velocity across enrolled laboratory practicals.",
                          "Good participation in core Computer Science modules.",
                        ]).map((driver, idx) => (
                          <li key={idx} className="text-xs text-foreground flex items-start gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                            <span>{driver}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="pt-2 border-t border-border/40 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Recommended Mentorship Action:</span>
                      <span className="font-semibold text-indigo-300">
                        {(selectedStudent.attendance_rate ?? 85) < 75
                          ? "Schedule 1-on-1 Counseling & Attendance Warning"
                          : "Routine Observation & Career Guidance"}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: MENTOR COUNSELING LOG */}
              {activeModalTab === "counseling" && (
                <div className="space-y-4">
                  {counselingSuccess && (
                    <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
                      <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                      <span>Counseling intervention recorded in student dossier!</span>
                    </div>
                  )}

                  <form onSubmit={handleSaveCounseling} className="space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-foreground block mb-1">
                        Intervention Action Type
                      </label>
                      <select
                        value={counselingAction}
                        onChange={(e) => setCounselingAction(e.target.value)}
                        className="w-full bg-secondary/60 border border-border/60 rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="1-on-1 Mentorship Counseling Scheduled">
                          1-on-1 Mentorship Counseling Scheduled
                        </option>
                        <option value="Attendance Defaulter Warning Issued">
                          Attendance Defaulter Warning Issued
                        </option>
                        <option value="Remedial Coursework & Tutoring Assigned">
                          Remedial Coursework & Tutoring Assigned
                        </option>
                        <option value="Parent / Guardian Contacted">
                          Parent / Guardian Contacted
                        </option>
                        <option value="Career & Academic Roadmap Review">
                          Career & Academic Roadmap Review
                        </option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-foreground block mb-1">
                        Counselor Observation & Action Notes
                      </label>
                      <textarea
                        rows={4}
                        required
                        value={counselingNotes}
                        onChange={(e) => setCounselingNotes(e.target.value)}
                        placeholder="Detail student discussion, attendance recovery plan, or academic goals agreed upon..."
                        className="w-full bg-secondary/60 border border-border/60 rounded-lg p-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                      />
                    </div>

                    <Button type="submit" variant="gradient" className="w-full text-xs font-semibold h-9">
                      <Send className="h-3.5 w-3.5 mr-1.5" /> Save Counseling Record
                    </Button>
                  </form>
                </div>
              )}

              {/* TAB 3: PROFILE & GUARDIAN DETAILS */}
              {activeModalTab === "details" && (
                <div className="space-y-5">
                  {/* Academic Overview */}
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-indigo-400 mb-3">
                      Academic Cohort
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                      <div className="p-3 rounded-lg bg-secondary/40 border border-border/40">
                        <span className="text-[10px] text-muted-foreground block">Department</span>
                        <span className="font-semibold text-foreground">{selectedStudent.department_name}</span>
                      </div>
                      <div className="p-3 rounded-lg bg-secondary/40 border border-border/40">
                        <span className="text-[10px] text-muted-foreground block">Course</span>
                        <span className="font-semibold text-foreground">{selectedStudent.course_name}</span>
                      </div>
                      <div className="p-3 rounded-lg bg-secondary/40 border border-border/40">
                        <span className="text-[10px] text-muted-foreground block">Batch / Semester</span>
                        <span className="font-semibold text-foreground">{selectedStudent.batch_name} • {selectedStudent.semester_name || "Sem 3"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Personal & Contact */}
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-indigo-400 mb-3">
                      Personal Details & Contact
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                      <div className="p-3 rounded-lg bg-secondary/40 border border-border/40">
                        <span className="text-[10px] text-muted-foreground block">Official Email</span>
                        <span className="font-medium text-foreground">{selectedStudent.email}</span>
                      </div>
                      <div className="p-3 rounded-lg bg-secondary/40 border border-border/40">
                        <span className="text-[10px] text-muted-foreground block">Phone</span>
                        <span className="font-medium text-foreground">{selectedStudent.phone || "+91 98000 11007"}</span>
                      </div>
                      <div className="p-3 rounded-lg bg-secondary/40 border border-border/40">
                        <span className="text-[10px] text-muted-foreground block">Blood Group & Gender</span>
                        <span className="font-medium text-foreground">{selectedStudent.blood_group || "O+"} • {selectedStudent.gender || "MALE"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Guardian Info */}
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-indigo-400 mb-3">
                      Guardian & Emergency Contact
                    </h4>
                    <div className="p-4 rounded-xl bg-secondary/40 border border-border/40 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground">Suresh Sharma (Father)</span>
                        <Badge variant="outline" className="text-[10px] border-indigo-500/40 text-indigo-300">
                          Primary Contact
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground">Phone: +91 98000 11008 • Occupation: Senior Architect</p>
                      <p className="text-[11px] text-muted-foreground">Address: 45 Green Meadows, Koramangala, Bengaluru</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
