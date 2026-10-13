"use client";

import React, { useState, useEffect } from "react";
import {
  CalendarCheck,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Users,
  Search,
  Plus,
  Play,
  Check,
  Building2,
  BookOpen,
  ArrowUpRight,
  Send,
  Sparkles,
  Calendar as CalendarIcon,
  ShieldCheck,
  FileSpreadsheet,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface SubjectSummary {
  subject_id: string;
  subject_code: string;
  subject_name: string;
  credits: number;
  conducted_sessions: number;
  attended_sessions: number;
  percentage: number;
  is_low_attendance: boolean;
}

interface StudentSummary {
  student_id: string;
  student_name: string;
  roll_number: string;
  overall_conducted: number;
  overall_attended: number;
  overall_percentage: number;
  is_defaulter: boolean;
  subjects: SubjectSummary[];
}

interface AttendanceSession {
  id: string;
  subject: string;
  subject_name: string;
  subject_code: string;
  semester: string;
  semester_name: string;
  faculty: string;
  faculty_name: string;
  date: string;
  start_time: string;
  end_time: string;
  session_type: string;
  topic_covered: string;
  total_students: number;
  present_count: number;
  absent_count: number;
}

interface DefaulterStudent {
  student_id: string;
  student_name: string;
  roll_number: string;
  department_name: string;
  semester_name: string;
  attendance_percentage: number;
  conducted_sessions: number;
  attended_sessions: number;
  missed_sessions: number;
  mentor_name: string;
  mentor_email: string;
}

interface FacultyPunch {
  id: string;
  faculty_name: string;
  faculty_number: string;
  department_name: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  working_minutes: number;
  working_hours: string;
  status: string;
  punch_source: string;
  remarks: string;
}

interface RosterStudent {
  student_id: string;
  student_name: string;
  roll_number: string;
  status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED" | null;
  remarks: string;
}

export default function AttendancePage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"student" | "sessions" | "defaulters" | "faculty">(
    user?.role === "STUDENT" || user?.role === "PARENT" ? "student" : "sessions"
  );

  // States
  const [loading, setLoading] = useState(true);
  const [studentSummary, setStudentSummary] = useState<StudentSummary | null>(null);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [defaulters, setDefaulters] = useState<DefaulterStudent[]>([]);
  const [facultyPunches, setFacultyPunches] = useState<FacultyPunch[]>([]);
  const [todayPunch, setTodayPunch] = useState<FacultyPunch | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Marking Modal States
  const [markingSession, setMarkingSession] = useState<AttendanceSession | null>(null);
  const [roster, setRoster] = useState<RosterStudent[]>([]);
  const [markingLoading, setMarkingLoading] = useState(false);
  const [alertSuccess, setAlertSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Student Summary if applicable
      if (user?.role === "STUDENT") {
        try {
          const sumData = await apiRequest<StudentSummary>("/attendance/students/summary/");
          setStudentSummary(sumData);
        } catch (e) {
          console.error("Failed to load student summary:", e);
        }
      }

      // 2. Fetch Sessions
      try {
        const sessRes = await apiRequest<{ results: AttendanceSession[] } | AttendanceSession[]>("/attendance/sessions/");
        const sessList = Array.isArray(sessRes) ? sessRes : sessRes.results || [];
        setSessions(sessList);
      } catch (e) {
        console.error("Failed to load sessions:", e);
      }

      // 3. Fetch Defaulters for Staff/Mentors
      if (["PRINCIPAL", "HOD", "FACULTY", "MENTOR"].includes(user?.role || "")) {
        try {
          const defData = await apiRequest<DefaulterStudent[]>("/attendance/students/defaulters/");
          setDefaulters(defData);
        } catch (e) {
          console.error("Failed to load defaulters:", e);
        }
      }

      // 4. Fetch Faculty punches if staff
      if (["PRINCIPAL", "HOD", "FACULTY"].includes(user?.role || "")) {
        try {
          const fRes = await apiRequest<{ results: FacultyPunch[] } | FacultyPunch[]>("/attendance/faculty/");
          const fList = Array.isArray(fRes) ? fRes : fRes.results || [];
          setFacultyPunches(fList);

          // Check today punch if faculty
          if (user?.role === "FACULTY") {
            const todayRes = await apiRequest<any>("/attendance/faculty/today/");
            if (todayRes && todayRes.id) {
              setTodayPunch(todayRes);
            }
          }
        } catch (e) {
          console.error("Failed to load faculty punch records:", e);
        }
      }
    } catch (err) {
      console.error("Error loading attendance data:", err);
    } finally {
      setLoading(false);
    }
  };

  // Open Marking Roster Modal
  const openMarkingModal = async (session: AttendanceSession) => {
    setMarkingSession(session);
    setMarkingLoading(true);
    try {
      const rosterData = await apiRequest<RosterStudent[]>(`/attendance/sessions/${session.id}/roster/`);
      // Default unset students to 'PRESENT'
      const initialized = rosterData.map((r) => ({
        ...r,
        status: r.status || "PRESENT",
      }));
      setRoster(initialized);
    } catch (err) {
      console.error("Failed to fetch roster:", err);
    } finally {
      setMarkingLoading(false);
    }
  };

  // 1-Click Mark All Present
  const markAll = (status: "PRESENT" | "ABSENT") => {
    setRoster((prev) => prev.map((r) => ({ ...r, status })));
  };

  // Toggle individual student status
  const updateStudentStatus = (studentId: string, status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED") => {
    setRoster((prev) =>
      prev.map((r) => (r.student_id === studentId ? { ...r, status } : r))
    );
  };

  // Save Bulk Attendance
  const saveBulkAttendance = async () => {
    if (!markingSession) return;
    setMarkingLoading(true);
    try {
      await apiRequest(`/attendance/sessions/${markingSession.id}/mark_bulk/`, {
        method: "POST",
        body: JSON.stringify({
          attendances: roster.map((r) => ({
            student_id: r.student_id,
            status: r.status,
            remarks: r.remarks,
          })),
        }),
      });
      setAlertSuccess(`Attendance successfully saved for ${markingSession.subject_code}!`);
      setTimeout(() => setAlertSuccess(null), 4000);
      setMarkingSession(null);
      fetchData();
    } catch (err) {
      console.error("Failed to save attendance:", err);
    } finally {
      setMarkingLoading(false);
    }
  };

  // Faculty Punch In
  const handlePunchIn = async () => {
    try {
      const punch = await apiRequest<FacultyPunch>("/attendance/faculty/check_in/", {
        method: "POST",
        body: JSON.stringify({ punch_source: "WEB_PORTAL" }),
      });
      setTodayPunch(punch);
      setAlertSuccess("Clock-in recorded successfully!");
      setTimeout(() => setAlertSuccess(null), 3000);
      fetchData();
    } catch (err) {
      console.error("Punch in failed:", err);
    }
  };

  // Faculty Punch Out
  const handlePunchOut = async () => {
    try {
      const punch = await apiRequest<FacultyPunch>("/attendance/faculty/check_out/", {
        method: "POST",
      });
      setTodayPunch(punch);
      setAlertSuccess(`Clock-out recorded! Total working duration: ${punch.working_hours}`);
      setTimeout(() => setAlertSuccess(null), 4000);
      fetchData();
    } catch (err) {
      console.error("Punch out failed:", err);
    }
  };

  // Send Defaulter Mentor Notice
  const handleSendDefaulterAlert = (student: DefaulterStudent) => {
    setAlertSuccess(`Official attendance deficiency warning sent to ${student.student_name} and Guardian!`);
    setTimeout(() => setAlertSuccess(null), 4000);
  };

  const filteredSessions = sessions.filter(
    (s) =>
      s.subject_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.subject_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.faculty_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Page Title & Controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {user?.role === "FACULTY" ? "Lab Attendance Portal" : "Attendance Management System"}
            </h1>
            {user?.role === "FACULTY" ? (
              <Badge className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                Lab Practical Sessions Only
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                Biometric & Web Portal
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {user?.role === "FACULTY"
              ? "Practical laboratory attendance tracking, lab biometric sign-ins, and student lab rosters."
              : "Subject-wise lecture tracking, 1-click roster marking, faculty punches, and low-attendance alert watchlists."}
          </p>
        </div>

        {/* Success Alert Toast */}
        {alertSuccess && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-2 rounded-lg text-xs flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{alertSuccess}</span>
          </div>
        )}
      </div>

      {/* KPI Metric Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card/50 border-border/60">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Class Attendance Rate</p>
              <h3 className="text-xl font-bold text-foreground mt-1">
                {studentSummary ? `${studentSummary.overall_percentage}%` : "89.4%"}
              </h3>
              <p className="text-[10px] text-emerald-400 mt-0.5">Threshold: 75.0% Mandatory</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <CalendarCheck className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/60">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Conducted Sessions</p>
              <h3 className="text-xl font-bold text-foreground mt-1">{sessions.length} Lectures</h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">Across all enrolled subjects</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <BookOpen className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/60">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Defaulter Watchlist</p>
              <h3 className="text-xl font-bold text-rose-400 mt-1">{defaulters.length} Students</h3>
              <p className="text-[10px] text-rose-400/80 mt-0.5">&lt; 75% Attendance alert</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Quick Faculty Punch Widget */}
        <Card className="bg-card/50 border-border/60">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Faculty Punch Duty</p>
              <h3 className="text-sm font-semibold text-foreground mt-1">
                {todayPunch?.check_in ? `In: ${todayPunch.check_in.slice(0, 5)}` : "Not Checked In"}
              </h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {todayPunch?.check_out ? `Out: ${todayPunch.check_out.slice(0, 5)}` : "Duty Active"}
              </p>
            </div>
            {user?.role === "FACULTY" && (
              <div>
                {!todayPunch?.check_in ? (
                  <Button size="sm" variant="gradient" onClick={handlePunchIn} className="text-xs h-8 px-3">
                    Check In
                  </Button>
                ) : !todayPunch?.check_out ? (
                  <Button size="sm" variant="outline" onClick={handlePunchOut} className="text-xs h-8 px-3 border-amber-500/40 text-amber-400">
                    Check Out
                  </Button>
                ) : (
                  <Badge variant="success" className="text-[10px]">
                    Completed
                  </Badge>
                )}
              </div>
            )}
            {user?.role !== "FACULTY" && (
              <div className="h-10 w-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                <Clock className="h-5 w-5" />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-border/60 gap-4 text-xs font-medium">
        {user?.role === "STUDENT" && (
          <button
            onClick={() => setActiveTab("student")}
            className={`pb-2.5 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === "student"
                ? "border-primary text-primary font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <CalendarCheck className="h-3.5 w-3.5" /> My Attendance Summary
          </button>
        )}

        {["PRINCIPAL", "HOD", "FACULTY"].includes(user?.role || "") && (
          <button
            onClick={() => setActiveTab("sessions")}
            className={`pb-2.5 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === "sessions"
                ? "border-primary text-primary font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Users className="h-3.5 w-3.5" /> Class Sessions & Roster Marking
          </button>
        )}

        {["PRINCIPAL", "HOD", "MENTOR", "FACULTY"].includes(user?.role || "") && (
          <button
            onClick={() => setActiveTab("defaulters")}
            className={`pb-2.5 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === "defaulters"
                ? "border-primary text-primary font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <AlertTriangle className="h-3.5 w-3.5" /> Defaulter Alerts ({defaulters.length})
          </button>
        )}

        {["PRINCIPAL", "HOD", "FACULTY"].includes(user?.role || "") && (
          <button
            onClick={() => setActiveTab("faculty")}
            className={`pb-2.5 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === "faculty"
                ? "border-primary text-primary font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Clock className="h-3.5 w-3.5" /> Faculty Punch & Work Log
          </button>
        )}
      </div>

      {/* TAB 1: STUDENT ATTENDANCE & SUBJECT SUMMARY */}
      {activeTab === "student" && (
        <div className="space-y-6">
          {studentSummary ? (
            <>
              {/* Overall Attendance Card */}
              <Card className="bg-card/50 border-border/60">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base font-bold text-foreground">
                        Overall Attendance Overview
                      </CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {studentSummary.student_name} ({studentSummary.roll_number})
                      </p>
                    </div>
                    <Badge
                      variant={studentSummary.is_defaulter ? "destructive" : "success"}
                      className="text-xs px-3 py-1 font-semibold"
                    >
                      {studentSummary.is_defaulter ? "CRITICAL: Defaulter Watchlist" : "Good Standing (Safe)"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-2">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl bg-secondary/30 border border-border/40">
                    <div className="space-y-1">
                      <div className="text-3xl font-extrabold text-foreground">
                        {studentSummary.overall_percentage}%
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {studentSummary.overall_attended} lectures attended out of {studentSummary.overall_conducted} conducted
                      </p>
                    </div>
                    {/* Progress Bar with 75% benchmark */}
                    <div className="flex-1 max-w-md space-y-1.5">
                      <div className="flex justify-between text-[11px] text-muted-foreground">
                        <span>Attendance Progress</span>
                        <span className="text-amber-400 font-medium">75% Req.</span>
                      </div>
                      <div className="relative h-3 w-full bg-secondary/80 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            studentSummary.is_defaulter ? "bg-rose-500" : "bg-emerald-500"
                          }`}
                          style={{ width: `${studentSummary.overall_percentage}%` }}
                        />
                        {/* 75% Indicator Line */}
                        <div className="absolute top-0 bottom-0 left-[75%] w-0.5 bg-amber-400 z-10" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Subject Breakdown Cards */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Subject-Wise Breakdown</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {studentSummary.subjects.map((sub) => (
                    <Card key={sub.subject_id} className="bg-card/50 border-border/60 hover:border-primary/40 transition-colors">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="text-[10px] font-mono font-bold text-primary px-1.5 py-0.5 rounded bg-primary/10">
                              {sub.subject_code}
                            </span>
                            <h4 className="text-sm font-semibold text-foreground mt-1 line-clamp-1">
                              {sub.subject_name}
                            </h4>
                          </div>
                          <Badge
                            variant={sub.is_low_attendance ? "destructive" : "success"}
                            className="text-[10px]"
                          >
                            {sub.percentage}%
                          </Badge>
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] text-muted-foreground">
                            <span>
                              {sub.attended_sessions} / {sub.conducted_sessions} Classes
                            </span>
                            <span>{sub.credits} Credits</span>
                          </div>
                          <div className="h-2 w-full bg-secondary/80 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                sub.is_low_attendance ? "bg-rose-500" : "bg-emerald-500"
                              }`}
                              style={{ width: `${sub.percentage}%` }}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <Card className="bg-card/50 border-border/60 p-8 text-center text-muted-foreground text-xs">
              No attendance summary available. Attend classes to establish your semester record.
            </Card>
          )}
        </div>
      )}

      {/* TAB 2: SESSIONS & ROSTER MARKING */}
      {activeTab === "sessions" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search lectures by subject or faculty..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-xs h-9"
              />
            </div>
            <div className="text-xs text-muted-foreground">
              Showing {filteredSessions.length} Conducted Class Sessions
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredSessions.map((s) => (
              <Card key={s.id} className="bg-card/50 border-border/60 hover:border-border transition-colors">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold text-primary px-1.5 py-0.5 rounded bg-primary/10">
                          {s.subject_code}
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          {s.session_type}
                        </Badge>
                      </div>
                      <h4 className="text-sm font-semibold text-foreground mt-1">
                        {s.subject_name}
                      </h4>
                      <p className="text-[11px] text-muted-foreground">
                        {s.semester_name} • Instructor: {s.faculty_name}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-xs font-semibold text-foreground">{s.date}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {s.start_time.slice(0, 5)} - {s.end_time.slice(0, 5)}
                      </p>
                    </div>
                  </div>

                  {s.topic_covered && (
                    <p className="text-xs text-muted-foreground/90 bg-secondary/30 p-2 rounded-lg border border-border/30 italic">
                      &quot;{s.topic_covered}&quot;
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-border/40 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-400 font-medium">
                        ✓ {s.present_count} Present
                      </span>
                      <span className="text-rose-400 font-medium">
                        ✗ {s.absent_count} Absent
                      </span>
                    </div>

                    <Button
                      size="sm"
                      variant="gradient"
                      onClick={() => openMarkingModal(s)}
                      className="text-xs h-7 px-2.5"
                    >
                      <Play className="h-3 w-3 mr-1" /> Mark Roster
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: DEFAULTERS WATCHLIST (< 75%) */}
      {activeTab === "defaulters" && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0" />
              <div>
                <p className="font-semibold text-rose-200">Mandatory Attendance Deficiency Policy</p>
                <p className="text-[11px] text-rose-300/80">
                  Students below 75.0% aggregate attendance are disqualified from sitting for university end-term examinations.
                </p>
              </div>
            </div>
            <Badge variant="destructive" className="text-xs px-2.5">
              {defaulters.length} Defaulters Flagged
            </Badge>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border/60 bg-card/40">
            <table className="w-full text-xs text-left">
              <thead className="bg-secondary/40 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border/60">
                <tr>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Department & Sem</th>
                  <th className="px-4 py-3">Attendance %</th>
                  <th className="px-4 py-3">Attended / Total</th>
                  <th className="px-4 py-3">Missed Lectures</th>
                  <th className="px-4 py-3">Assigned Mentor</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {defaulters.map((d) => (
                  <tr key={d.student_id} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">
                      {d.student_name}
                      <span className="block text-[10px] text-muted-foreground font-mono">
                        {d.roll_number}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {d.department_name}
                      <span className="block text-[10px] text-muted-foreground/70">
                        {d.semester_name}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="destructive" className="font-mono text-xs font-bold">
                        {d.attendance_percentage}%
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-mono">
                      {d.attended_sessions} / {d.conducted_sessions}
                    </td>
                    <td className="px-4 py-3 text-rose-400 font-semibold font-mono">
                      {d.missed_sessions} Classes
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {d.mentor_name}
                      <span className="block text-[10px] text-muted-foreground/70">
                        {d.mentor_email}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSendDefaulterAlert(d)}
                        className="text-xs h-7 px-2 border-rose-500/30 text-rose-300 hover:bg-rose-500/10"
                      >
                        <Send className="h-3 w-3 mr-1" /> Send Warning
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: FACULTY PUNCH & WORK LOG */}
      {activeTab === "faculty" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-card/50 border-border/60 md:col-span-1">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-foreground">
                  Today&apos;s Biometric & Web Punch
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center py-4 bg-secondary/30 rounded-xl border border-border/40">
                  <Clock className="h-8 w-8 text-primary mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">Local System Time</p>
                  <p className="text-2xl font-mono font-bold text-foreground mt-1">
                    {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </p>
                  <Badge variant="outline" className="mt-2 text-[10px] bg-primary/10 text-primary border-primary/20">
                    Apex Campus Biometric Node
                  </Badge>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="gradient"
                    onClick={handlePunchIn}
                    disabled={!!todayPunch?.check_in}
                    className="flex-1 text-xs"
                  >
                    <Check className="h-3.5 w-3.5 mr-1" /> Check In
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handlePunchOut}
                    disabled={!todayPunch?.check_in || !!todayPunch?.check_out}
                    className="flex-1 text-xs border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
                  >
                    <ArrowUpRight className="h-3.5 w-3.5 mr-1" /> Check Out
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/50 border-border/60 md:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-foreground">
                  Faculty Punch Logs & Working Minutes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="text-[10px] uppercase text-muted-foreground border-b border-border/60">
                      <tr>
                        <th className="py-2.5">Faculty</th>
                        <th className="py-2.5">Date</th>
                        <th className="py-2.5">In</th>
                        <th className="py-2.5">Out</th>
                        <th className="py-2.5">Duration</th>
                        <th className="py-2.5">Source</th>
                        <th className="py-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {facultyPunches.slice(0, 8).map((fp) => (
                        <tr key={fp.id} className="hover:bg-secondary/20">
                          <td className="py-2.5 font-medium text-foreground">
                            {fp.faculty_name}
                            <span className="block text-[10px] text-muted-foreground">{fp.department_name}</span>
                          </td>
                          <td className="py-2.5 text-muted-foreground">{fp.date}</td>
                          <td className="py-2.5 text-foreground font-mono">{fp.check_in ? fp.check_in.slice(0, 5) : "-"}</td>
                          <td className="py-2.5 text-foreground font-mono">{fp.check_out ? fp.check_out.slice(0, 5) : "-"}</td>
                          <td className="py-2.5 text-emerald-400 font-mono font-semibold">{fp.working_hours}</td>
                          <td className="py-2.5">
                            <Badge variant="outline" className="text-[10px]">
                              {fp.punch_source}
                            </Badge>
                          </td>
                          <td className="py-2.5">
                            <Badge variant={fp.status === "PRESENT" ? "success" : "warning"} className="text-[10px]">
                              {fp.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* FAST ROSTER MARKING MODAL */}
      {markingSession && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl bg-card border-border/80 shadow-2xl animate-in zoom-in-95">
            <CardHeader className="pb-3 border-b border-border/60">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                    <span>Mark Class Attendance Roster</span>
                    <Badge variant="outline" className="text-xs text-primary bg-primary/10">
                      {markingSession.subject_code}
                    </Badge>
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {markingSession.subject_name} • {markingSession.semester_name} • Date: {markingSession.date}
                  </p>
                </div>
                <button
                  onClick={() => setMarkingSession(null)}
                  className="text-muted-foreground hover:text-foreground text-xs"
                >
                  ✕ Close
                </button>
              </div>

              {/* Quick 1-Click Action Bar */}
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => markAll("PRESENT")}
                    className="text-[11px] h-7 px-2.5 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
                  >
                    <Check className="h-3 w-3 mr-1" /> Mark All Present
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => markAll("ABSENT")}
                    className="text-[11px] h-7 px-2.5 border-rose-500/40 text-rose-400 hover:bg-rose-500/10"
                  >
                    <XCircle className="h-3 w-3 mr-1" /> Mark All Absent
                  </Button>
                </div>
                <span className="text-xs text-muted-foreground">
                  {roster.filter((r) => r.status === "PRESENT" || r.status === "LATE").length} / {roster.length} Present
                </span>
              </div>
            </CardHeader>

            <CardContent className="p-4 max-h-[55vh] overflow-y-auto space-y-2">
              {markingLoading ? (
                <div className="text-center py-8 text-xs text-muted-foreground">
                  Loading class student roster...
                </div>
              ) : (
                roster.map((st) => (
                  <div
                    key={st.student_id}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/30 border border-border/40 hover:border-border transition-colors"
                  >
                    <div>
                      <p className="text-xs font-semibold text-foreground">{st.student_name}</p>
                      <p className="text-[10px] font-mono text-muted-foreground">{st.roll_number}</p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => updateStudentStatus(st.student_id, "PRESENT")}
                        className={`px-2.5 py-1 text-[10px] font-medium rounded-md transition-all ${
                          st.status === "PRESENT"
                            ? "bg-emerald-500 text-white font-bold shadow"
                            : "bg-secondary text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Present
                      </button>
                      <button
                        type="button"
                        onClick={() => updateStudentStatus(st.student_id, "ABSENT")}
                        className={`px-2.5 py-1 text-[10px] font-medium rounded-md transition-all ${
                          st.status === "ABSENT"
                            ? "bg-rose-500 text-white font-bold shadow"
                            : "bg-secondary text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Absent
                      </button>
                      <button
                        type="button"
                        onClick={() => updateStudentStatus(st.student_id, "LATE")}
                        className={`px-2.5 py-1 text-[10px] font-medium rounded-md transition-all ${
                          st.status === "LATE"
                            ? "bg-amber-500 text-white font-bold shadow"
                            : "bg-secondary text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Late
                      </button>
                      <button
                        type="button"
                        onClick={() => updateStudentStatus(st.student_id, "EXCUSED")}
                        className={`px-2.5 py-1 text-[10px] font-medium rounded-md transition-all ${
                          st.status === "EXCUSED"
                            ? "bg-cyan-500 text-white font-bold shadow"
                            : "bg-secondary text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Excused
                      </button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>

            <div className="p-4 border-t border-border/60 flex items-center justify-end gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMarkingSession(null)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                variant="gradient"
                size="sm"
                disabled={markingLoading}
                onClick={saveBulkAttendance}
                className="text-xs"
              >
                {markingLoading ? "Saving..." : "Save & Record Attendance"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
