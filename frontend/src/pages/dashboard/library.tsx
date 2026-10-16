"use client";

import React, { useState, useEffect } from "react";
import {
  Library,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  Plus,
  AlertCircle,
  Shield,
  Search,
  Filter,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface LibraryBookingItem {
  id: string;
  requested_by_name: string;
  requested_by_dept: string;
  date: string;
  start_time: string;
  end_time: string;
  purpose: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  decided_by_name?: string;
  decided_at?: string;
  reject_reason?: string;
  created_at: string;
}

interface AvailabilitySlot {
  start_time: string;
  end_time: string;
  status: "FREE" | "PENDING" | "BOOKED";
}

export default function LibraryPage() {
  const { user } = useAuth();
  const activeRole = user?.active_role || user?.role || "";

  const [activeTab, setActiveTab] = useState<"PENDING" | "CALENDAR" | "MINE">("PENDING");
  const [pendingBookings, setPendingBookings] = useState<LibraryBookingItem[]>([]);
  const [myBookings, setMyBookings] = useState<LibraryBookingItem[]>([]);
  const [availability, setAvailability] = useState<{ date: string; slots: AvailabilitySlot[] } | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);

  // Modals & Action States
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [rejectingBooking, setRejectingBooking] = useState<LibraryBookingItem | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // New Booking Form
  const [formData, setFormData] = useState({
    date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    start_time: "10:00:00",
    end_time: "12:00:00",
    purpose: "",
  });

  const isLibraryFaculty = activeRole === "LIBRARY_FACULTY";
  const canRequest = ["FACULTY", "LAB_FACULTY", "HOD", "CLASS_INCHARGE", "MENTOR"].includes(activeRole);
  const isStudentOrParent = ["STUDENT", "PARENT"].includes(activeRole);

  useEffect(() => {
    if (isStudentOrParent) return;
    loadData();
  }, [activeRole, selectedDate]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (isLibraryFaculty) {
        const res = await apiRequest<LibraryBookingItem[]>("/library/bookings/pending/");
        setPendingBookings(Array.isArray(res) ? res : (res as any)?.results || []);
      }
      if (canRequest) {
        const myRes = await apiRequest<LibraryBookingItem[]>("/library/bookings/mine/");
        setMyBookings(Array.isArray(myRes) ? myRes : (myRes as any)?.results || []);
      }
      // Load availability
      const availRes = await apiRequest<any>(`/library/bookings/availability/?date=${selectedDate}`);
      setAvailability(availRes);
    } catch (err: any) {
      console.error("Failed to load library bookings:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (bookingId: string) => {
    setActionLoading(true);
    try {
      await apiRequest(`/library/bookings/${bookingId}/approve/`, { method: "POST" });
      setNotification({ type: "success", text: "Library booking approved successfully." });
      loadData();
    } catch (err: any) {
      setNotification({ type: "error", text: err.message || "Failed to approve booking." });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectingBooking) return;
    if (!rejectReason.trim()) {
      alert("A rejection reason is strictly required.");
      return;
    }
    setActionLoading(true);
    try {
      await apiRequest(`/library/bookings/${rejectingBooking.id}/reject/`, {
        method: "POST",
        body: JSON.stringify({ reject_reason: rejectReason }),
      });
      setNotification({ type: "success", text: "Library booking rejected." });
      setRejectingBooking(null);
      setRejectReason("");
      loadData();
    } catch (err: any) {
      setNotification({ type: "error", text: err.message || "Failed to reject booking." });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await apiRequest("/library/bookings/", {
        method: "POST",
        body: JSON.stringify(formData),
      });
      setNotification({ type: "success", text: "Library booking request submitted successfully." });
      setShowBookingModal(false);
      setFormData({
        date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
        start_time: "10:00:00",
        end_time: "12:00:00",
        purpose: "",
      });
      loadData();
    } catch (err: any) {
      setNotification({ type: "error", text: err.message || "Failed to submit booking request." });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    if (!confirm("Are you sure you want to cancel this booking?")) return;
    setActionLoading(true);
    try {
      await apiRequest(`/library/bookings/${bookingId}/cancel/`, { method: "POST" });
      setNotification({ type: "success", text: "Booking cancelled." });
      loadData();
    } catch (err: any) {
      setNotification({ type: "error", text: err.message || "Failed to cancel booking." });
    } finally {
      setActionLoading(false);
    }
  };

  if (isStudentOrParent) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center space-y-4">
        <Shield className="h-12 w-12 text-rose-400 mx-auto" />
        <h2 className="text-xl font-bold text-foreground">Access Restricted</h2>
        <p className="text-sm text-muted-foreground">
          Students and parents do not have access to institutional library space reservation portals.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Library className="h-6 w-6 text-indigo-400" />
            Library Space Booking Portal
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Institutional reservations for digital library, conference, and study suites (Section 8 Spec).
          </p>
        </div>

        {canRequest && (
          <Button
            onClick={() => setShowBookingModal(true)}
            variant="gradient"
            className="flex items-center gap-1.5 text-xs font-semibold"
          >
            <Plus className="h-4 w-4" /> Request Library Slot
          </Button>
        )}
      </div>

      {notification && (
        <div
          className={`p-3 rounded-lg text-xs font-medium flex items-center justify-between ${
            notification.type === "success"
              ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-300"
              : "bg-rose-500/10 border border-rose-500/30 text-rose-300"
          }`}
        >
          <span>{notification.text}</span>
          <button onClick={() => setNotification(null)} className="text-xs opacity-70 hover:opacity-100">
            ✕
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-border/60 gap-6 text-xs">
        {isLibraryFaculty && (
          <button
            onClick={() => setActiveTab("PENDING")}
            className={`pb-2.5 font-semibold transition-colors flex items-center gap-1.5 border-b-2 ${
              activeTab === "PENDING"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
            Pending Decisions ({pendingBookings.length})
          </button>
        )}

        <button
          onClick={() => setActiveTab("CALENDAR")}
          className={`pb-2.5 font-semibold transition-colors flex items-center gap-1.5 border-b-2 ${
            activeTab === "CALENDAR"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Calendar className="h-3.5 w-3.5 text-indigo-400" />
          Availability Calendar
        </button>

        {canRequest && (
          <button
            onClick={() => setActiveTab("MINE")}
            className={`pb-2.5 font-semibold transition-colors flex items-center gap-1.5 border-b-2 ${
              activeTab === "MINE"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Clock className="h-3.5 w-3.5 text-emerald-400" />
            My Bookings ({myBookings.length})
          </button>
        )}
      </div>

      {/* TAB 1: PENDING DECISIONS (LIBRARY_FACULTY) */}
      {activeTab === "PENDING" && isLibraryFaculty && (
        <Card className="bg-card/50 border-border/60">
          <CardHeader className="pb-3 border-b border-border/40">
            <CardTitle className="text-sm font-semibold text-foreground">
              Awaiting Library Faculty Decisions
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {pendingBookings.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">
                No pending library booking requests at this time.
              </p>
            ) : (
              <div className="space-y-3">
                {pendingBookings.map((b) => (
                  <div
                    key={b.id}
                    className="p-3.5 rounded-xl bg-secondary/30 border border-border/50 flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-foreground">{b.requested_by_name}</span>
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">
                          {b.requested_by_dept}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Date: <span className="text-foreground font-mono">{b.date}</span> • Slot:{" "}
                        <span className="text-foreground font-mono">
                          {b.start_time.slice(0, 5)} - {b.end_time.slice(0, 5)}
                        </span>
                      </p>
                      <p className="text-xs text-indigo-300 font-medium italic">Purpose: {b.purpose}</p>
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-center">
                      <Button
                        size="sm"
                        variant="default"
                        disabled={actionLoading}
                        onClick={() => handleApprove(b.id)}
                        className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={actionLoading}
                        onClick={() => setRejectingBooking(b)}
                        className="h-8 text-xs border-rose-500/40 text-rose-300 hover:bg-rose-500/10"
                      >
                        <XCircle className="h-3.5 w-3.5 mr-1" /> Reject...
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB 2: AVAILABILITY CALENDAR */}
      {activeTab === "CALENDAR" && (
        <Card className="bg-card/50 border-border/60">
          <CardHeader className="pb-3 border-b border-border/40 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold text-foreground">
              Slot Availability (Anonymous View)
            </CardTitle>
            <div className="flex items-center gap-2">
              <label htmlFor="avail-date-input" className="text-xs text-muted-foreground">Date:</label>
              <input
                id="avail-date-input"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-secondary/60 border border-border/60 rounded px-2.5 py-1 text-xs text-foreground focus:outline-none"
              />
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground mb-4">
              *Per institutional policy (Section 8), requester identities and purposes are protected and hidden from peer view.
            </p>

            {availability?.slots && availability.slots.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {availability.slots.map((s, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg border text-xs font-mono text-center flex flex-col justify-between ${
                      s.status === "BOOKED"
                        ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
                        : s.status === "PENDING"
                        ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                        : "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                    }`}
                  >
                    <span className="font-bold">
                      {s.start_time.slice(0, 5)} - {s.end_time.slice(0, 5)}
                    </span>
                    <Badge
                      variant="outline"
                      className={`mt-2 mx-auto text-[10px] ${
                        s.status === "BOOKED"
                          ? "border-rose-500/40 text-rose-400"
                          : s.status === "PENDING"
                          ? "border-amber-500/40 text-amber-400"
                          : "border-emerald-500/40 text-emerald-400"
                      }`}
                    >
                      {s.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-6">
                All daily slots available for booking on {selectedDate}.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB 3: MY BOOKINGS */}
      {activeTab === "MINE" && canRequest && (
        <Card className="bg-card/50 border-border/60">
          <CardHeader className="pb-3 border-b border-border/40">
            <CardTitle className="text-sm font-semibold text-foreground">My Library Requests</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {myBookings.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">
                You have not placed any library booking requests yet.
              </p>
            ) : (
              <div className="space-y-3">
                {myBookings.map((b) => (
                  <div
                    key={b.id}
                    className="p-3 rounded-xl bg-secondary/30 border border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">{b.purpose}</span>
                        <Badge
                          variant={
                            b.status === "APPROVED"
                              ? "success"
                              : b.status === "REJECTED"
                              ? "destructive"
                              : b.status === "CANCELLED"
                              ? "outline"
                              : "warning"
                          }
                          className="text-[10px]"
                        >
                          {b.status}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground">
                        {b.date} • {b.start_time.slice(0, 5)} - {b.end_time.slice(0, 5)}
                      </p>
                      {b.reject_reason && (
                        <p className="text-rose-400 text-[11px]">Reason: {b.reject_reason}</p>
                      )}
                    </div>

                    {b.status === "PENDING" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCancelBooking(b.id)}
                        className="text-xs border-border/60 text-muted-foreground hover:text-foreground self-end sm:self-center"
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* REQUEST BOOKING MODAL */}
      {showBookingModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-md bg-card border-border/80 shadow-2xl">
            <CardHeader className="pb-3 border-b border-border/60">
              <CardTitle className="text-sm font-bold text-foreground">Request Library Space Slot</CardTitle>
            </CardHeader>
            <form onSubmit={handleCreateBooking}>
              <CardContent className="space-y-3 pt-4 text-xs">
                <div>
                  <label htmlFor="slot-date-input" className="block text-muted-foreground mb-1">Date</label>
                  <input
                    id="slot-date-input"
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full bg-secondary/60 border border-border/60 rounded px-3 py-1.5 text-foreground"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="slot-start-time" className="block text-muted-foreground mb-1">Start Time</label>
                    <input
                      id="slot-start-time"
                      type="time"
                      required
                      value={formData.start_time}
                      onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                      className="w-full bg-secondary/60 border border-border/60 rounded px-3 py-1.5 text-foreground"
                    />
                  </div>
                  <div>
                    <label htmlFor="slot-end-time" className="block text-muted-foreground mb-1">End Time</label>
                    <input
                      id="slot-end-time"
                      type="time"
                      required
                      value={formData.end_time}
                      onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                      className="w-full bg-secondary/60 border border-border/60 rounded px-3 py-1.5 text-foreground"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="slot-purpose-input" className="block text-muted-foreground mb-1">Purpose</label>
                  <textarea
                    id="slot-purpose-input"
                    required
                    rows={3}
                    placeholder="e.g. CS301 Systems Lab Research Session"
                    value={formData.purpose}
                    onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                    className="w-full bg-secondary/60 border border-border/60 rounded px-3 py-1.5 text-foreground"
                  />
                </div>
              </CardContent>
              <div className="p-4 border-t border-border/60 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowBookingModal(false)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button type="submit" variant="gradient" size="sm" disabled={actionLoading} className="text-xs">
                  {actionLoading ? "Submitting..." : "Submit Request"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* REJECT MODAL WITH REQUIRED REASON */}
      {rejectingBooking && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-md bg-card border-border/80 shadow-2xl">
            <CardHeader className="pb-3 border-b border-border/60">
              <CardTitle className="text-sm font-bold text-foreground">Reject Library Booking</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-4 text-xs">
              <p className="text-muted-foreground">
                Per Section 8 rules, a formal justification reason is strictly required when rejecting a booking.
              </p>
              <div>
                <label htmlFor="reject-reason-input" className="block text-muted-foreground mb-1">Reason for Rejection *</label>
                <textarea
                  id="reject-reason-input"
                  required
                  rows={3}
                  placeholder="Specify conflict or institutional justification..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full bg-secondary/60 border border-border/60 rounded px-3 py-1.5 text-foreground"
                />
              </div>
            </CardContent>
            <div className="p-4 border-t border-border/60 flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRejectingBooking(null)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={actionLoading || !rejectReason.trim()}
                onClick={handleReject}
                className="text-xs"
              >
                {actionLoading ? "Rejecting..." : "Confirm Rejection"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
