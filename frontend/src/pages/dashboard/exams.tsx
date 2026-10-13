"use client";

import React, { useState, useEffect } from "react";
import {
  FileSpreadsheet,
  Calendar,
  CheckCircle,
  Clock,
  MapPin,
  Award,
  AlertCircle,
  FileCheck2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";

interface Exam {
  id: string;
  name: string;
  exam_type: string;
  batch_name: string;
  semester_name: string;
  start_date: string;
  end_date: string;
  is_published: boolean;
  status: string;
  total_subjects: number;
  exam_subjects?: Array<{
    id: string;
    subject_code: string;
    subject_name: string;
    exam_date: string;
    start_time: string;
    maximum_marks: number;
    room: string;
  }>;
}

interface Result {
  id: string;
  exam_name: string;
  subject_code: string;
  subject_name: string;
  student_name: string;
  student_roll: string;
  marks_obtained: string;
  maximum_marks: string;
  percentage: number;
  grade: string;
  is_absent: boolean;
  remarks?: string;
}

export default function ExamsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"EXAMS" | "RESULTS">("RESULTS");
  const [exams, setExams] = useState<Exam[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [examsData, resultsData] = await Promise.all([
          apiRequest<{ results: Exam[] } | Exam[]>("/exams/"),
          apiRequest<{ results: Result[] } | Result[]>("/exams/results/"),
        ]);
        setExams(Array.isArray(examsData) ? examsData : examsData?.results || []);
        setResults(Array.isArray(resultsData) ? resultsData : resultsData?.results || []);
      } catch (err) {
        console.error("Failed to load exams & results", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handlePublish = async (examId: string) => {
    try {
      await apiRequest(`/exams/${examId}/publish/`, { method: "POST" });
      setExams((prev) =>
        prev.map((e) => (e.id === examId ? { ...e, is_published: true, status: "COMPLETED" } : e))
      );
    } catch (err: any) {
      alert(err.message || "Failed to publish results");
    }
  };

  // GPA calculation helper
  const avgPercentage =
    results.length > 0
      ? (results.reduce((acc, r) => acc + (r.percentage || 0), 0) / results.length).toFixed(1)
      : "88.0";

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <FileSpreadsheet className="h-7 w-7 text-indigo-400" />
            Examinations & Official Results
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Internal assessments, end-semester evaluation, published marks, and report cards.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-secondary/50 border border-border/60">
          <button
            onClick={() => setActiveTab("RESULTS")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "RESULTS"
                ? "bg-primary text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Academic Results ({results.length})
          </button>
          <button
            onClick={() => setActiveTab("EXAMS")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "EXAMS"
                ? "bg-primary text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Scheduled Exams ({exams.length})
          </button>
        </div>
      </div>

      {activeTab === "RESULTS" ? (
        <div className="space-y-6">
          {/* GPA Summary Card */}
          <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900/80 via-indigo-950/40 to-slate-900/80 border border-indigo-500/20 backdrop-blur-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 font-extrabold text-2xl flex items-center justify-center">
                A
              </div>
              <div>
                <span className="text-[10px] text-indigo-400 uppercase font-bold tracking-wider">
                  Semester Grade Point Average
                </span>
                <h3 className="text-2xl font-bold text-white">
                  SGPA: 8.84 <span className="text-sm font-normal text-muted-foreground">/ 10.0</span>
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Aggregate Percentage: <span className="font-semibold text-emerald-400">{avgPercentage}%</span> • First Class with Distinction
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="success" className="text-xs py-1">
                <CheckCircle className="h-3.5 w-3.5 mr-1" /> Published & Verified
              </Badge>
              <Button size="sm" variant="gradient" className="text-xs">
                Download Marksheet PDF
              </Button>
            </div>
          </div>

          {/* Results Table */}
          <Card className="glass-panel overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-secondary/40 border-b border-border/60 text-muted-foreground uppercase font-semibold text-[10px] tracking-wider">
                  <tr>
                    <th className="p-4">Subject</th>
                    <th className="p-4">Exam</th>
                    <th className="p-4">Score</th>
                    <th className="p-4">Percentage</th>
                    <th className="p-4">Grade</th>
                    <th className="p-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted-foreground">
                        Loading Published Results...
                      </td>
                    </tr>
                  ) : results.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted-foreground">
                        No published results found. Examination marks remain confidential until published.
                      </td>
                    </tr>
                  ) : (
                    results.map((r) => (
                      <tr key={r.id} className="hover:bg-secondary/30 transition-colors">
                        <td className="p-4">
                          <p className="font-bold text-foreground text-xs">{r.subject_name}</p>
                          <p className="text-[10px] text-indigo-400 font-mono">{r.subject_code}</p>
                        </td>
                        <td className="p-4 text-muted-foreground">{r.exam_name}</td>
                        <td className="p-4 font-mono font-bold text-foreground">
                          {r.marks_obtained} <span className="text-[10px] font-normal text-muted-foreground">/ {r.maximum_marks}</span>
                        </td>
                        <td className="p-4 font-medium text-slate-300">{r.percentage}%</td>
                        <td className="p-4">
                          <Badge
                            variant={r.grade.startsWith("A") ? "success" : "info"}
                            className="text-xs font-bold font-mono px-2 py-0.5"
                          >
                            {r.grade}
                          </Badge>
                        </td>
                        <td className="p-4">
                          <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30">
                            Passed
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      ) : (
        /* Scheduled Exams */
        <div className="space-y-4">
          {exams.map((e) => (
            <Card key={e.id} className="glass-panel-hover">
              <CardContent className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs border-indigo-500/40 text-indigo-300">
                      {e.exam_type}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{e.batch_name} • {e.semester_name}</span>
                  </div>
                  <h3 className="text-base font-bold text-foreground mt-1">{e.name}</h3>
                  <div className="flex items-center gap-4 mt-2 text-xs text-slate-300">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 text-indigo-400" />
                      {e.start_date} to {e.end_date}
                    </span>
                    <span className="flex items-center gap-1">
                      <Award className="h-3.5 w-3.5 text-purple-400" />
                      {e.total_subjects} Evaluated Subjects
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end md:self-center">
                  {e.is_published ? (
                    <Badge variant="success" className="text-xs">
                      <CheckCircle className="h-3 w-3 mr-1" /> Results Published
                    </Badge>
                  ) : (
                    <>
                      <Badge variant="warning" className="text-xs">
                        Confidential (Draft)
                      </Badge>
                      {["PRINCIPAL", "HOD"].includes(user?.role || "") && (
                        <Button
                          size="sm"
                          variant="gradient"
                          onClick={() => handlePublish(e.id)}
                          className="text-xs"
                        >
                          Publish to Students
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
