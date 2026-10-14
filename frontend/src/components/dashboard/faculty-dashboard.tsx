"use client";

import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  BookOpen,
  Calendar,
  CalendarCheck,
  FileCheck2,
  Clock,
  MapPin,
  CheckCircle,
  Users,
  ShieldAlert,
  AlertTriangle,
  Activity,
  MessageSquare,
  Camera,
  GraduationCap,
  Sparkles,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  FileText,
  UserCheck,
  Award,
  Layers,
  ArrowRight,
  Megaphone,
  UploadCloud,
  CalendarX,
  CreditCard,
  Download,
  BrainCircuit,
  Send,
  FileSpreadsheet,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/api";

interface MenteeStudent {
  id: string;
  roll_number: string;
  name: string;
  department: string;
  batch: string;
  attendance_rate: number;
  cgpa: number;
  ai_risk_level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  ai_risk_score: number;
  key_risk_drivers: string[];
  last_seen_zone?: string;
  last_counseling_date?: string;
}

export function FacultyDashboard() {
  const { user, switchRole } = useAuth();
  const navigate = useNavigate();

  // Mode switcher: "COMBINED" (above is faculty, below mentor), "FACULTY", or "MENTOR"
  const [viewMode, setViewMode] = useState<"COMBINED" | "FACULTY" | "MENTOR">(
    user?.role === "MENTOR" ? "MENTOR" : "COMBINED"
  );

  // Counseling modal state
  const [counselingStudent, setCounselingStudent] = useState<MenteeStudent | null>(null);
  const [radarStudent, setRadarStudent] = useState<MenteeStudent | null>(null);
  const [counselingNotes, setCounselingNotes] = useState("");
  const [counselingAction, setCounselingAction] = useState("1-on-1 Mentorship Counseling Scheduled");
  const [counselingHistory, setCounselingHistory] = useState<Record<string, string[]>>({
    "2026-CSE-028": ["Scheduled extra tutoring for AVL Trees", "Bi-weekly attendance improvement warning issued"],
    "2026-CSE-042": ["Reviewed late assignment submission status", "Advised on lab assignment pacing"],
  });
  const [showCounselingSuccess, setShowCounselingSuccess] = useState(false);

  // Mentee Cohort data
  const [mentees, setMentees] = useState<MenteeStudent[]>([
    {
      id: "stud-001",
      roll_number: "2026-CSE-028",
      name: "Rohan Gupta",
      department: "Computer Science & Engineering",
      batch: "2026-2030 Batch",
      attendance_rate: 62.5,
      cgpa: 6.8,
      ai_risk_level: "HIGH",
      ai_risk_score: 76.0,
      key_risk_drivers: [
        "Attendance dropped to 62.5% (< 75% mandatory threshold)",
        "Consecutive 3-day absence from Data Structures lecture",
        "Midterm score dropped by 18% compared to class average",
      ],
      last_seen_zone: "Main Campus Gate 1 (14 Oct, 09:12 AM)",
      last_counseling_date: "10 Oct 2026",
    },
    {
      id: "stud-002",
      roll_number: "2026-CSE-042",
      name: "Ananya Sen",
      department: "Computer Science & Engineering",
      batch: "2026-2030 Batch",
      attendance_rate: 78.4,
      cgpa: 8.9,
      ai_risk_level: "MEDIUM",
      ai_risk_score: 46.5,
      key_risk_drivers: [
        "Assignment 3 (AVL Trees) overdue by 2 days",
        "Library book return pending > 7 days",
      ],
      last_seen_zone: "CS Lab Complex (14 Oct, 11:45 AM)",
      last_counseling_date: "05 Oct 2026",
    },
    {
      id: "stud-003",
      roll_number: "2026-CSE-015",
      name: "Rahul Kumar",
      department: "Computer Science & Engineering",
      batch: "2026-2030 Batch",
      attendance_rate: 94.2,
      cgpa: 9.4,
      ai_risk_level: "LOW",
      ai_risk_score: 12.0,
      key_risk_drivers: [
        "Exceptional lecture attendance (94.2%)",
        "Class exam percentile top 5%",
      ],
      last_seen_zone: "Central Academic Block (14 Oct, 01:10 PM)",
      last_counseling_date: "28 Sep 2026",
    },
  ]);

  // Handle switching role mode
  const handleModeChange = (mode: "COMBINED" | "FACULTY" | "MENTOR") => {
    setViewMode(mode);
    if (mode === "FACULTY" && user?.role !== "FACULTY") {
      switchRole("FACULTY");
    } else if (mode === "MENTOR" && user?.role !== "MENTOR") {
      switchRole("MENTOR");
    }
  };

  const handleSaveCounseling = (e: React.FormEvent) => {
    e.preventDefault();
    if (!counselingStudent || !counselingNotes.trim()) return;

    setCounselingHistory((prev) => ({
      ...prev,
      [counselingStudent.roll_number]: [
        `${counselingAction}: ${counselingNotes}`,
        ...(prev[counselingStudent.roll_number] || []),
      ],
    }));

    setShowCounselingSuccess(true);
    setTimeout(() => {
      setShowCounselingSuccess(false);
      setCounselingStudent(null);
      setCounselingNotes("");
    }, 1400);
  };

  // Faculty Quick Action Modals State
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [announcementData, setAnnouncementData] = useState({
    title: "",
    content: "",
    category: "ACADEMIC",
    target_audience: "STUDENTS_ONLY",
  });

  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveData, setLeaveData] = useState({
    leave_type: "CASUAL",
    from_date: "",
    to_date: "",
    reason: "",
  });

  const [showUploadNotesModal, setShowUploadNotesModal] = useState(false);
  const [notesData, setNotesData] = useState({
    title: "",
    subject: "CS301 - Data Structures & Algorithms",
    description: "",
    file_name: "lecture_unit_4_binary_trees.pdf",
  });

  const [actionSuccessToast, setActionSuccessToast] = useState<string | null>(null);

  // Class Enrolled Students with HOD-Assigned Mentors
  const [classStudents] = useState([
    {
      id: "cls-01",
      name: "Rohan Gupta",
      roll_number: "2026-CSE-028",
      batch: "B.Tech CSE — Year 2, Sem 3",
      attendance_rate: 62.5,
      cgpa: 6.8,
      assigned_mentor: "Prof. Anil Verma (Mentor)",
      hod_allocated_date: "12 Aug 2026",
      ai_risk_level: "HIGH",
      ai_risk_score: 76.0,
      fee_status: "PAID",
    },
    {
      id: "cls-02",
      name: "Ananya Sen",
      roll_number: "2026-CSE-042",
      batch: "B.Tech CSE — Year 2, Sem 3",
      attendance_rate: 78.4,
      cgpa: 8.9,
      assigned_mentor: "Prof. Priya Nair (Faculty & Mentor)",
      hod_allocated_date: "12 Aug 2026",
      ai_risk_level: "MEDIUM",
      ai_risk_score: 46.5,
      fee_status: "PAID",
    },
    {
      id: "cls-03",
      name: "Rahul Kumar",
      roll_number: "2026-CSE-015",
      batch: "B.Tech CSE — Year 2, Sem 3",
      attendance_rate: 94.2,
      cgpa: 9.4,
      assigned_mentor: "Prof. Rajesh Kumar (Senior Mentor)",
      hod_allocated_date: "12 Aug 2026",
      ai_risk_level: "LOW",
      ai_risk_score: 12.0,
      fee_status: "PAID",
    },
    {
      id: "cls-04",
      name: "Sneha Reddy",
      roll_number: "2026-CSE-055",
      batch: "B.Tech CSE — Year 2, Sem 3",
      attendance_rate: 88.0,
      cgpa: 8.5,
      assigned_mentor: "Prof. Anil Verma (Mentor)",
      hod_allocated_date: "12 Aug 2026",
      ai_risk_level: "LOW",
      ai_risk_score: 22.0,
      fee_status: "PENDING",
    },
    {
      id: "cls-05",
      name: "Vikas Mehra",
      roll_number: "2026-CSE-061",
      batch: "B.Tech CSE — Year 2, Sem 3",
      attendance_rate: 71.0,
      cgpa: 7.2,
      assigned_mentor: "Prof. Priya Nair (Faculty & Mentor)",
      hod_allocated_date: "12 Aug 2026",
      ai_risk_level: "MEDIUM",
      ai_risk_score: 52.0,
      fee_status: "PAID",
    },
  ]);

  const triggerSuccessToast = (msg: string) => {
    setActionSuccessToast(msg);
    setTimeout(() => setActionSuccessToast(null), 3000);
  };

  const facultyMetrics = [
    {
      title: "Total Class Students",
      value: "184 Students",
      change: "Whole enrolled across 3 active courses",
      icon: Users,
      color: "text-indigo-400",
      bg: "bg-indigo-500/10",
    },
    {
      title: "Class Attendance",
      value: "92.6%",
      change: "Today's lectures marked (B.Tech & BCA)",
      icon: CalendarCheck,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
    },
    {
      title: "Fee Collection in Class",
      value: "86.4%",
      change: "₹4,12,000 / ₹4,77,000 collected",
      icon: CreditCard,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
    },
    {
      title: "Today's Class Schedule",
      value: "4 Lectures",
      change: "2 Completed • 2 Upcoming",
      icon: Clock,
      color: "text-purple-400",
      bg: "bg-purple-500/10",
    },
  ];

  const todayClasses = [
    {
      subject: "Data Structures & Algorithms (CS301)",
      batch: "B.Tech CSE — Year 2, Sem 3",
      time: "09:00 AM - 10:00 AM",
      room: "Hall 304 (Lecture Room)",
      status: "COMPLETED",
    },
    {
      subject: "Advanced Python Programming (CS302)",
      batch: "BCA — Year 1, Sem 2",
      time: "11:30 AM - 12:30 PM",
      room: "Lecture Hall 202",
      status: "IN_PROGRESS",
    },
    {
      subject: "Database Management Systems (CS303)",
      batch: "B.Tech IT — Year 2, Sem 3",
      time: "02:00 PM - 03:00 PM",
      room: "Lecture Hall B",
      status: "UPCOMING",
    },
    {
      subject: "Class In-Charge Advisory & Mentorship Session",
      batch: "B.Tech CSE — Year 2, Sem 3",
      time: "03:30 PM - 04:30 PM",
      room: "Classroom 304",
      status: "UPCOMING",
    },
  ];

  const assignedSubjects = [
    {
      code: "CS301",
      name: "Data Structures & Algorithms",
      batch: "B.Tech CSE (In-Charge Class)",
      credits: 4,
      syllabusProgress: 68,
      studentsCount: 64,
    },
    {
      code: "CS302",
      name: "Advanced Python Systems",
      batch: "BCA Year 1",
      credits: 3,
      syllabusProgress: 54,
      studentsCount: 58,
    },
    {
      code: "CS303",
      name: "Database Management Systems",
      batch: "B.Tech IT 2026",
      credits: 3,
      syllabusProgress: 75,
      studentsCount: 62,
    },
  ];

  return (
    <div className="space-y-8">
      {/* =========================================================================
          PERSPECTIVE SWITCHER BAR
          "Switch option between mentor and faculty: above is faculty, below mentor"
         ========================================================================= */}
      <div className="p-4 rounded-2xl bg-card/80 border border-indigo-500/30 shadow-xl backdrop-blur-xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Role Mode Switcher
              </span>
              <Badge variant="outline" className="text-[10px] border-indigo-500/40 text-indigo-300">
                Active: {user?.role === "FACULTY" ? "CLASS INCHARGE" : user?.role}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Switch perspective between Class Incharge (Academics & Class Section Management) and Mentor (Cohort & AI Radar)
            </p>
          </div>
        </div>

        {/* 3-Way Segmented Control */}
        <div className="flex items-center bg-secondary/80 border border-border p-1 rounded-xl text-xs">
          <button
            type="button"
            id="view-mode-combined"
            onClick={() => handleModeChange("COMBINED")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
              viewMode === "COMBINED"
                ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Dual View (Class In-Charge Above, Mentor Below)</span>
          </button>

          <button
            type="button"
            id="view-mode-faculty"
            onClick={() => handleModeChange("FACULTY")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
              viewMode === "FACULTY"
                ? "bg-indigo-600 text-white shadow-md"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>👨‍🏫</span>
            <span>Class Incharge Mode</span>
          </button>

          <button
            type="button"
            id="view-mode-mentor"
            onClick={() => handleModeChange("MENTOR")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
              viewMode === "MENTOR"
                ? "bg-purple-600 text-white shadow-md"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>🎯</span>
            <span>Mentor Mode</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          SECTION 1: CLASS INCHARGE MODE (ABOVE)
          Teaching schedule, attendance marking, subject management, class exams/results
         ========================================================================= */}
      {(viewMode === "FACULTY" || viewMode === "COMBINED") && (
        <section id="faculty-section" className="space-y-6">
          {/* Class Incharge Header Banner */}
          <div className="p-6 rounded-2xl bg-gradient-to-r from-blue-950/60 via-slate-900/60 to-indigo-950/50 border border-blue-500/20 backdrop-blur-xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs border-indigo-500/40 text-indigo-300">
                    👨‍🏫 Class Incharge • B.Tech CSE (Year 2, Sem 3)
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {user?.college?.name || "Apex Institute of Tech"} • Dept. of Computer Science
                  </span>
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-white mt-1">
                  Welcome, Prof. {user?.first_name} {user?.last_name}! (Class Incharge)
                </h1>
                <p className="text-sm text-slate-300 mt-0.5">
                  Class Incharge Console. Direct class monitoring, session attendance registers, class fee collections, exam evaluation, and mentor coordination.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="gradient"
                  size="sm"
                  onClick={() => setShowAnnouncementModal(true)}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  <Megaphone className="h-4 w-4 mr-1.5" /> Make Announcement
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowLeaveModal(true)}
                  className="border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
                >
                  <CalendarX className="h-4 w-4 mr-1.5 text-amber-400" /> Leave Request (To HOD)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowUploadNotesModal(true)}
                  className="border-blue-500/40 text-blue-300 hover:bg-blue-500/10"
                >
                  <UploadCloud className="h-4 w-4 mr-1.5 text-blue-400" /> Upload Notes
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/dashboard/analytics")}
                  className="border-purple-500/40 text-purple-300 hover:bg-purple-500/10"
                >
                  <BrainCircuit className="h-4 w-4 mr-1.5 text-purple-400" /> Class AI Radar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/dashboard/attendance")}
                >
                  <CalendarCheck className="h-4 w-4 mr-1.5" /> Mark Attendance
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/dashboard/timetable")}
                >
                  <Calendar className="h-4 w-4 mr-1.5" /> Timetable
                </Button>
              </div>
            </div>
          </div>

          {/* Faculty Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {facultyMetrics.map((m, idx) => {
              const Icon = m.icon;
              return (
                <Card key={idx} className="glass-panel-hover">
                  <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {m.title}
                    </CardTitle>
                    <div className={`p-2 rounded-lg ${m.bg}`}>
                      <Icon className={`h-4 w-4 ${m.color}`} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-foreground">{m.value}</div>
                    <p className="text-xs text-muted-foreground mt-1">{m.change}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Today's Class Teaching Schedule */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Today's Class Teaching Schedule</CardTitle>
                <CardDescription>Scheduled lecture periods, tutorials, and class incharge advisory sessions for today</CardDescription>
              </div>
              <Badge variant="secondary" className="text-xs">
                {todayClasses.length} Sessions Today
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {todayClasses.map((item, index) => (
                  <div
                    key={index}
                    className="p-4 rounded-xl border border-border/60 bg-secondary/30 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:border-indigo-500/40 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                        <BookOpen className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-foreground">{item.subject}</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">{item.batch}</p>
                        <div className="flex items-center gap-4 mt-1 text-xs text-slate-300">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-indigo-400" /> {item.time}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-indigo-400" /> {item.room}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end md:self-center">
                      {item.status === "COMPLETED" && (
                        <Badge variant="success" className="text-xs">
                          <CheckCircle className="h-3 w-3 mr-1" /> Attendance Marked
                        </Badge>
                      )}
                      {item.status === "IN_PROGRESS" && (
                        <Button
                          size="sm"
                          variant="gradient"
                          className="text-xs h-8"
                          onClick={() => navigate("/dashboard/attendance")}
                        >
                          Mark Attendance Now
                        </Button>
                      )}
                      {item.status === "UPCOMING" && (
                        <Badge variant="secondary" className="text-xs">
                          Upcoming
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Subject Management & Class Exam Results */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Assigned Subjects & Syllabus Coverage */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold">Assigned Subjects & Syllabi</CardTitle>
                  <CardDescription>Academic course progress tracking</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {assignedSubjects.map((sub, i) => (
                  <div key={i} className="p-3 rounded-lg border border-border/50 bg-secondary/20 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <div>
                        <span className="font-semibold text-foreground">{sub.name}</span>
                        <span className="text-muted-foreground ml-2">({sub.code})</span>
                      </div>
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {sub.credits} Credits • {sub.studentsCount} Students
                      </Badge>
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                        <span>Syllabus Completion</span>
                        <span className="font-semibold text-foreground">{sub.syllabusProgress}%</span>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-indigo-500 h-1.5 rounded-full"
                          style={{ width: `${sub.syllabusProgress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Class Exams & Results Grading */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold">Class Exams & Results Evaluation</CardTitle>
                  <CardDescription>Midterm marks and grade distribution</CardDescription>
                </div>
                <Link to="/dashboard/exams" className="text-xs text-indigo-400 hover:underline">
                  Open Gradebook →
                </Link>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-3 rounded-lg border border-border/50 bg-secondary/20 flex items-center justify-between">
                  <div>
                    <h5 className="text-xs font-semibold text-foreground">Midterm Exam 1: CS301 (Data Structures)</h5>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Evaluation completed • 64 papers graded</p>
                  </div>
                  <Badge variant="success" className="text-xs">
                    Entered (Avg: 82.4%)
                  </Badge>
                </div>

                <div className="p-3 rounded-lg border border-border/50 bg-secondary/20 flex items-center justify-between">
                  <div>
                    <h5 className="text-xs font-semibold text-foreground">Unit Test 2: CS302 (Python Application Systems)</h5>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Class theory test & algorithm formulation • 64 papers graded</p>
                  </div>
                  <Badge variant="outline" className="text-xs text-indigo-400 border-indigo-500/30">
                    Grading In Progress
                  </Badge>
                </div>

                <div className="p-3 rounded-lg border border-border/50 bg-secondary/20 flex items-center justify-between">
                  <div>
                    <h5 className="text-xs font-semibold text-foreground">Assignment 3: Balanced AVL Search Trees</h5>
                    <p className="text-[11px] text-muted-foreground mt-0.5">46/64 Submissions received</p>
                  </div>
                  <Link to="/dashboard/assignments">
                    <Button size="sm" variant="outline" className="text-xs h-7">
                      Review Submissions
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Class Students Directory & Assigned Mentors */}
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base font-semibold">In-Charge Class Students Directory & Assigned Mentors</CardTitle>
                  <Badge variant="outline" className="border-indigo-500/40 text-indigo-300 text-xs">
                    Class In-Charge Roster: 64 Enrolled (184 Total Teaching)
                  </Badge>
                </div>
                <CardDescription>
                  Official class incharge register showing student attendance records, tuition fees, academic standing, and HOD-assigned mentors
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate("/dashboard/analytics")}
                  className="text-xs border-purple-500/30 text-purple-300 hover:bg-purple-500/10"
                >
                  <BrainCircuit className="h-3.5 w-3.5 mr-1 text-purple-400" /> Class AI Radar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate("/dashboard/students")}
                  className="text-xs"
                >
                  Full Student Roster →
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border border-border/60 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-secondary/40 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border/60">
                      <tr>
                        <th className="py-3 px-4">Student Details</th>
                        <th className="py-3 px-4">Batch / Course</th>
                        <th className="py-3 px-4">Class Attendance</th>
                        <th className="py-3 px-4">CGPA</th>
                        <th className="py-3 px-4">Class Fee Status</th>
                        <th className="py-3 px-4">Assigned Mentor (HOD Sanctioned)</th>
                        <th className="py-3 px-4">AI Risk Telemetry</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {classStudents.map((st) => (
                        <tr key={st.id} className="hover:bg-secondary/20 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className="h-8 w-8 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 flex items-center justify-center font-bold text-xs shrink-0">
                                {st.name.charAt(0)}
                              </div>
                              <div>
                                <span className="font-semibold text-foreground block">{st.name}</span>
                                <span className="font-mono text-[11px] text-muted-foreground">{st.roll_number}</span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">{st.batch}</td>
                          <td className="py-3 px-4">
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-[11px]">
                                <span
                                  className={`font-semibold ${
                                    st.attendance_rate < 75 ? "text-rose-400" : "text-emerald-400"
                                  }`}
                                >
                                  {st.attendance_rate}%
                                </span>
                                {st.attendance_rate < 75 && (
                                  <Badge variant="destructive" className="text-[9px] px-1 py-0 uppercase">
                                    Defaulter
                                  </Badge>
                                )}
                              </div>
                              <div className="w-24 bg-secondary rounded-full h-1.5 overflow-hidden">
                                <div
                                  className={`h-1.5 rounded-full ${
                                    st.attendance_rate < 75 ? "bg-rose-500" : "bg-emerald-500"
                                  }`}
                                  style={{ width: `${st.attendance_rate}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-semibold text-foreground">{st.cgpa}</td>
                          <td className="py-3 px-4">
                            {st.fee_status === "PAID" ? (
                              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px]">
                                <CheckCircle className="h-3 w-3 mr-1" /> Paid
                              </Badge>
                            ) : (
                              <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-[10px]">
                                Pending Due
                              </Badge>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-col">
                              <span className="font-medium text-foreground text-xs flex items-center gap-1.5">
                                <UserCheck className="h-3.5 w-3.5 text-indigo-400" />
                                {st.assigned_mentor}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                Allocated on {st.hod_allocated_date}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5">
                              {st.ai_risk_level === "HIGH" && (
                                <Badge className="bg-rose-500/10 text-rose-400 border-rose-500/30 text-[10px]">
                                  High Risk ({st.ai_risk_score})
                                </Badge>
                              )}
                              {st.ai_risk_level === "MEDIUM" && (
                                <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-[10px]">
                                  Medium ({st.ai_risk_score})
                                </Badge>
                              )}
                              {st.ai_risk_level === "LOW" && (
                                <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px]">
                                  Low Risk ({st.ai_risk_score})
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-7 border-purple-500/30 text-purple-300 hover:bg-purple-500/10"
                              onClick={() => {
                                setRadarStudent({
                                  id: st.id,
                                  roll_number: st.roll_number,
                                  name: st.name,
                                  department: "Computer Science & Engineering",
                                  batch: st.batch,
                                  attendance_rate: st.attendance_rate,
                                  cgpa: st.cgpa,
                                  ai_risk_level: st.ai_risk_level as any,
                                  ai_risk_score: st.ai_risk_score,
                                  key_risk_drivers: [
                                    `Class lecture attendance currently at ${st.attendance_rate}%`,
                                    `Academic performance index: ${st.cgpa} / 10.0 CGPA`,
                                    `Assigned Mentor: ${st.assigned_mentor}`,
                                    st.fee_status === "PENDING"
                                      ? "Tuition fee installment pending for current semester"
                                      : "Semester academic fee dues cleared",
                                  ],
                                  last_seen_zone: "Academic Complex B (Today, 11:30 AM)",
                                  last_counseling_date: "12 Oct 2026",
                                });
                              }}
                            >
                              <Sparkles className="h-3 w-3 mr-1 text-purple-400" />
                              AI Radar
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Visual Separator if in Combined View */}
      {viewMode === "COMBINED" && (
        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-purple-500/30" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-card px-4 py-1 text-xs font-semibold text-purple-400 rounded-full border border-purple-500/40 shadow-md">
              ⬇ Below: Mentor Mode Console (Assigned Cohort & AI Radar) ⬇
            </span>
          </div>
        </div>
      )}

      {/* =========================================================================
          SECTION 2: MENTOR MODE (BELOW)
          View assigned cohort students (assigned by HOD), inspect attendance and
          performance metrics, view academic early-warning AI Radar, and cohort counseling
         ========================================================================= */}
      {(viewMode === "MENTOR" || viewMode === "COMBINED") && (
        <section id="mentor-section" className="space-y-6">
          {/* Mentor Header Banner */}
          <div className="p-6 rounded-2xl bg-gradient-to-r from-purple-950/70 via-slate-900/60 to-indigo-950/60 border border-purple-500/30 backdrop-blur-xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs border-purple-500/40 text-purple-300">
                    🎯 Mentor Mode • Cohort Counseling & AI Early Warning Radar
                  </Badge>
                  <span className="text-xs text-purple-200/70">
                    Assigned by Head of Department (HOD)
                  </span>
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-white mt-1">
                  Mentorship Cohort & Student AI Radar
                </h2>
                <p className="text-sm text-slate-300 mt-0.5">
                  Monitor your assigned students' academic health, early-warning risk radar, attendance defaulter alerts, and log counseling interactions.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="gradient"
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-700"
                  onClick={() => navigate("/dashboard/students")}
                >
                  <Users className="h-4 w-4 mr-2" /> Cohort Directory
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-purple-500/40 text-purple-300 hover:bg-purple-500/10"
                  onClick={() => navigate("/dashboard/analytics")}
                >
                  <Sparkles className="h-4 w-4 mr-2 text-purple-400" /> AI Radar Telemetry
                </Button>
              </div>
            </div>
          </div>

          {/* Mentor Cohort Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="glass-panel-hover border-purple-500/20">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Assigned Cohort
                </CardTitle>
                <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                  <Users className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{mentees.length} Mentees</div>
                <p className="text-xs text-muted-foreground mt-1">CS Dept • Cohort 2026</p>
              </CardContent>
            </Card>

            <Card className="glass-panel-hover border-purple-500/20">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Cohort Attendance Avg
                </CardTitle>
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                  <UserCheck className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">78.4%</div>
                <p className="text-xs text-amber-400 mt-1">1 Student below 75% threshold</p>
              </CardContent>
            </Card>

            <Card className="glass-panel-hover border-purple-500/20">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  AI Early-Warning Radar
                </CardTitle>
                <div className="p-2 rounded-lg bg-red-500/10 text-red-400">
                  <ShieldAlert className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-400">1 High Risk</div>
                <p className="text-xs text-muted-foreground mt-1">1 Medium • 1 Low Risk</p>
              </CardContent>
            </Card>

            <Card className="glass-panel-hover border-purple-500/20">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Counseling Interventions
                </CardTitle>
                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                  <MessageSquare className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">4 Sessions</div>
                <p className="text-xs text-muted-foreground mt-1">This Academic Semester</p>
              </CardContent>
            </Card>
          </div>

          {/* Assigned Students Cohort Table with AI Radar */}
          <Card className="border-purple-500/30 shadow-xl">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/50 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base font-semibold text-foreground">
                    Assigned Cohort Roster & AI Early-Warning Radar
                  </CardTitle>
                  <Badge variant="outline" className="text-[10px] bg-purple-500/10 text-purple-300 border-purple-500/30">
                    HOD Assigned
                  </Badge>
                </div>
                <CardDescription className="text-xs text-muted-foreground mt-0.5">
                  Real-time telemetry on student attendance %, GPA performance, and AI drop-out risk telemetry
                </CardDescription>
              </div>
              <Link to="/dashboard/analytics">
                <Button size="sm" variant="outline" className="text-xs border-purple-500/30 text-purple-300">
                  <Sparkles className="h-3.5 w-3.5 mr-1 text-purple-400" /> Full AI Radar Telemetry
                </Button>
              </Link>
            </CardHeader>

            <CardContent className="pt-4 overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-border/60 text-muted-foreground uppercase text-[10px] tracking-wider">
                    <th className="pb-3 pl-2">Student</th>
                    <th className="pb-3">Roll Number</th>
                    <th className="pb-3">Attendance %</th>
                    <th className="pb-3">Performance (CGPA)</th>
                    <th className="pb-3">AI Early-Warning Radar</th>
                    <th className="pb-3">Last Sighting</th>
                    <th className="pb-3 text-right pr-2">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {mentees.map((st) => (
                    <tr key={st.id} className="hover:bg-secondary/30 transition-colors">
                      {/* Name & Avatar */}
                      <td className="py-3.5 pl-2">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xs">
                            {st.name.charAt(0)}
                          </div>
                          <div>
                            <span className="font-semibold text-foreground block">{st.name}</span>
                            <span className="text-[10px] text-muted-foreground">{st.batch}</span>
                          </div>
                        </div>
                      </td>

                      {/* Roll Number */}
                      <td className="py-3.5 font-mono text-[11px] text-foreground">
                        {st.roll_number}
                      </td>

                      {/* Attendance % */}
                      <td className="py-3.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-semibold ${
                              st.attendance_rate < 75 ? "text-red-400" : "text-emerald-400"
                            }`}
                          >
                            {st.attendance_rate}%
                          </span>
                          {st.attendance_rate < 75 && (
                            <Badge variant="destructive" className="text-[9px] px-1 py-0 uppercase">
                              Defaulter
                            </Badge>
                          )}
                        </div>
                        <div className="w-20 bg-secondary rounded-full h-1 mt-1 overflow-hidden">
                          <div
                            className={`h-1 rounded-full ${
                              st.attendance_rate < 75 ? "bg-red-500" : "bg-emerald-500"
                            }`}
                            style={{ width: `${st.attendance_rate}%` }}
                          />
                        </div>
                      </td>

                      {/* CGPA */}
                      <td className="py-3.5">
                        <div className="flex items-center gap-1 font-semibold text-foreground">
                          <Award className="h-3 w-3 text-amber-400" />
                          <span>{st.cgpa} / 10.0</span>
                        </div>
                      </td>

                      {/* AI Radar */}
                      <td className="py-3.5">
                        <div className="space-y-1">
                          {st.ai_risk_level === "HIGH" && (
                            <Badge className="bg-red-500/20 text-red-300 border-red-500/40 text-[10px] flex items-center gap-1 w-fit">
                              <AlertTriangle className="h-3 w-3 text-red-400" /> High Risk ({st.ai_risk_score}/100)
                            </Badge>
                          )}
                          {st.ai_risk_level === "MEDIUM" && (
                            <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px] flex items-center gap-1 w-fit">
                              <Activity className="h-3 w-3 text-amber-400" /> Moderate Risk ({st.ai_risk_score}/100)
                            </Badge>
                          )}
                          {st.ai_risk_level === "LOW" && (
                            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px] flex items-center gap-1 w-fit">
                              <CheckCircle className="h-3 w-3 text-emerald-400" /> Low Risk ({st.ai_risk_score}/100)
                            </Badge>
                          )}
                          <p className="text-[10px] text-muted-foreground truncate max-w-xs">
                            {st.key_risk_drivers[0]}
                          </p>
                        </div>
                      </td>

                      {/* Last Seen Zone */}
                      <td className="py-3.5 text-[11px] text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Camera className="h-3 w-3 text-indigo-400 shrink-0" />
                          <span className="truncate max-w-[130px]">{st.last_seen_zone}</span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 text-right pr-2">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-[11px] h-7 px-2 border-purple-500/40 text-purple-300 hover:bg-purple-500/10"
                            title="Inspect AI Radar & Telemetry"
                            onClick={() => setRadarStudent(st)}
                          >
                            <Sparkles className="h-3 w-3 mr-1 text-purple-400" /> Radar
                          </Button>
                          <Button
                            size="sm"
                            variant="gradient"
                            className="text-[11px] h-7 px-2.5 bg-purple-600 hover:bg-purple-700"
                            onClick={() => setCounselingStudent(st)}
                          >
                            <MessageSquare className="h-3 w-3 mr-1" /> Counsel
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* AI Early-Warning Radar Explainability & Counseling History */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* AI Early-Warning Radar Signals */}
            <Card className="border-red-500/20 bg-gradient-to-br from-card to-red-950/10">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-red-400" />
                    <CardTitle className="text-sm font-semibold">AI Early-Warning Triggers</CardTitle>
                  </div>
                  <Badge variant="outline" className="text-[10px] border-red-500/40 text-red-400">
                    Non-Punitive Decision Support
                  </Badge>
                </div>
                <CardDescription className="text-xs">
                  Automated detection of academic distress before end-of-term examinations
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-3 rounded-lg border border-red-500/30 bg-red-500/10 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-red-300">Rohan Gupta (2026-CSE-028)</span>
                    <Badge variant="destructive" className="text-[9px]">
                      Action Required
                    </Badge>
                  </div>
                  <ul className="text-[11px] text-red-200/80 space-y-1 list-disc list-inside">
                    <li>3 consecutive absences in core subject (CS301)</li>
                    <li>Attendance rate at 62.5% — Below university threshold (75%)</li>
                    <li>Recommended: Immediate 1-on-1 counseling & remedial sessions</li>
                  </ul>
                </div>

                <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-amber-300">Ananya Sen (2026-CSE-042)</span>
                    <Badge variant="outline" className="text-[9px] border-amber-500/40 text-amber-300">
                      Observation
                    </Badge>
                  </div>
                  <ul className="text-[11px] text-amber-200/80 space-y-1 list-disc list-inside">
                    <li>Assignment submission delayed by 2 days</li>
                    <li>Exam marks remain in top 15% (CGPA 8.9)</li>
                    <li>Recommended: Send submission reminder via student notification</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Recent Cohort Counseling Log */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold">Cohort Counseling Log</CardTitle>
                  <CardDescription>Documented mentorship interventions and follow-up notes</CardDescription>
                </div>
                <Badge variant="secondary" className="text-xs">
                  Active Term
                </Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                {Object.entries(counselingHistory).map(([roll, notes]) => {
                  const student = mentees.find((m) => m.roll_number === roll);
                  return (
                    <div key={roll} className="p-3 rounded-lg border border-border/50 bg-secondary/20 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-foreground">
                          {student?.name || roll} ({roll})
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {notes.length} Logged Note{notes.length > 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="space-y-1 text-[11px] text-slate-300">
                        {notes.map((n, i) => (
                          <p key={i} className="flex items-start gap-1.5 text-muted-foreground">
                            <span className="text-indigo-400 font-bold">•</span>
                            <span>{n}</span>
                          </p>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </section>
      )}

      {/* =========================================================================
          COHORT COUNSELING MODAL
         ========================================================================= */}
      {counselingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-border/80 bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground">
                  Record Mentorship Counseling
                </h3>
                <p className="text-xs text-muted-foreground">
                  Student: {counselingStudent.name} ({counselingStudent.roll_number})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCounselingStudent(null)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            {showCounselingSuccess ? (
              <div className="p-6 text-center space-y-2">
                <CheckCircle className="h-10 w-10 text-emerald-400 mx-auto" />
                <h4 className="text-sm font-bold text-foreground">Counseling Note Saved!</h4>
                <p className="text-xs text-muted-foreground">
                  Intervention recorded in student mentorship audit history.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSaveCounseling} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Intervention Action Type
                  </label>
                  <select
                    value={counselingAction}
                    onChange={(e) => setCounselingAction(e.target.value)}
                    className="w-full bg-secondary/60 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
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
                    <option value="Continued Observation & Camera Tracking">
                      Continued Observation & Camera Tracking
                    </option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Meeting Discussion & Guidance Notes
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={counselingNotes}
                    onChange={(e) => setCounselingNotes(e.target.value)}
                    placeholder="Enter discussion summary, action items for student, exam preparation guidance..."
                    className="w-full bg-secondary/60 border border-border rounded-lg p-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCounselingStudent(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="gradient"
                    size="sm"
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    Save Counseling Log
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          STUDENT AI RADAR & PERFORMANCE MODAL (DIRECT INSPECTION)
         ========================================================================= */}
      {radarStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-2xl rounded-2xl border border-purple-500/40 bg-card p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-border/60 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold text-foreground">
                    {radarStudent.name}
                  </h3>
                  <Badge variant="outline" className="border-purple-500/40 text-purple-300 font-mono text-xs">
                    {radarStudent.roll_number}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-[10px] bg-teal-500/10 text-teal-300 border-teal-500/30">
                    Assigned by HOD (CSE)
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {radarStudent.department} • {radarStudent.batch}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRadarStudent(null)}
                className="text-muted-foreground hover:text-foreground p-1 text-base font-bold"
              >
                ✕
              </button>
            </div>

            {/* 3 Telemetry Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Attendance Card */}
              <div className="p-4 rounded-xl border border-border/60 bg-secondary/20">
                <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-2">
                  <span>Attendance</span>
                  <UserCheck className="h-4 w-4 text-emerald-400" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span
                    className={`text-2xl font-bold ${
                      radarStudent.attendance_rate < 75 ? "text-red-400" : "text-emerald-400"
                    }`}
                  >
                    {radarStudent.attendance_rate}%
                  </span>
                  {radarStudent.attendance_rate < 75 && (
                    <Badge variant="destructive" className="text-[9px] uppercase px-1 py-0">
                      Defaulter
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {radarStudent.attendance_rate >= 75
                    ? "Healthy attendance status"
                    : "Below 75% mandatory threshold"}
                </p>
                <div className="w-full bg-secondary rounded-full h-1.5 mt-2 overflow-hidden">
                  <div
                    className={`h-1.5 rounded-full ${
                      radarStudent.attendance_rate < 75 ? "bg-red-500" : "bg-emerald-500"
                    }`}
                    style={{ width: `${radarStudent.attendance_rate}%` }}
                  />
                </div>
              </div>

              {/* Performance (CGPA) Card */}
              <div className="p-4 rounded-xl border border-border/60 bg-secondary/20">
                <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-2">
                  <span>Performance</span>
                  <Award className="h-4 w-4 text-amber-400" />
                </div>
                <div className="flex items-baseline gap-1 text-2xl font-bold text-foreground">
                  <span>{radarStudent.cgpa}</span>
                  <span className="text-xs text-muted-foreground">/ 10.0 CGPA</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {radarStudent.cgpa >= 8.5
                    ? "Outstanding academic standing"
                    : radarStudent.cgpa >= 7.0
                    ? "Satisfactory performance"
                    : "Needs remedial coursework"}
                </p>
                <div className="w-full bg-secondary rounded-full h-1.5 mt-2 overflow-hidden">
                  <div
                    className="h-1.5 rounded-full bg-amber-500"
                    style={{ width: `${(radarStudent.cgpa / 10) * 100}%` }}
                  />
                </div>
              </div>

              {/* AI Risk Radar Card */}
              <div className="p-4 rounded-xl border border-border/60 bg-secondary/20">
                <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-2">
                  <span>AI Risk Radar</span>
                  <Activity className="h-4 w-4 text-purple-400" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span
                    className={`text-2xl font-bold ${
                      radarStudent.ai_risk_level === "HIGH"
                        ? "text-red-400"
                        : radarStudent.ai_risk_level === "MEDIUM"
                        ? "text-amber-400"
                        : "text-emerald-400"
                    }`}
                  >
                    {radarStudent.ai_risk_score}
                  </span>
                  <span className="text-xs text-muted-foreground">/ 100 Risk</span>
                </div>
                <div className="mt-1">
                  {radarStudent.ai_risk_level === "HIGH" && (
                    <Badge className="bg-red-500/20 text-red-300 border-red-500/40 text-[10px]">
                      High Dropout Risk
                    </Badge>
                  )}
                  {radarStudent.ai_risk_level === "MEDIUM" && (
                    <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px]">
                      Moderate Risk
                    </Badge>
                  )}
                  {radarStudent.ai_risk_level === "LOW" && (
                    <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px]">
                      Low Risk / On Track
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* AI Risk Drivers & Analytics Breakdown */}
            <div className="p-4 rounded-xl border border-purple-500/30 bg-purple-950/20 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                  Explainable AI Radar Signals & Factors
                </h4>
                <Badge variant="outline" className="text-[10px] border-purple-500/30 text-purple-300">
                  Adaptive Predictive Model
                </Badge>
              </div>
              <ul className="space-y-2">
                {radarStudent.key_risk_drivers.map((driver, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 text-xs text-foreground bg-card/60 p-2.5 rounded-lg border border-border/40"
                  >
                    <span className="text-purple-400 font-bold">•</span>
                    <span>{driver}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Campus Last Sighting Telemetry */}
            {radarStudent.last_seen_zone && (
              <div className="p-3.5 rounded-xl border border-border/60 bg-secondary/20 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-indigo-400" />
                  <div>
                    <span className="font-semibold text-foreground">Last Recorded Campus Zone:</span>
                    <span className="text-muted-foreground ml-1">{radarStudent.last_seen_zone}</span>
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px] text-indigo-300 border-indigo-500/30">
                  Telemetry Verified
                </Badge>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/60">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRadarStudent(null)}
              >
                Close
              </Button>
              <Button
                variant="gradient"
                size="sm"
                className="bg-purple-600 hover:bg-purple-700"
                onClick={() => {
                  const student = radarStudent;
                  setRadarStudent(null);
                  setCounselingStudent(student);
                }}
              >
                <MessageSquare className="h-3.5 w-3.5 mr-1" /> Log Counseling Intervention
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 1: MAKE ANNOUNCEMENT TO CLASS STUDENTS
         ========================================================================= */}
      {showAnnouncementModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border border-indigo-500/40 rounded-2xl p-6 w-full max-w-lg shadow-2xl relative space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Megaphone className="h-5 w-5 text-indigo-400" />
                  <h3 className="font-bold text-lg text-foreground">Make Announcement to Students</h3>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Broadcast circular or urgent academic update to all enrolled class students.
                </p>
              </div>
              <button
                onClick={() => setShowAnnouncementModal(false)}
                className="text-muted-foreground hover:text-foreground p-1 text-base font-bold"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!announcementData.title.trim() || !announcementData.content.trim()) return;
                setShowAnnouncementModal(false);
                setAnnouncementData({
                  title: "",
                  content: "",
                  category: "ACADEMIC",
                  target_audience: "STUDENTS_ONLY",
                });
                triggerSuccessToast("Announcement published and broadcast to all 184 class students!");
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="font-semibold block mb-1 text-foreground">Announcement Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Unit 4 Assignment Deadline & Lab Quiz Date"
                  value={announcementData.title}
                  onChange={(e) => setAnnouncementData({ ...announcementData, title: e.target.value })}
                  className="w-full bg-secondary/50 border border-border/80 rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1 text-foreground">Category</label>
                  <select
                    value={announcementData.category}
                    onChange={(e) => setAnnouncementData({ ...announcementData, category: e.target.value })}
                    className="w-full bg-secondary/50 border border-border/80 rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="ACADEMIC">Academic / Coursework</option>
                    <option value="EXAM">Examination Notice</option>
                    <option value="ASSIGNMENT">Assignment Update</option>
                    <option value="URGENT">Urgent Alert</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold block mb-1 text-foreground">Target Recipient</label>
                  <input
                    type="text"
                    disabled
                    value="All My Class Students (184)"
                    className="w-full bg-secondary/30 border border-border/60 rounded-lg px-3 py-2 text-muted-foreground font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold block mb-1 text-foreground">Announcement Content *</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Enter detailed instructions, schedule reminders, or study links..."
                  value={announcementData.content}
                  onChange={(e) => setAnnouncementData({ ...announcementData, content: e.target.value })}
                  className="w-full bg-secondary/50 border border-border/80 rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                />
              </div>

              <div className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-[11px] text-indigo-300 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 shrink-0 text-indigo-400" />
                <span>Notice will appear on the Student Portal & Announcements board instantly.</span>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border/60">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAnnouncementModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  variant="gradient"
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  <Send className="h-3.5 w-3.5 mr-1" /> Broadcast Announcement
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: LEAVE REQUEST ROUTED TO HOD
         ========================================================================= */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border border-amber-500/40 rounded-2xl p-6 w-full max-w-lg shadow-2xl relative space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <CalendarX className="h-5 w-5 text-amber-400" />
                  <h3 className="font-bold text-lg text-foreground">Apply for Faculty Leave</h3>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Faculty leave applications are officially submitted to the Head of Department for review.
                </p>
              </div>
              <button
                onClick={() => setShowLeaveModal(false)}
                className="text-muted-foreground hover:text-foreground p-1 text-base font-bold"
              >
                ✕
              </button>
            </div>

            {/* HOD Routing Banner */}
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold text-xs shrink-0">
                  HOD
                </div>
                <div>
                  <span className="font-semibold text-amber-200 block">
                    Approving Authority: Dr. Aruna Sundaram
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Head of Department • Computer Science & Engineering
                  </span>
                </div>
              </div>
              <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-300">
                Direct Routing
              </Badge>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!leaveData.from_date || !leaveData.to_date || !leaveData.reason.trim()) return;
                setShowLeaveModal(false);
                setLeaveData({
                  leave_type: "CASUAL",
                  from_date: "",
                  to_date: "",
                  reason: "",
                });
                triggerSuccessToast("Leave request submitted and routed to HOD (Dr. Aruna Sundaram) for approval!");
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="font-semibold block mb-1 text-foreground">Leave Type</label>
                <select
                  value={leaveData.leave_type}
                  onChange={(e) => setLeaveData({ ...leaveData, leave_type: e.target.value })}
                  className="w-full bg-secondary/50 border border-border/80 rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="CASUAL">Casual Leave (CL) - Balance: 8 Days</option>
                  <option value="MEDICAL">Medical / Sick Leave (ML) - Balance: 10 Days</option>
                  <option value="ON_DUTY">On Duty (OD) / Academic Conference</option>
                  <option value="EARNED">Earned Leave (EL)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1 text-foreground">From Date *</label>
                  <input
                    type="date"
                    required
                    value={leaveData.from_date}
                    onChange={(e) => setLeaveData({ ...leaveData, from_date: e.target.value })}
                    className="w-full bg-secondary/50 border border-border/80 rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1 text-foreground">To Date *</label>
                  <input
                    type="date"
                    required
                    value={leaveData.to_date}
                    onChange={(e) => setLeaveData({ ...leaveData, to_date: e.target.value })}
                    className="w-full bg-secondary/50 border border-border/80 rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold block mb-1 text-foreground">Substitute Faculty Arrangement</label>
                <input
                  type="text"
                  placeholder="e.g. Prof. Anil Verma (handling CS301 Data Structures lecture)"
                  defaultValue="Prof. Anil Verma (Confirmed)"
                  className="w-full bg-secondary/50 border border-border/80 rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1 text-foreground">Reason for Leave *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Specify reason for leave application..."
                  value={leaveData.reason}
                  onChange={(e) => setLeaveData({ ...leaveData, reason: e.target.value })}
                  className="w-full bg-secondary/50 border border-border/80 rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border/60">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowLeaveModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                >
                  Submit to HOD
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 3: UPLOAD NOTES FOR STUDENTS TO DOWNLOAD
         ========================================================================= */}
      {showUploadNotesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border border-blue-500/40 rounded-2xl p-6 w-full max-w-lg shadow-2xl relative space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <UploadCloud className="h-5 w-5 text-blue-400" />
                  <h3 className="font-bold text-lg text-foreground">Upload Notes for Students</h3>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Upload lecture notes and courseware so students can view and download them from Documents.
                </p>
              </div>
              <button
                onClick={() => setShowUploadNotesModal(false)}
                className="text-muted-foreground hover:text-foreground p-1 text-base font-bold"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!notesData.title.trim()) return;
                setShowUploadNotesModal(false);
                const uploadedTitle = notesData.title;
                setNotesData({
                  title: "",
                  subject: "CS301 - Data Structures & Algorithms",
                  description: "",
                  file_name: "lecture_unit_4_binary_trees.pdf",
                });
                triggerSuccessToast(`Lecture notes "${uploadedTitle}" uploaded! Students can now download it.`);
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="font-semibold block mb-1 text-foreground">Subject / Course *</label>
                <select
                  value={notesData.subject}
                  onChange={(e) => setNotesData({ ...notesData, subject: e.target.value })}
                  className="w-full bg-secondary/50 border border-border/80 rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="CS301 - Data Structures & Algorithms">CS301 - Data Structures & Algorithms</option>
                  <option value="CS302 - Advanced Python Programming">CS302 - Advanced Python Programming</option>
                  <option value="CS204 - Discrete Mathematics">CS204 - Discrete Mathematics</option>
                </select>
              </div>

              <div>
                <label className="font-semibold block mb-1 text-foreground">Note Title / Topic *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Unit 4: Balanced Binary Search Trees & AVL Rotations"
                  value={notesData.title}
                  onChange={(e) => setNotesData({ ...notesData, title: e.target.value })}
                  className="w-full bg-secondary/50 border border-border/80 rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1 text-foreground">Overview / Topics Included</label>
                <textarea
                  rows={2}
                  placeholder="Key algorithms, pseudo-code formulas, and practice problems covered..."
                  value={notesData.description}
                  onChange={(e) => setNotesData({ ...notesData, description: e.target.value })}
                  className="w-full bg-secondary/50 border border-border/80 rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1 text-foreground">File Attachment (PDF / Document)</label>
                <div className="p-3 border-2 border-dashed border-border/80 rounded-xl bg-secondary/20 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-blue-400" />
                    <div>
                      <span className="font-semibold text-foreground block font-mono text-[11px]">
                        {notesData.file_name}
                      </span>
                      <span className="text-[10px] text-muted-foreground">PDF Document • 3.4 MB • Ready to distribute</span>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] border-blue-500/40 text-blue-300">
                    Selected
                  </Badge>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-300 flex items-center gap-2">
                <Download className="h-4 w-4 shrink-0 text-blue-400" />
                <span>Enrolled students can download this file from their student Documents page.</span>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border/60">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowUploadNotesModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <UploadCloud className="h-3.5 w-3.5 mr-1" /> Publish for Students
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Success Action Toast */}
      {actionSuccessToast && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-xl bg-emerald-950/90 border border-emerald-500/40 text-emerald-200 shadow-2xl backdrop-blur-md flex items-center gap-3 animate-in fade-in slide-in-from-bottom-3 duration-300">
          <div className="h-8 w-8 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center shrink-0">
            <CheckCircle className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs font-semibold text-white">Action Completed</p>
            <p className="text-xs text-emerald-300">{actionSuccessToast}</p>
          </div>
        </div>
      )}
    </div>
  );
}
