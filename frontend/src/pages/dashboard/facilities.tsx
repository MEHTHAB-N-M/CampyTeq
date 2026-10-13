"use client";

import React, { useState, useEffect } from "react";
import {
  Building2,
  Calendar,
  Clock,
  Users,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Plus,
  ShieldCheck,
  Search,
  Check,
  X,
  Sparkles,
  MapPin,
  Layers,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface Facility {
  id: string;
  name: string;
  facility_type: "SEMINAR_HALL" | "TURF" | "AUDITORIUM" | "LAB";
  facility_type_display: string;
  capacity: number;
  location: string;
  description: string;
  amenities: string[];
  is_active: boolean;
}

interface FacilityBooking {
  id: string;
  facility: string;
  facility_name: string;
  facility_type: string;
  facility_location: string;
  requested_by: string;
  requested_by_name: string;
  requested_by_role: string;
  department_name: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  purpose: string;
  expected_attendees: number;
  notes: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  reviewed_by_name?: string;
  review_remarks?: string;
  reviewed_at?: string;
  created_at: string;
}

export default function FacilitiesPage() {
  const { user } = useAuth();
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [bookings, setBookings] = useState<FacilityBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"DIRECTORY" | "BOOKINGS">("BOOKINGS");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");

  // Booking Modal State (Mentors)
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [bookingForm, setBookingForm] = useState({
    facility: "",
    booking_date: new Date().toISOString().split("T")[0],
    start_time: "10:00",
    end_time: "12:00",
    purpose: "",
    expected_attendees: 50,
    notes: "",
  });
  const [formError, setFormError] = useState<string | null>(null);

  // Review Modal State (HOD / Principal)
  const [reviewBooking, setReviewBooking] = useState<FacilityBooking | null>(null);
  const [reviewAction, setReviewAction] = useState<"APPROVED" | "REJECTED">("APPROVED");
  const [reviewRemarks, setReviewRemarks] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);

  const isMentor = user?.role === "MENTOR" || user?.role === "PRINCIPAL";
  const isApprover = user?.role === "HOD" || user?.role === "PRINCIPAL";
  const canAccess = ["PRINCIPAL", "HOD", "MENTOR"].includes(user?.role || "");

  const fetchData = async () => {
    try {
      setLoading(true);
      const [facRes, bookRes] = await Promise.all([
        apiRequest("/facilities/"),
        apiRequest("/facilities/bookings/"),
      ]);
      const facData = facRes?.results || facRes?.data || facRes || [];
      const bookData = bookRes?.results || bookRes?.data || bookRes || [];
      setFacilities(Array.isArray(facData) ? facData : []);
      setBookings(Array.isArray(bookData) ? bookData : []);

      if (facData.length > 0 && !bookingForm.facility) {
        setBookingForm((prev) => ({ ...prev, facility: facData[0].id }));
      }
    } catch (err) {
      console.error("Failed to load facility data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canAccess) {
      fetchData();
    }
  }, [user]);

  if (!canAccess) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
        <div className="h-16 w-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
          <AlertCircle className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Restricted Module Access</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          Facility Bookings (Seminar Hall & Turf) are strictly reserved for Mentors, Heads of Department, and the Principal.
        </p>
      </div>
    );
  }

  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);

    try {
      await apiRequest("/facilities/bookings/", {
        method: "POST",
        body: JSON.stringify(bookingForm),
      });
      setShowBookingModal(false);
      setBookingForm({
        facility: facilities[0]?.id || "",
        booking_date: new Date().toISOString().split("T")[0],
        start_time: "10:00",
        end_time: "12:00",
        purpose: "",
        expected_attendees: 50,
        notes: "",
      });
      fetchData();
    } catch (err: any) {
      setFormError(err.message || "Failed to submit booking request.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReview = async () => {
    if (!reviewBooking) return;
    setReviewLoading(true);
    try {
      await apiRequest(`/facilities/bookings/${reviewBooking.id}/review/`, {
        method: "POST",
        body: JSON.stringify({
          status: reviewAction,
          review_remarks: reviewRemarks,
        }),
      });
      setReviewBooking(null);
      setReviewRemarks("");
      fetchData();
    } catch (err: any) {
      alert(err.message || "Failed to submit review.");
    } finally {
      setReviewLoading(false);
    }
  };

  const filteredBookings = bookings.filter((b) => {
    if (filterStatus === "ALL") return true;
    return b.status === filterStatus;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Campus Facilities & Bookings
            </h1>
            <Badge variant="outline" className="border-indigo-500/40 text-indigo-300">
              Seminar Hall & Turf
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Mentor booking request workflow routed to HOD for approval and conflict management.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isMentor && (
            <Button
              onClick={() => setShowBookingModal(true)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-md shadow-indigo-600/20"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Request Booking
            </Button>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-border/60 pb-3">
        <div className="flex items-center gap-2">
          <Button
            variant={activeTab === "BOOKINGS" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("BOOKINGS")}
            className="text-xs font-semibold"
          >
            <Calendar className="h-3.5 w-3.5 mr-1.5" />
            Booking Requests ({bookings.length})
          </Button>
          <Button
            variant={activeTab === "DIRECTORY" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("DIRECTORY")}
            className="text-xs font-semibold"
          >
            <Building2 className="h-3.5 w-3.5 mr-1.5" />
            Facilities Directory ({facilities.length})
          </Button>
        </div>

        {activeTab === "BOOKINGS" && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:inline">Status:</span>
            {["ALL", "PENDING", "APPROVED", "REJECTED"].map((st) => (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={`text-xs px-2.5 py-1 rounded-md transition-colors ${
                  filterStatus === st
                    ? "bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="p-12 text-center text-sm text-muted-foreground animate-pulse">
          Loading campus facilities and reservation schedules...
        </div>
      ) : activeTab === "DIRECTORY" ? (
        /* Facilities Directory View */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {facilities.map((f) => (
            <Card key={f.id} className="glass-panel border-border/60 hover:border-indigo-500/40 transition-all">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                      {f.name}
                      <Badge variant="outline" className="text-xs font-normal border-indigo-500/30 text-indigo-300">
                        {f.facility_type_display}
                      </Badge>
                    </CardTitle>
                    <CardDescription className="flex items-center gap-1.5 text-xs">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                      {f.location}
                    </CardDescription>
                  </div>
                  <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[11px]">
                    Available for Booking
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <p className="text-muted-foreground text-xs leading-relaxed">{f.description}</p>
                <div className="flex items-center gap-4 text-xs text-slate-300 pt-1">
                  <div className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-indigo-400" />
                    <span>Capacity: <strong className="text-foreground">{f.capacity} attendees</strong></span>
                  </div>
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                    Included Amenities:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {f.amenities?.map((amenity, idx) => (
                      <span
                        key={idx}
                        className="text-[11px] px-2 py-0.5 rounded bg-secondary/50 border border-border/50 text-slate-300"
                      >
                        {amenity}
                      </span>
                    ))}
                  </div>
                </div>
                {isMentor && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full mt-2 border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/10"
                    onClick={() => {
                      setBookingForm((prev) => ({ ...prev, facility: f.id }));
                      setShowBookingModal(true);
                    }}
                  >
                    Request Reservation for this Facility
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        /* Bookings List View */
        <div className="space-y-3">
          {filteredBookings.length === 0 ? (
            <div className="p-12 text-center rounded-xl border border-dashed border-border/60 space-y-2">
              <Calendar className="h-8 w-8 text-muted-foreground mx-auto" />
              <p className="text-sm font-medium text-foreground">No bookings found for the selected filter.</p>
              <p className="text-xs text-muted-foreground">
                {isMentor ? "Click 'Request Booking' above to reserve the Seminar Hall or Turf." : "Incoming mentor requests will appear here."}
              </p>
            </div>
          ) : (
            filteredBookings.map((b) => (
              <div
                key={b.id}
                className="p-4 rounded-xl glass-panel border border-border/60 hover:border-indigo-500/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-foreground text-sm">{b.purpose}</span>
                    <Badge variant="outline" className="text-xs border-indigo-500/30 text-indigo-300">
                      {b.facility_name}
                    </Badge>
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        b.status === "APPROVED"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                          : b.status === "REJECTED"
                          ? "bg-red-500/10 text-red-400 border border-red-500/30"
                          : "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                      }`}
                    >
                      {b.status}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-slate-400" />
                      {b.booking_date}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-slate-400" />
                      {b.start_time} - {b.end_time}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3 text-slate-400" />
                      {b.expected_attendees} attendees
                    </span>
                    <span className="text-slate-400">
                      Requested by: <strong className="text-slate-200">{b.requested_by_name}</strong> ({b.requested_by_role})
                    </span>
                  </div>

                  {b.review_remarks && (
                    <div className="text-xs text-slate-400 bg-secondary/30 p-2 rounded border border-border/40 mt-2">
                      <strong className="text-foreground">HOD Review Notes:</strong> {b.review_remarks}
                      {b.reviewed_by_name && <span className="text-muted-foreground ml-1">({b.reviewed_by_name})</span>}
                    </div>
                  )}
                </div>

                {/* Approver Action Buttons */}
                {isApprover && b.status === "PENDING" && (
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      onClick={() => {
                        setReviewBooking(b);
                        setReviewAction("APPROVED");
                        setReviewRemarks("");
                      }}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8 px-3"
                    >
                      <Check className="h-3.5 w-3.5 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setReviewBooking(b);
                        setReviewAction("REJECTED");
                        setReviewRemarks("");
                      }}
                      className="border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs h-8 px-3"
                    >
                      <X className="h-3.5 w-3.5 mr-1" />
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Booking Request Modal (Mentors) */}
      {showBookingModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-lg glass-panel border-indigo-500/30 shadow-2xl">
            <CardHeader className="pb-3 border-b border-border/40">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-bold">Request Facility Booking</CardTitle>
                <button
                  onClick={() => setShowBookingModal(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <CardDescription className="text-xs">
                Booking requests are routed directly to the Head of Department for review and calendar approval.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <form onSubmit={handleCreateBooking} className="space-y-4 text-xs">
                {formError && (
                  <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Facility</label>
                  <select
                    value={bookingForm.facility}
                    onChange={(e) => setBookingForm({ ...bookingForm, facility: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border/80 text-foreground"
                    required
                  >
                    {facilities.map((f) => (
                      <option key={f.id} value={f.id} className="bg-slate-900 text-foreground">
                        {f.name} ({f.facility_type_display}) - Max {f.capacity}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-foreground">Date</label>
                    <Input
                      type="date"
                      value={bookingForm.booking_date}
                      onChange={(e) => setBookingForm({ ...bookingForm, booking_date: e.target.value })}
                      className="text-xs"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-foreground">Start Time</label>
                    <Input
                      type="time"
                      value={bookingForm.start_time}
                      onChange={(e) => setBookingForm({ ...bookingForm, start_time: e.target.value })}
                      className="text-xs"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-foreground">End Time</label>
                    <Input
                      type="time"
                      value={bookingForm.end_time}
                      onChange={(e) => setBookingForm({ ...bookingForm, end_time: e.target.value })}
                      className="text-xs"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Purpose / Event Title</label>
                  <Input
                    placeholder="e.g. AI & Robotics Hackathon Orientation"
                    value={bookingForm.purpose}
                    onChange={(e) => setBookingForm({ ...bookingForm, purpose: e.target.value })}
                    className="text-xs"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Expected Attendees</label>
                  <Input
                    type="number"
                    min="1"
                    value={bookingForm.expected_attendees}
                    onChange={(e) => setBookingForm({ ...bookingForm, expected_attendees: parseInt(e.target.value) || 1 })}
                    className="text-xs"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Special Requirements / Notes (Optional)</label>
                  <textarea
                    rows={2}
                    placeholder="Audio/visual setup, podium microphone, projector test..."
                    value={bookingForm.notes}
                    onChange={(e) => setBookingForm({ ...bookingForm, notes: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border/80 text-foreground text-xs"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowBookingModal(false)}
                    disabled={submitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={submitting}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white"
                  >
                    {submitting ? "Submitting..." : "Submit to HOD"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Review Modal (HOD / Principal) */}
      {reviewBooking && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-md glass-panel border-indigo-500/30 shadow-2xl">
            <CardHeader className="pb-3 border-b border-border/40">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold">
                  {reviewAction === "APPROVED" ? "Approve Reservation" : "Reject Reservation"}
                </CardTitle>
                <button
                  onClick={() => setReviewBooking(null)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <CardDescription className="text-xs">
                {reviewBooking.facility_name} — {reviewBooking.booking_date} ({reviewBooking.start_time} to {reviewBooking.end_time})
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-4 text-xs">
              <div className="p-3 rounded-lg bg-secondary/30 border border-border/40 space-y-1">
                <p><strong>Purpose:</strong> {reviewBooking.purpose}</p>
                <p><strong>Requested By:</strong> {reviewBooking.requested_by_name} ({reviewBooking.requested_by_role})</p>
                <p><strong>Attendees:</strong> {reviewBooking.expected_attendees}</p>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">Review Remarks / Conditions</label>
                <textarea
                  rows={3}
                  placeholder={
                    reviewAction === "APPROVED"
                      ? "Approved. Ensure premises are handed over clean by 12:30."
                      : "Reason for rejection (e.g. Schedule clash with University Inspection)..."
                  }
                  value={reviewRemarks}
                  onChange={(e) => setReviewRemarks(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border/80 text-foreground text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setReviewBooking(null)}
                  disabled={reviewLoading}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={reviewLoading}
                  onClick={handleReview}
                  className={
                    reviewAction === "APPROVED"
                      ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                      : "bg-red-600 hover:bg-red-500 text-white"
                  }
                >
                  {reviewLoading
                    ? "Processing..."
                    : reviewAction === "APPROVED"
                    ? "Confirm Approval"
                    : "Confirm Rejection"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
