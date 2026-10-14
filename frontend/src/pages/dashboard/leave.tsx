"use client";

import React, { useState, useEffect } from "react";
import {
  CalendarX,
  CalendarCheck2,
  Clock,
  Plus,
  CheckCircle2,
  XCircle,
  AlertCircle,
  User,
  Check,
  X,
  FileText,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/api";
import { Badge } from "@/components/ui/badge";

interface LeaveRequest {
  id: string;
  user: string;
  user_name: string;
  user_email: string;
  user_role: string;
  leave_type: "MEDICAL" | "CASUAL" | "ACADEMIC_DUTY" | "PERSONAL" | "EMERGENCY";
  from_date: string;
  to_date: string;
  days_count: number;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  approved_by_name?: string;
  approval_remarks?: string;
  reviewed_at?: string;
  routed_tier?: "MENTOR" | "HOD" | "PRINCIPAL";
  routed_to_name?: string;
  created_at: string;
}

export default function LeaveManagementPage() {
  const { user } = useAuth();
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"MY_LEAVES" | "REVIEW_QUEUE">(
    user?.role === "PRINCIPAL" ? "REVIEW_QUEUE" : "MY_LEAVES"
  );
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [reviewModal, setReviewModal] = useState<{
    request: LeaveRequest | null;
    action: "APPROVE" | "REJECT" | null;
  }>({ request: null, action: null });
  const [remarks, setRemarks] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Form for applying leave
  const [formData, setFormData] = useState({
    leave_type: "CASUAL",
    from_date: "",
    to_date: "",
    reason: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const isReviewer = ["PRINCIPAL", "HOD", "MENTOR", "FACULTY"].includes(user?.role || "");

  const fetchLeaves = async () => {
    try {
      setLoading(true);
      const res = await apiRequest<any>("/leave/requests/");
      const items = res?.results || (Array.isArray(res) ? res : []);
      setLeaves(items);
    } catch (err) {
      console.error("Failed to load leaves", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaves();
  }, []);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await apiRequest("/leave/requests/", {
        method: "POST",
        body: JSON.stringify(formData),
      });
      setShowApplyModal(false);
      setFormData({
        leave_type: "CASUAL",
        from_date: "",
        to_date: "",
        reason: "",
      });
      fetchLeaves();
    } catch (err) {
      console.error("Failed to submit leave", err);
      alert("Failed to submit leave request.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReviewSubmit = async () => {
    if (!reviewModal.request || !reviewModal.action) return;
    try {
      setActionLoading(true);
      const endpoint =
        reviewModal.action === "APPROVE"
          ? `/leave/requests/${reviewModal.request.id}/approve/`
          : `/leave/requests/${reviewModal.request.id}/reject/`;

      await apiRequest(endpoint, {
        method: "POST",
        body: JSON.stringify({ approval_remarks: remarks }),
      });
      setReviewModal({ request: null, action: null });
      setRemarks("");
      fetchLeaves();
    } catch (err) {
      console.error("Failed to process review", err);
      alert("Failed to update leave status.");
    } finally {
      setActionLoading(false);
    }
  };

  const myLeaves = leaves.filter((l) => l.user === user?.id || l.user_email === user?.email);
  const pendingReviews = leaves.filter(
    (l) => l.status === "PENDING" && l.user !== user?.id && l.user_email !== user?.email
  );

  const statusBadges: Record<string, { badge: string; label: string }> = {
    PENDING: {
      badge: "bg-amber-500/10 text-amber-400 border-amber-500/30",
      label: "Pending Review",
    },
    APPROVED: {
      badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
      label: "Approved",
    },
    REJECTED: {
      badge: "bg-rose-500/10 text-rose-400 border-rose-500/30",
      label: "Rejected",
    },
    CANCELLED: {
      badge: "bg-slate-500/10 text-slate-400 border-slate-500/30",
      label: "Cancelled",
    },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <CalendarX className="h-6 w-6 text-indigo-400" />
            Leave Requests & Approvals
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Apply for student & faculty absences, verify medical certificates, and track multi-tier approvals.
          </p>
        </div>

        {user?.role !== "PRINCIPAL" && (
          <button
            onClick={() => setShowApplyModal(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow-md shadow-indigo-600/20 flex items-center gap-2 transition-colors self-start md:self-auto"
          >
            <Plus className="h-4 w-4" />
            Apply for Leave
          </button>
        )}
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-border/60 bg-card/60 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">Total In Record</p>
            <p className="text-xl font-bold text-foreground">{leaves.length}</p>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border/60 bg-card/60 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">Pending Review</p>
            <p className="text-xl font-bold text-amber-400">
              {leaves.filter((l) => l.status === "PENDING").length}
            </p>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border/60 bg-card/60 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">Approved Leaves</p>
            <p className="text-xl font-bold text-emerald-400">
              {leaves.filter((l) => l.status === "APPROVED").length}
            </p>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border/60 bg-card/60 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-rose-500/10 text-rose-400">
            <XCircle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">Rejected</p>
            <p className="text-xl font-bold text-rose-400">
              {leaves.filter((l) => l.status === "REJECTED").length}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border/60 pb-2">
        {user?.role !== "PRINCIPAL" && (
          <button
            onClick={() => setActiveTab("MY_LEAVES")}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === "MY_LEAVES"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
            }`}
          >
            My Applications ({myLeaves.length})
          </button>
        )}

        {isReviewer && (
          <button
            onClick={() => setActiveTab("REVIEW_QUEUE")}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === "REVIEW_QUEUE"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
            }`}
          >
            {user?.role === "PRINCIPAL" ? "Institutional Leave Approvals" : "Review Queue"}
            {pendingReviews.length > 0 && (
              <span className="h-4 px-1.5 rounded-full bg-amber-500 text-black text-[10px] font-bold">
                {pendingReviews.length}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">Loading leaves data...</div>
      ) : activeTab === "REVIEW_QUEUE" ? (
        /* Review Queue for Mentors/HOD/Principal */
        <div className="space-y-4">
          {pendingReviews.length === 0 ? (
            <div className="py-16 text-center bg-card/40 rounded-xl border border-border/60">
              <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-2 opacity-80" />
              <p className="text-sm font-semibold text-foreground">Review Queue Clear</p>
              <p className="text-xs text-muted-foreground mt-1">
                There are no pending leave requests requiring your review.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingReviews.map((req) => (
                <div
                  key={req.id}
                  className="p-5 rounded-xl border border-amber-500/30 bg-card/70 flex flex-col justify-between shadow-sm"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-foreground text-sm">{req.user_name}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {req.user_role}
                        </Badge>
                        {req.routed_tier && (
                          <Badge variant="outline" className="text-[10px] border-purple-500/30 text-purple-300">
                            Tier: {req.routed_tier === "MENTOR" ? "Student → Mentor" : req.routed_tier === "HOD" ? "Faculty → HOD" : "HOD → Principal"}
                          </Badge>
                        )}
                      </div>
                      <Badge variant="outline" className={statusBadges[req.status]?.badge}>
                        {statusBadges[req.status]?.label}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-indigo-400 font-medium mb-2">
                      <CalendarCheck2 className="h-3.5 w-3.5" />
                      <span>
                        {req.from_date} to {req.to_date} ({req.days_count} {req.days_count === 1 ? "day" : "days"})
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground leading-relaxed bg-secondary/30 p-2.5 rounded-lg border border-border/40">
                      &quot;{req.reason}&quot;
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground uppercase font-mono">
                      {req.leave_type.replace("_", " ")}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setReviewModal({ request: req, action: "REJECT" })}
                        className="px-3 py-1.5 border border-rose-500/40 text-rose-400 hover:bg-rose-500/10 text-xs font-semibold rounded-lg flex items-center gap-1 transition-colors"
                      >
                        <X className="h-3.5 w-3.5" /> Reject
                      </button>
                      <button
                        onClick={() => setReviewModal({ request: req, action: "APPROVE" })}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1 shadow-sm transition-colors"
                      >
                        <Check className="h-3.5 w-3.5" /> Approve
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* My Applications Tab */
        <div className="space-y-4">
          {myLeaves.length === 0 ? (
            <div className="py-16 text-center bg-card/40 rounded-xl border border-border/60">
              <CalendarX className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-60" />
              <p className="text-sm font-semibold text-foreground">No leave applications</p>
              <p className="text-xs text-muted-foreground mt-1">
                You have not submitted any leave applications yet.
              </p>
            </div>
          ) : (
            <div className="bg-card/60 rounded-xl border border-border/60 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-secondary/40 border-b border-border/60 text-muted-foreground">
                  <tr>
                    <th className="p-3.5 font-semibold">Type</th>
                    <th className="p-3.5 font-semibold">Dates & Duration</th>
                    <th className="p-3.5 font-semibold">Reason</th>
                    <th className="p-3.5 font-semibold">Status</th>
                    <th className="p-3.5 font-semibold">Approver Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {myLeaves.map((leave) => (
                    <tr key={leave.id} className="hover:bg-secondary/20 transition-colors">
                      <td className="p-3.5 font-semibold text-foreground">
                        <div>{leave.leave_type.replace("_", " ")}</div>
                        {leave.routed_tier && (
                          <span className="text-[10px] text-purple-300 font-normal block">
                            Approver: {leave.routed_tier === "MENTOR" ? "Mentor" : leave.routed_tier === "HOD" ? "HOD" : "Principal"}
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 text-muted-foreground font-mono">
                        <div>
                          {leave.from_date} — {leave.to_date}
                        </div>
                        <span className="text-[10px] text-indigo-400">
                          {leave.days_count} {leave.days_count === 1 ? "day" : "days"}
                        </span>
                      </td>
                      <td className="p-3.5 max-w-xs text-muted-foreground leading-relaxed">
                        {leave.reason}
                      </td>
                      <td className="p-3.5">
                        <Badge variant="outline" className={statusBadges[leave.status]?.badge}>
                          {statusBadges[leave.status]?.label}
                        </Badge>
                      </td>
                      <td className="p-3.5 text-muted-foreground">
                        {leave.approval_remarks ? (
                          <div>
                            <p className="text-foreground text-[11px]">{leave.approval_remarks}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              By {leave.approved_by_name || "Approver"}
                            </p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground/60 italic">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Apply Leave Modal */}
      {showApplyModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border/80 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <h2 className="text-lg font-bold text-foreground mb-1">Apply for Leave</h2>
            <p className="text-xs text-muted-foreground mb-3">
              {user?.role === "FACULTY"
                ? "Your faculty leave request will be officially transmitted to your Head of Department (HOD) for sanction."
                : "Your request will be routed to your department authority for review."}
            </p>

            {user?.role === "FACULTY" && (
              <div className="mb-4 p-2.5 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-between text-xs text-indigo-200">
                <span className="font-semibold">Approval Authority:</span>
                <span className="font-mono bg-indigo-500/20 px-2 py-0.5 rounded text-indigo-300">Head of Department (HOD)</span>
              </div>
            )}

            <form onSubmit={handleApply} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold block mb-1">Leave Category</label>
                <select
                  value={formData.leave_type}
                  onChange={(e) => setFormData({ ...formData, leave_type: e.target.value as any })}
                  className="w-full bg-secondary/50 border border-border/80 rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="CASUAL">Casual Leave</option>
                  <option value="MEDICAL">Medical / Health Leave</option>
                  <option value="ACADEMIC_DUTY">Academic Duty / Conference Leave</option>
                  <option value="PERSONAL">Personal Leave</option>
                  <option value="EMERGENCY">Emergency Leave</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">From Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.from_date}
                    onChange={(e) => setFormData({ ...formData, from_date: e.target.value })}
                    className="w-full bg-secondary/50 border border-border/80 rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">To Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.to_date}
                    onChange={(e) => setFormData({ ...formData, to_date: e.target.value })}
                    className="w-full bg-secondary/50 border border-border/80 rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold block mb-1">Reason / Statement *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Provide legitimate justification for absence..."
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  className="w-full bg-secondary/50 border border-border/80 rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => setShowApplyModal(false)}
                  className="px-4 py-2 border border-border/80 rounded-lg hover:bg-secondary/60 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg shadow-md transition-colors disabled:opacity-50"
                >
                  {submitting ? "Submitting..." : "Submit Application"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Review Modal (Approve / Reject) */}
      {reviewModal.request && reviewModal.action && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border/80 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <h2 className="text-lg font-bold text-foreground mb-1">
              {reviewModal.action === "APPROVE" ? "Approve Leave Request" : "Reject Leave Request"}
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              Applicant: <strong className="text-foreground">{reviewModal.request.user_name}</strong> (
              {reviewModal.request.days_count} days: {reviewModal.request.from_date} to{" "}
              {reviewModal.request.to_date})
            </p>

            <div className="space-y-4 text-xs">
              <div>
                <label className="font-semibold block mb-1">
                  {reviewModal.action === "APPROVE" ? "Approval Remarks" : "Reason for Rejection *"}
                </label>
                <textarea
                  rows={3}
                  placeholder={
                    reviewModal.action === "APPROVE"
                      ? "e.g. Approved as per college medical guidelines."
                      : "Provide specific rationale for turning down leave..."
                  }
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full bg-secondary/50 border border-border/80 rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => setReviewModal({ request: null, action: null })}
                  className="px-4 py-2 border border-border/80 rounded-lg hover:bg-secondary/60 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReviewSubmit}
                  disabled={actionLoading}
                  className={`px-4 py-2 font-semibold text-white rounded-lg shadow-md transition-colors disabled:opacity-50 ${
                    reviewModal.action === "APPROVE"
                      ? "bg-emerald-600 hover:bg-emerald-500"
                      : "bg-rose-600 hover:bg-rose-500"
                  }`}
                >
                  {actionLoading
                    ? "Processing..."
                    : reviewModal.action === "APPROVE"
                    ? "Confirm Approval"
                    : "Confirm Rejection"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
