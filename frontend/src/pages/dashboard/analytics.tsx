"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/api";
import {
  BarChart3,
  TrendingUp,
  AlertTriangle,
  ShieldAlert,
  Sparkles,
  Users,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  RefreshCw,
  Eye,
  MessageSquare,
  FileText,
  DollarSign,
  GraduationCap,
  ChevronRight,
  Info,
  Calendar,
  AlertCircle,
  Award,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  BrainCircuit,
  SlidersHorizontal,
  X
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface OverviewMetrics {
  total_students: number;
  total_faculty: number;
  total_departments: number;
  overall_attendance_percentage: number;
  financials: {
    total_invoiced: string;
    total_collected: string;
    total_pending: string;
    collection_percentage: number;
  };
  early_warning_summary: {
    total_evaluated: number;
    critical_risk: number;
    high_risk: number;
    medium_risk: number;
    low_risk: number;
    action_required_count: number;
  };
}

interface AIRiskRecord {
  id: string;
  student: string;
  student_name: string;
  student_number: string;
  roll_number: string;
  department_name: string;
  course_name: string;
  batch_name: string;
  semester_number: number;
  risk_level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  score: string;
  attendance_rate: number;
  missing_assignments_count: number;
  average_marks_percentage: number;
  leave_days_count: number;
  key_risk_drivers: string[];
  suggested_interventions: string[];
  calculated_at: string;
  is_latest: boolean;
  reviewed_by: string | null;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  review_action_taken: string;
}

interface AttendanceDepartment {
  department_id: string;
  name: string;
  code: string;
  student_count: number;
  total_sessions_recorded: number;
  attendance_rate: number;
}

interface DefaulterStudent {
  student_id: string;
  student_number: string;
  roll_number: string;
  name: string;
  department: string | null;
  attendance_percentage: number;
  sessions_attended: string;
}

interface FinanceReportData {
  total_billed: string;
  total_collected: string;
  total_outstanding: string;
  payment_methods: {
    method: string;
    amount: string;
    count: number;
  }[];
  invoice_counts: {
    paid: number;
    partially_paid: number;
    pending: number;
    overdue: number;
  };
}

interface AcademicReportData {
  overall_performance: {
    total_results: number;
    pass_count: number;
    fail_count: number;
    pass_percentage: number;
  };
  grade_distribution: {
    grade: string;
    count: number;
  }[];
  top_scoring_subjects: {
    name: string;
    code: string;
    avg_marks: number;
  }[];
}

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"radar" | "attendance" | "finance" | "academics">("radar");
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Data states
  const [overview, setOverview] = useState<OverviewMetrics | null>(null);
  const [riskList, setRiskList] = useState<AIRiskRecord[]>([]);
  const [attendanceData, setAttendanceData] = useState<{
    department_breakdown: AttendanceDepartment[];
    defaulters_count: number;
    defaulters: DefaulterStudent[];
  } | null>(null);
  const [financeData, setFinanceData] = useState<FinanceReportData | null>(null);
  const [academicData, setAcademicData] = useState<AcademicReportData | null>(null);

  // Filters for AI Radar
  const [riskFilter, setRiskFilter] = useState<"ALL" | "CRITICAL" | "HIGH" | "MEDIUM" | "LOW">("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Review Modal State
  const [selectedRecord, setSelectedRecord] = useState<AIRiskRecord | null>(null);
  const [reviewAction, setReviewAction] = useState<string>("COUNSELING_SCHEDULED");
  const [reviewNotes, setReviewNotes] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [overviewRes, riskRes, attRes, finRes, acadRes] = await Promise.all([
        apiRequest<{ data: OverviewMetrics }>("/api/v1/analytics/overview/"),
        apiRequest<{ results?: AIRiskRecord[]; data?: AIRiskRecord[] }>("/api/v1/analytics/ai-risk/"),
        apiRequest<{ data: { department_breakdown: AttendanceDepartment[]; defaulters_count: number; defaulters: DefaulterStudent[] } }>("/api/v1/analytics/attendance-report/"),
        apiRequest<{ data: FinanceReportData }>("/api/v1/analytics/finance-report/"),
        apiRequest<{ data: AcademicReportData }>("/api/v1/analytics/academic-report/"),
      ]);

      if (overviewRes && (overviewRes.data || overviewRes)) {
        setOverview(overviewRes.data || (overviewRes as unknown as OverviewMetrics));
      }

      if (riskRes) {
        const records = riskRes.results || riskRes.data || (Array.isArray(riskRes) ? riskRes : []);
        setRiskList(records);
      }

      if (attRes && (attRes.data || attRes)) {
        setAttendanceData(attRes.data || attRes);
      }

      if (finRes && (finRes.data || finRes)) {
        setFinanceData(finRes.data || finRes);
      }

      if (acadRes && (acadRes.data || acadRes)) {
        setAcademicData(acadRes.data || acadRes);
      }
    } catch (err: unknown) {
      console.error("Failed to load analytics data", err);
      setNotification({
        type: "error",
        message: "Failed to load comprehensive analytics data. Ensure your session is valid.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRunEvaluation = async () => {
    setEvaluating(true);
    try {
      const res = await apiRequest<{ success: boolean; data: { evaluated_count: number } }>(
        "/api/v1/analytics/ai-risk/evaluate_all/",
        { method: "POST" }
      );
      setNotification({
        type: "success",
        message: `Evaluation completed successfully. Processed ${res.data?.evaluated_count || 0} active students with real-time explainability drivers.`,
      });
      fetchInitialData();
    } catch (err: unknown) {
      console.error("Evaluation failed", err);
      setNotification({
        type: "error",
        message: "Failed to run AI evaluation. Please verify server permissions.",
      });
    } finally {
      setEvaluating(false);
    }
  };

  const handleOpenReviewModal = (record: AIRiskRecord) => {
    setSelectedRecord(record);
    setReviewAction(record.review_action_taken && record.review_action_taken !== "NONE" ? record.review_action_taken : "COUNSELING_SCHEDULED");
    setReviewNotes(record.review_notes || "");
  };

  const handleSubmitReview = async () => {
    if (!selectedRecord) return;
    setSubmittingReview(true);
    try {
      await apiRequest(`/api/v1/analytics/ai-risk/${selectedRecord.id}/review/`, {
        method: "POST",
        body: JSON.stringify({
          review_action_taken: reviewAction,
          review_notes: reviewNotes,
        }),
      });
      setNotification({
        type: "success",
        message: `Mentor counseling plan recorded for ${selectedRecord.student_name}.`,
      });
      setSelectedRecord(null);
      fetchInitialData();
    } catch (err: unknown) {
      console.error("Review submit error", err);
      setNotification({
        type: "error",
        message: "Failed to submit review. Note: Mentors may only review students assigned to their cohort.",
      });
    } finally {
      setSubmittingReview(false);
    }
  };

  const getRiskBadge = (level: string) => {
    switch (level) {
      case "CRITICAL":
        return <Badge variant="destructive" className="animate-pulse">CRITICAL RISK</Badge>;
      case "HIGH":
        return <Badge variant="warning" className="bg-amber-500/20 text-amber-300 border-amber-500/40">HIGH RISK</Badge>;
      case "MEDIUM":
        return <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-300 border-yellow-500/40">MEDIUM RISK</Badge>;
      case "LOW":
        return <Badge variant="success">LOW RISK / STABLE</Badge>;
      default:
        return <Badge variant="outline">{level}</Badge>;
    }
  };

  const filteredRiskList = riskList.filter((r) => {
    if (riskFilter !== "ALL" && r.risk_level !== riskFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = r.student_name?.toLowerCase().includes(q);
      const matchRoll = r.roll_number?.toLowerCase().includes(q);
      const matchDept = r.department_name?.toLowerCase().includes(q);
      if (!matchName && !matchRoll && !matchDept) return false;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-8 space-y-8">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`flex items-center justify-between p-4 rounded-xl border backdrop-blur-md transition-all ${
            notification.type === "success"
              ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-200"
              : "bg-red-950/60 border-red-500/40 text-red-200"
          }`}
        >
          <div className="flex items-center gap-3">
            {notification.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            )}
            <span className="text-sm font-medium">{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="p-1 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-indigo-600/30 to-cyan-500/20 border border-indigo-500/30 text-cyan-400">
              <BrainCircuit className="w-6 h-6" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              Campus Analytics & AI Radar
            </h1>
            <Badge variant="outline" className="ml-2 border-indigo-500/40 text-indigo-300 bg-indigo-950/30">
              AI Decision Support
            </Badge>
          </div>
          <p className="text-sm text-slate-400">
            Institutional operational metrics, multi-factor academic risk early warning, and explainable intervention workflows.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {["PRINCIPAL", "HOD", "MANAGEMENT"].includes(user?.role || "") && (
            <button
              onClick={handleRunEvaluation}
              disabled={evaluating}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50"
            >
              {evaluating ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 text-cyan-200" />
              )}
              <span>{evaluating ? "Evaluating..." : "Run AI Risk Audit"}</span>
            </button>
          )}

          <button
            onClick={fetchInitialData}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-medium bg-slate-900 border border-slate-800 hover:bg-slate-800/80 text-slate-200 transition-all"
            title="Refresh analytics data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-cyan-400" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Executive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Active Students */}
        <div className="p-5 rounded-2xl bg-gradient-to-b from-slate-900/90 to-slate-900/40 border border-slate-800/80 backdrop-blur-md relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Active Students
            </span>
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-white">
              {overview ? overview.total_students : "—"}
            </span>
            <span className="text-xs text-slate-400">
              across {overview?.total_departments || 0} depts
            </span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Active multi-tenant rosters</span>
          </div>
        </div>

        {/* Overall Attendance */}
        <div className="p-5 rounded-2xl bg-gradient-to-b from-slate-900/90 to-slate-900/40 border border-slate-800/80 backdrop-blur-md relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Campus Attendance
            </span>
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-white">
              {overview ? `${overview.overall_attendance_percentage}%` : "—"}
            </span>
            <span className="text-xs text-slate-400">aggregate rate</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
            <span className="inline-block w-2 h-2 rounded-full bg-cyan-400"></span>
            <span>75% statutory exam minimum</span>
          </div>
        </div>

        {/* Fee Collection Velocity */}
        <div className="p-5 rounded-2xl bg-gradient-to-b from-slate-900/90 to-slate-900/40 border border-slate-800/80 backdrop-blur-md relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Fee Collection
            </span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-white">
              {overview ? `${overview.financials.collection_percentage}%` : "—"}
            </span>
            <span className="text-xs text-slate-400">collected</span>
          </div>
          <div className="mt-2 text-xs text-slate-400 truncate">
            ₹{overview ? Number(overview.financials.total_collected).toLocaleString() : "0"} / ₹
            {overview ? Number(overview.financials.total_invoiced).toLocaleString() : "0"}
          </div>
        </div>

        {/* AI Early Warning Alert */}
        <div className="p-5 rounded-2xl bg-gradient-to-b from-amber-950/30 via-slate-900/60 to-slate-900/40 border border-amber-500/30 backdrop-blur-md relative overflow-hidden group hover:border-amber-500/50 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-300">
              Action Required
            </span>
            <div className="p-2 rounded-lg bg-amber-500/20 text-amber-300">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-amber-200">
              {overview?.early_warning_summary.action_required_count ?? "0"}
            </span>
            <span className="text-xs text-slate-400">high / critical risk</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-400">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
            <span>Early intervention advised</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab("radar")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            activeTab === "radar"
              ? "bg-indigo-600/30 border border-indigo-500/50 text-indigo-200 shadow-md"
              : "bg-slate-900/50 text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent"
          }`}
        >
          <BrainCircuit className="w-4 h-4" />
          <span>AI Early Warning Radar</span>
          {riskList.length > 0 && (
            <span className="px-1.5 py-0.5 text-xs rounded-full bg-indigo-500/30 text-indigo-300">
              {riskList.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("attendance")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            activeTab === "attendance"
              ? "bg-cyan-600/30 border border-cyan-500/50 text-cyan-200 shadow-md"
              : "bg-slate-900/50 text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent"
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Attendance Diagnostics</span>
          {attendanceData?.defaulters_count ? (
            <span className="px-1.5 py-0.5 text-xs rounded-full bg-red-500/30 text-red-300">
              {attendanceData.defaulters_count} Defaulters
            </span>
          ) : null}
        </button>

        <button
          onClick={() => setActiveTab("finance")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            activeTab === "finance"
              ? "bg-emerald-600/30 border border-emerald-500/50 text-emerald-200 shadow-md"
              : "bg-slate-900/50 text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent"
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>Financial Velocity</span>
        </button>

        <button
          onClick={() => setActiveTab("academics")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            activeTab === "academics"
              ? "bg-purple-600/30 border border-purple-500/50 text-purple-200 shadow-md"
              : "bg-slate-900/50 text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent"
          }`}
        >
          <GraduationCap className="w-4 h-4" />
          <span>Academic Performance</span>
        </button>
      </div>

      {/* Tab 1: AI Early Warning Radar */}
      {activeTab === "radar" && (
        <div className="space-y-6">
          {/* Radar Header & Risk Distribution Bar */}
          <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/20 to-slate-900 border border-slate-800/90 shadow-xl space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-indigo-400" />
                  Academic Risk Early Warning Radar
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Multi-factor explainable machine evaluation combining attendance patterns, assignment submissions, exam scores, and leave frequencies.
                </p>
              </div>

              {/* Risk Filter Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setRiskFilter("ALL")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    riskFilter === "ALL"
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                  }`}
                >
                  All ({riskList.length})
                </button>
                <button
                  onClick={() => setRiskFilter("CRITICAL")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    riskFilter === "CRITICAL"
                      ? "bg-red-600 text-white"
                      : "bg-red-950/40 text-red-400 hover:bg-red-900/50 border border-red-900/50"
                  }`}
                >
                  Critical ({overview?.early_warning_summary.critical_risk ?? 0})
                </button>
                <button
                  onClick={() => setRiskFilter("HIGH")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    riskFilter === "HIGH"
                      ? "bg-amber-600 text-white"
                      : "bg-amber-950/40 text-amber-400 hover:bg-amber-900/50 border border-amber-900/50"
                  }`}
                >
                  High ({overview?.early_warning_summary.high_risk ?? 0})
                </button>
                <button
                  onClick={() => setRiskFilter("MEDIUM")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    riskFilter === "MEDIUM"
                      ? "bg-yellow-600 text-white"
                      : "bg-yellow-950/40 text-yellow-400 hover:bg-yellow-900/50 border border-yellow-900/50"
                  }`}
                >
                  Medium ({overview?.early_warning_summary.medium_risk ?? 0})
                </button>
                <button
                  onClick={() => setRiskFilter("LOW")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    riskFilter === "LOW"
                      ? "bg-emerald-600 text-white"
                      : "bg-emerald-950/40 text-emerald-400 hover:bg-emerald-900/50 border border-emerald-900/50"
                  }`}
                >
                  Low ({overview?.early_warning_summary.low_risk ?? 0})
                </button>
              </div>
            </div>

            {/* Search and filter controls */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search students by name, roll number, or department..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>

          {/* Student Risk Cards Grid */}
          {filteredRiskList.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-slate-900/30 border border-dashed border-slate-800">
              <BrainCircuit className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-300">No Risk Records Found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                {searchQuery || riskFilter !== "ALL"
                  ? "Try adjusting your search criteria or risk filter chips."
                  : "Run the AI Risk Audit to compute initial explainable risk indicators for your college roster."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredRiskList.map((record) => {
                const scoreNum = Number(record.score) || 0;
                return (
                  <div
                    key={record.id}
                    className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800/80 backdrop-blur-md shadow-xl hover:border-slate-700/80 transition-all flex flex-col justify-between space-y-4"
                  >
                    <div>
                      {/* Card Header: Student & Risk Badge */}
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-bold text-white">{record.student_name}</h3>
                            <Badge variant="outline" className="text-xs text-slate-400 border-slate-700">
                              {record.roll_number}
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {record.department_name} • Sem {record.semester_number} ({record.batch_name})
                          </p>
                        </div>
                        <div>{getRiskBadge(record.risk_level)}</div>
                      </div>

                      {/* Risk Score Meter */}
                      <div className="mt-4 p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                            <ShieldAlert className="w-3.5 h-3.5 text-indigo-400" />
                            Multi-Factor Risk Score
                          </span>
                          <span className="font-bold text-white text-sm">
                            {scoreNum.toFixed(1)} <span className="text-slate-500 text-xs">/ 100</span>
                          </span>
                        </div>
                        {/* Gauge bar */}
                        <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              record.risk_level === "CRITICAL"
                                ? "bg-red-500"
                                : record.risk_level === "HIGH"
                                ? "bg-amber-500"
                                : record.risk_level === "MEDIUM"
                                ? "bg-yellow-500"
                                : "bg-emerald-500"
                            }`}
                            style={{ width: `${Math.min(100, scoreNum)}%` }}
                          />
                        </div>
                        {/* 4 Quantitative Sub-Metrics */}
                        <div className="grid grid-cols-4 gap-2 pt-1 text-center text-xs text-slate-400">
                          <div>
                            <span className="block font-semibold text-white">
                              {record.attendance_rate}%
                            </span>
                            <span className="text-[10px] text-slate-500">Attendance</span>
                          </div>
                          <div>
                            <span className="block font-semibold text-white">
                              {record.missing_assignments_count}
                            </span>
                            <span className="text-[10px] text-slate-500">Missing Assg</span>
                          </div>
                          <div>
                            <span className="block font-semibold text-white">
                              {record.average_marks_percentage}%
                            </span>
                            <span className="text-[10px] text-slate-500">Exam Avg</span>
                          </div>
                          <div>
                            <span className="block font-semibold text-white">
                              {record.leave_days_count}d
                            </span>
                            <span className="text-[10px] text-slate-500">Leaves</span>
                          </div>
                        </div>
                      </div>

                      {/* Key Risk Drivers (Explainability) */}
                      {record.key_risk_drivers && record.key_risk_drivers.length > 0 && (
                        <div className="mt-4 space-y-1.5">
                          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                            <Info className="w-3.5 h-3.5 text-cyan-400" />
                            Explainable Risk Drivers
                          </span>
                          <div className="space-y-1">
                            {record.key_risk_drivers.map((driver, idx) => (
                              <div
                                key={idx}
                                className="flex items-start gap-2 p-2 rounded-lg bg-slate-950/40 border border-slate-800/40 text-xs text-slate-300"
                              >
                                <span className="text-amber-400 mt-0.5">•</span>
                                <span>{driver}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Suggested Interventions */}
                      {record.suggested_interventions && record.suggested_interventions.length > 0 && (
                        <div className="mt-3 space-y-1.5">
                          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            Recommended Interventions
                          </span>
                          <div className="space-y-1">
                            {record.suggested_interventions.map((item, idx) => (
                              <div
                                key={idx}
                                className="flex items-start gap-2 p-2 rounded-lg bg-emerald-950/20 border border-emerald-900/30 text-xs text-emerald-300"
                              >
                                <span className="text-emerald-400 mt-0.5">✓</span>
                                <span>{item}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Card Footer: Review status & Action */}
                    <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="text-xs text-slate-400">
                        {record.reviewed_at ? (
                          <span className="flex items-center gap-1.5 text-emerald-400">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Reviewed by {record.reviewed_by_name || "Mentor"} (
                            {record.review_action_taken.replace(/_/g, " ")})
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-amber-400">
                            <Clock className="w-3.5 h-3.5" />
                            Pending Mentor Counseling Plan
                          </span>
                        )}
                      </div>

                      {["PRINCIPAL", "HOD", "MENTOR"].includes(user?.role || "") && (
                        <button
                          onClick={() => handleOpenReviewModal(record)}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white transition-colors"
                        >
                          <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
                          <span>{record.reviewed_at ? "Update Action" : "Plan Intervention"}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Ethical AI Notice */}
          <div className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-900/40 text-xs text-indigo-300 flex items-start gap-3">
            <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-indigo-200">Ethical AI & Non-Punitive Architecture Guardrail: </span>
              Predictions rendered by the CampyTeq Academic Risk Engine are strictly advisory decision-support tools for academic mentors and faculty. Automated grade deductions, course de-registrations, or status revocations are strictly prohibited by architecture.
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Attendance Diagnostics */}
      {activeTab === "attendance" && (
        <div className="space-y-6">
          {/* Department Attendance Rates */}
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-cyan-400" />
              Department Attendance Performance
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {attendanceData?.department_breakdown.map((dept) => {
                const rate = dept.attendance_rate;
                const isWarning = rate < 75;
                return (
                  <div
                    key={dept.department_id}
                    className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold text-white text-sm">{dept.name}</h4>
                        <span className="text-xs text-slate-500">Code: {dept.code}</span>
                      </div>
                      <span
                        className={`text-lg font-bold ${
                          isWarning ? "text-amber-400" : "text-emerald-400"
                        }`}
                      >
                        {rate}%
                      </span>
                    </div>

                    <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          isWarning ? "bg-amber-500" : "bg-emerald-500"
                        }`}
                        style={{ width: `${rate}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>{dept.student_count} Enrolled</span>
                      <span>{dept.total_sessions_recorded} Sessions</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Statutory Defaulters (< 75%) Roster */}
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                  Statutory Defaulters Roster (&lt; 75% Attendance)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Students currently below the mandatory 75% minimum semester attendance requirement.
                </p>
              </div>
              <Badge variant="destructive">
                {attendanceData?.defaulters_count ?? 0} Students Flagged
              </Badge>
            </div>

            {attendanceData?.defaulters && attendanceData.defaulters.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-slate-950/80 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Student</th>
                      <th className="py-3 px-4">Roll Number</th>
                      <th className="py-3 px-4">Department</th>
                      <th className="py-3 px-4">Attendance Rate</th>
                      <th className="py-3 px-4">Sessions</th>
                      <th className="py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {attendanceData.defaulters.map((s) => (
                      <tr key={s.student_id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-white">{s.name}</td>
                        <td className="py-3.5 px-4 text-xs font-mono text-slate-400">{s.roll_number}</td>
                        <td className="py-3.5 px-4 text-xs">{s.department || "—"}</td>
                        <td className="py-3.5 px-4 font-bold text-red-400">
                          {s.attendance_percentage}%
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-400">{s.sessions_attended}</td>
                        <td className="py-3.5 px-4">
                          <Badge variant="destructive" className="text-[10px]">
                            DEFAULTER
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-slate-500">
                No students currently in defaulter standing below 75%.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Financial Velocity */}
      {activeTab === "finance" && (
        <div className="space-y-6">
          {/* Financial Breakdown Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800/80">
              <span className="text-xs uppercase text-slate-400 font-semibold">Total Invoiced</span>
              <div className="mt-2 text-2xl font-bold text-white">
                ₹{financeData ? Number(financeData.total_billed).toLocaleString() : "0"}
              </div>
              <span className="text-xs text-slate-500 mt-1 block">Active billing cycles</span>
            </div>

            <div className="p-5 rounded-2xl bg-emerald-950/20 border border-emerald-900/40">
              <span className="text-xs uppercase text-emerald-400 font-semibold">Total Collected</span>
              <div className="mt-2 text-2xl font-bold text-emerald-300">
                ₹{financeData ? Number(financeData.total_collected).toLocaleString() : "0"}
              </div>
              <span className="text-xs text-emerald-500/80 mt-1 block">Verified transactions</span>
            </div>

            <div className="p-5 rounded-2xl bg-amber-950/20 border border-amber-900/40">
              <span className="text-xs uppercase text-amber-400 font-semibold">Outstanding Receivables</span>
              <div className="mt-2 text-2xl font-bold text-amber-300">
                ₹{financeData ? Number(financeData.total_outstanding).toLocaleString() : "0"}
              </div>
              <span className="text-xs text-amber-500/80 mt-1 block">Pending & overdue invoices</span>
            </div>
          </div>

          {/* Payment Methods Breakdown */}
          {financeData?.payment_methods && (
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-xl space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-400" />
                Payment Channels Distribution
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {financeData.payment_methods.map((method) => (
                  <div
                    key={method.method}
                    className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-1"
                  >
                    <span className="text-xs font-semibold text-slate-400">{method.method}</span>
                    <div className="text-lg font-bold text-white">
                      ₹{Number(method.amount).toLocaleString()}
                    </div>
                    <span className="text-xs text-slate-500">{method.count} Transactions</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Academic Performance */}
      {activeTab === "academics" && (
        <div className="space-y-6">
          {/* Academic KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800/80">
              <span className="text-xs uppercase text-slate-400 font-semibold">Exam Pass Rate</span>
              <div className="mt-2 text-2xl font-bold text-cyan-300">
                {academicData ? `${academicData.overall_performance.pass_percentage}%` : "—"}
              </div>
              <span className="text-xs text-slate-500 mt-1 block">
                {academicData?.overall_performance.pass_count || 0} Passed /{" "}
                {academicData?.overall_performance.total_results || 0} Evaluated
              </span>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800/80">
              <span className="text-xs uppercase text-slate-400 font-semibold">Evaluated Results</span>
              <div className="mt-2 text-2xl font-bold text-white">
                {academicData?.overall_performance.total_results || 0}
              </div>
              <span className="text-xs text-slate-500 mt-1 block">Published exam evaluations</span>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800/80">
              <span className="text-xs uppercase text-slate-400 font-semibold">Grade Variance</span>
              <div className="mt-2 text-2xl font-bold text-purple-300">
                {academicData?.grade_distribution.length || 0} Tiers
              </div>
              <span className="text-xs text-slate-500 mt-1 block">Standard bell curve grading</span>
            </div>
          </div>

          {/* Grade Distribution */}
          {academicData?.grade_distribution && (
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-xl space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Award className="w-5 h-5 text-purple-400" />
                Institutional Grade Distribution
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
                {academicData.grade_distribution.map((g) => (
                  <div
                    key={g.grade}
                    className="p-3.5 text-center rounded-xl bg-slate-950/80 border border-slate-800/80"
                  >
                    <span className="text-lg font-bold text-white block">{g.grade}</span>
                    <span className="text-xs text-slate-400">{g.count} Students</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mentor Review Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-indigo-400" />
                  Mentor Counseling Plan
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Recording human intervention for {selectedRecord.student_name} ({selectedRecord.roll_number})
                </p>
              </div>
              <button
                onClick={() => setSelectedRecord(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Action Taken
                </label>
                <select
                  value={reviewAction}
                  onChange={(e) => setReviewAction(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="COUNSELING_SCHEDULED">Counseling Scheduled / Mentorship Meeting</option>
                  <option value="PARENT_CONTACTED">Guardian / Parent Contacted</option>
                  <option value="REMEDIAL_CLASS">Assigned Remedial / Extra Classes</option>
                  <option value="MEDICAL_LEAVE_NOTED">Medical Certificate / Excusal Documented</option>
                  <option value="NO_ACTION">Monitoring in Progress / No Action Required</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Counseling Notes & Action Summary
                </label>
                <textarea
                  rows={4}
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Describe mentoring discussion, root causes identified, student commitments, and scheduled follow-up milestones..."
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-900/30 text-xs text-amber-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  Mentor Scoping Rule: Your submission will be recorded under your faculty ID. Mentors can only document reviews for students assigned to their designated cohort.
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-slate-800 bg-slate-950/40 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitReview}
                disabled={submittingReview}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {submittingReview ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>Save Counseling Plan</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
