"use client";

import React, { useState, useEffect } from "react";
import {
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Upload,
  MessageSquare,
  Award,
  Send,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";

interface Assignment {
  id: string;
  faculty_name: string;
  subject_name: string;
  subject_code: string;
  batch_name: string;
  title: string;
  description: string;
  maximum_marks: string;
  due_date: string;
  status: string;
  total_submissions: number;
  my_submission?: {
    id: string;
    submitted_at: string;
    file_url?: string;
    submission_text?: string;
    status: string;
    marks_awarded?: string;
    feedback?: string;
  };
}

export default function AssignmentsPage() {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");
  const [submittingAssignment, setSubmittingAssignment] = useState<Assignment | null>(null);
  const [submissionText, setSubmissionText] = useState("");
  const [fileUrl, setFileUrl] = useState("https://storage.campyteq.local/assignments/my_work.pdf");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function loadAssignments() {
      try {
        setLoading(true);
        const data = await apiRequest<{ results: Assignment[] } | Assignment[]>("/assignments/");
        const list = Array.isArray(data) ? data : data?.results || [];
        setAssignments(list);
      } catch (err) {
        console.error("Failed to load assignments", err);
      } finally {
        setLoading(false);
      }
    }
    loadAssignments();
  }, []);

  const handleCreateSubmission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submittingAssignment) return;
    setIsSubmitting(true);

    try {
      const res = await apiRequest("/assignments/submissions/", {
        method: "POST",
        body: JSON.stringify({
          assignment: submittingAssignment.id,
          submission_text: submissionText,
          file_url: fileUrl,
        }),
      });

      // Update local state
      setAssignments((prev) =>
        prev.map((a) =>
          a.id === submittingAssignment.id ? { ...a, my_submission: res } : a
        )
      );
      setSubmittingAssignment(null);
      setSubmissionText("");
    } catch (err: any) {
      alert(err.message || "Failed to submit assignment");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredAssignments = assignments.filter((a) => {
    if (filter === "ALL") return true;
    if (filter === "GRADED") return a.my_submission?.status === "GRADED";
    if (filter === "SUBMITTED") return a.my_submission && a.my_submission.status !== "GRADED";
    if (filter === "PENDING") return !a.my_submission;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <FileText className="h-7 w-7 text-indigo-400" />
            Course Assignments & Continuous Assessment
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Submit coursework, track grading feedback, and review faculty evaluations.
          </p>
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-secondary/50 border border-border/60 text-xs">
          {["ALL", "PENDING", "SUBMITTED", "GRADED"].map((st) => (
            <button
              key={st}
              onClick={() => setFilter(st)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                filter === st
                  ? "bg-primary text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Assignment List */}
      <div className="space-y-4">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent mr-2 align-middle" />
            Loading Assignments...
          </div>
        ) : filteredAssignments.length === 0 ? (
          <Card className="glass-panel p-8 text-center">
            <FileText className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm font-semibold text-foreground">No Assignments Found</p>
            <p className="text-xs text-muted-foreground mt-1">
              There are no coursework assignments matching the current status filter.
            </p>
          </Card>
        ) : (
          filteredAssignments.map((a) => {
            const hasSubmitted = !!a.my_submission;
            const isGraded = a.my_submission?.status === "GRADED";

            return (
              <Card key={a.id} className="glass-panel-hover">
                <CardContent className="p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] border-indigo-500/40 text-indigo-300">
                          {a.subject_code} • {a.subject_name}
                        </Badge>
                        <span className="text-xs text-muted-foreground">Instructor: {a.faculty_name}</span>
                      </div>
                      <h3 className="text-base font-bold text-foreground mt-1.5">{a.title}</h3>
                      <p className="text-xs text-slate-300 mt-1 max-w-2xl">{a.description}</p>
                    </div>

                    <div className="flex flex-col sm:items-end gap-1.5 shrink-0">
                      <div className="flex items-center gap-1.5 text-xs text-amber-400 font-medium">
                        <Clock className="h-3.5 w-3.5" />
                        Due: {new Date(a.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        Max Score: {parseFloat(a.maximum_marks)} pts
                      </Badge>
                    </div>
                  </div>

                  {/* Submission and Feedback Banner */}
                  <div className="pt-3 border-t border-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      {isGraded ? (
                        <div className="flex items-center gap-2">
                          <Badge variant="success" className="text-xs">
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Graded: {a.my_submission?.marks_awarded} / {parseFloat(a.maximum_marks)}
                          </Badge>
                          <span className="text-xs text-slate-300 italic">
                            "{a.my_submission?.feedback}"
                          </span>
                        </div>
                      ) : hasSubmitted ? (
                        <div className="flex items-center gap-2">
                          <Badge variant="info" className="text-xs">
                            Submitted on {new Date(a.my_submission!.submitted_at).toLocaleDateString()}
                          </Badge>
                          <span className="text-xs text-muted-foreground">Pending Faculty Review</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <AlertCircle className="h-4 w-4 text-amber-400" />
                          <span>Not submitted yet</span>
                        </div>
                      )}
                    </div>

                    {!hasSubmitted && user?.role === "STUDENT" && (
                      <Button
                        size="sm"
                        variant="gradient"
                        onClick={() => setSubmittingAssignment(a)}
                        className="text-xs h-8"
                      >
                        <Upload className="h-3.5 w-3.5 mr-1.5" /> Submit Work
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Submission Dialog */}
      {submittingAssignment && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="max-w-lg w-full glass-panel border-indigo-500/30 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border/60">
              <div>
                <CardTitle className="text-base font-bold">Submit Assignment Work</CardTitle>
                <CardDescription className="text-xs mt-0.5">{submittingAssignment.title}</CardDescription>
              </div>
              <button
                onClick={() => setSubmittingAssignment(null)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleCreateSubmission} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Solution Description & Notes</label>
                  <textarea
                    rows={3}
                    required
                    value={submissionText}
                    onChange={(e) => setSubmissionText(e.target.value)}
                    placeholder="Describe your implementation, algorithms used, and test results..."
                    className="w-full bg-secondary/60 border border-border/60 rounded-lg p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Artifact File URL / Submission Link</label>
                  <Input
                    type="url"
                    required
                    value={fileUrl}
                    onChange={(e) => setFileUrl(e.target.value)}
                    className="text-xs"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setSubmittingAssignment(null)}
                    className="text-xs h-9"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    variant="gradient"
                    className="text-xs h-9"
                  >
                    {isSubmitting ? "Submitting..." : "Confirm & Submit"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
