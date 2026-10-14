"use client";

import React, { useState, useEffect } from "react";
import {
  Calendar,
  Clock,
  MapPin,
  BookOpen,
  UserCheck,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  AlertCircle,
  X,
  Layers,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";

interface TimetableItem {
  id: string;
  course: string;
  course_code: string;
  batch: string;
  batch_name: string;
  semester: string;
  subject: string;
  subject_name: string;
  subject_code: string;
  faculty: string;
  faculty_name: string;
  day_of_week: number;
  day_name: string;
  start_time: string;
  end_time: string;
  room: string;
}

const DAYS = [
  { id: 1, name: "Monday" },
  { id: 2, name: "Tuesday" },
  { id: 3, name: "Wednesday" },
  { id: 4, name: "Thursday" },
  { id: 5, name: "Friday" },
  { id: 6, name: "Saturday" },
];

export default function TimetablePage() {
  const { user } = useAuth();
  const isHOD = user?.role === "HOD" || user?.email?.toLowerCase().includes("hod");
  const canManageTimetable = ["HOD", "PRINCIPAL", "SUPER_ADMIN"].includes(user?.role || "") || !!isHOD;

  const [selectedDay, setSelectedDay] = useState(2); // Tuesday default
  const [schedule, setSchedule] = useState<TimetableItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State for Create / Edit
  const [showModal, setShowModal] = useState(false);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Available options for HOD to assign
  const availableCourses = [
    { id: "ab26f45e-6271-4b2e-b560-c9d363129abc", name: "B.Tech in Computer Science & Engineering", code: "BTECH-CSE" },
    { id: "987c7107-a693-41b3-9d50-6325c7925ae1", name: "Bachelor of Computer Applications", code: "BCA" },
  ];

  const availableBatches = [
    { id: "3910bea3-a97a-46d0-8815-00e71e1409c5", name: "2026-2030 Batch (CSE)" },
    { id: "260bdde3-b4a3-483a-a034-814f5dd917b9", name: "2026-2029 Batch (BCA)" },
  ];

  const availableSemesters = [
    { id: "81765f26-8720-43da-b362-16309987423b", name: "Semester 3" },
    { id: "69da940e-bf5c-4631-9169-b15ec45fd6f3", name: "Semester 1" },
  ];

  const availableSubjects = [
    { id: "03a8b916-2df9-4531-94da-aee9cb7aa5c4", code: "CS301", name: "Data Structures & Algorithms" },
    { id: "32ccd3b4-4a6f-448e-a925-0ab660fa1b27", code: "CS302", name: "Advanced Python Systems" },
    { id: "4297f753-f16f-4357-a4c8-418327f69bc9", code: "CS303", name: "Database Systems & Design" },
    { id: "357e7664-f1cf-4466-9422-d465676950f8", code: "CS304", name: "Computer Architecture" },
    { id: "2c0fc9f0-5684-4428-94ba-a49f12e7b9cf", code: "CS305", name: "Algorithms Lab Practical" },
  ];

  const availableFaculties = [
    { id: "9dcd5645-b27d-4552-8037-c9c61ea7b7d6", name: "Dr. Aruna Sundaram (HOD)" },
    { id: "dd32ffb5-19dc-4184-84b1-269e78b1af70", name: "Prof. Priya Nair (Faculty & Mentor)" },
    { id: "9f97daae-e27a-40b3-93db-841f79fea69c", name: "Prof. Anil Verma (Mentor)" },
  ];

  const [formData, setFormData] = useState({
    course: availableCourses[0].id,
    batch: availableBatches[0].id,
    semester: availableSemesters[0].id,
    subject: availableSubjects[0].id,
    faculty: availableFaculties[1].id,
    day_of_week: 2,
    start_time: "09:00",
    end_time: "10:00",
    room: "Hall 304",
  });

  const loadSchedule = async () => {
    try {
      setLoading(true);
      const data = await apiRequest<{ results: TimetableItem[] } | TimetableItem[]>(
        `/academics/timetable/?day_of_week=${selectedDay}`
      );
      const list = Array.isArray(data) ? data : data?.results || [];
      setSchedule(list);
    } catch (err) {
      console.error("Failed to load schedule", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSchedule();
  }, [selectedDay]);

  const handleOpenCreate = () => {
    setEditingSlotId(null);
    setFormData({
      course: availableCourses[0].id,
      batch: availableBatches[0].id,
      semester: availableSemesters[0].id,
      subject: availableSubjects[0].id,
      faculty: availableFaculties[1].id,
      day_of_week: selectedDay,
      start_time: "09:00",
      end_time: "10:00",
      room: "Hall 304",
    });
    setShowModal(true);
  };

  const handleOpenEdit = (slot: TimetableItem) => {
    setEditingSlotId(slot.id);
    setFormData({
      course: slot.course || availableCourses[0].id,
      batch: slot.batch || availableBatches[0].id,
      semester: slot.semester || availableSemesters[0].id,
      subject: slot.subject || availableSubjects[0].id,
      faculty: slot.faculty || availableFaculties[0].id,
      day_of_week: slot.day_of_week || selectedDay,
      start_time: slot.start_time.slice(0, 5),
      end_time: slot.end_time.slice(0, 5),
      room: slot.room,
    });
    setShowModal(true);
  };

  const handleDeleteSlot = async (slotId: string) => {
    if (!confirm("Are you sure you want to remove this timetable slot?")) return;
    try {
      await apiRequest(`/academics/timetable/${slotId}/`, {
        method: "DELETE",
      });
      setSuccessMessage("Timetable slot removed successfully.");
      setTimeout(() => setSuccessMessage(null), 3000);
      loadSchedule();
    } catch (err) {
      console.error("Failed to delete slot", err);
      alert("Failed to delete timetable slot.");
    }
  };

  const handleSaveSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      if (editingSlotId) {
        await apiRequest(`/academics/timetable/${editingSlotId}/`, {
          method: "PATCH",
          body: JSON.stringify(formData),
        });
        setSuccessMessage("Timetable slot updated successfully.");
      } else {
        await apiRequest("/academics/timetable/", {
          method: "POST",
          body: JSON.stringify(formData),
        });
        setSuccessMessage("New timetable slot created successfully.");
      }
      setShowModal(false);
      setTimeout(() => setSuccessMessage(null), 3500);
      loadSchedule();
    } catch (err) {
      console.error("Failed to save slot", err);
      alert("Failed to save timetable slot.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <Calendar className="h-7 w-7 text-indigo-400" />
              Faculty & Class Timetable
            </h1>
            {canManageTimetable && (
              <Badge variant="outline" className="text-[10px] border-purple-500/40 text-purple-300">
                HOD Governance Active
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {canManageTimetable
              ? "Create, allocate, edit, and update teaching schedules for faculty and laboratory sessions."
              : user?.role === "FACULTY"
              ? "Your teaching lectures, lab practicals, and room allocations."
              : "Weekly scheduled lectures, practical labs, and classroom allocations."}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* CREATE TIMETABLE OPTION FOR HOD / PRINCIPAL / SUPER ADMIN */}
          {canManageTimetable && (
            <button
              type="button"
              id="create-timetable-btn"
              onClick={handleOpenCreate}
              className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Create Timetable Slot</span>
            </button>
          )}

          <Badge variant="outline" className="text-xs border-indigo-500/40 text-indigo-300">
            Batch 2026-2030 • Sem 3
          </Badge>
          <Badge variant="secondary" className="text-xs">
            {schedule.length} Sessions on {DAYS.find((d) => d.id === selectedDay)?.name}
          </Badge>
        </div>
      </div>

      {/* Notification Toast */}
      {successMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5 animate-in fade-in">
          <CheckCircle className="h-4 w-4 shrink-0 text-emerald-400" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Day Selector Pills */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-2xl bg-secondary/40 border border-border/60">
        {DAYS.map((d) => {
          const isSelected = selectedDay === d.id;
          return (
            <button
              key={d.id}
              onClick={() => setSelectedDay(d.id)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                isSelected
                  ? "bg-primary text-white shadow-md shadow-indigo-500/25 scale-[1.02]"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
              }`}
            >
              {d.name}
            </button>
          );
        })}
      </div>

      {/* Schedule Timeline Cards */}
      <div className="space-y-3">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent mr-2 align-middle" />
            Loading Timetable Slots...
          </div>
        ) : schedule.length === 0 ? (
          <Card className="glass-panel text-center p-10 space-y-3">
            <Calendar className="h-10 w-10 text-muted-foreground/40 mx-auto" />
            <div>
              <p className="text-sm font-semibold text-foreground">No Classes Scheduled</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                There are no scheduled lectures or labs for {DAYS.find((d) => d.id === selectedDay)?.name}.
              </p>
            </div>
            {canManageTimetable && (
              <Button size="sm" variant="gradient" onClick={handleOpenCreate} className="text-xs">
                <Plus className="h-3.5 w-3.5 mr-1" /> Add First Slot for {DAYS.find((d) => d.id === selectedDay)?.name}
              </Button>
            )}
          </Card>
        ) : (
          schedule.map((slot, idx) => (
            <Card key={slot.id} className="glass-panel-hover">
              <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="h-12 w-12 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 font-bold flex flex-col items-center justify-center shrink-0">
                    <span className="text-[10px] text-indigo-400 font-semibold uppercase">Slot</span>
                    <span className="text-sm font-extrabold leading-none">#{idx + 1}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] border-indigo-500/40 text-indigo-300">
                        {slot.subject_code}
                      </Badge>
                      <span className="text-xs text-muted-foreground font-medium">{slot.course_code}</span>
                      <span className="text-[10px] text-muted-foreground">({slot.batch_name})</span>
                    </div>
                    <h3 className="text-sm font-bold text-foreground mt-0.5">
                      {slot.subject_name}
                    </h3>
                    <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-slate-300">
                      <span className="flex items-center gap-1">
                        <UserCheck className="h-3.5 w-3.5 text-teal-400" />
                        {slot.faculty_name}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-indigo-400" />
                        {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-amber-400" />
                        {slot.room}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end md:self-center">
                  {/* EDIT & DELETE ACTIONS FOR HOD / PRINCIPAL */}
                  {canManageTimetable ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(slot)}
                        className="px-2.5 py-1.5 rounded-lg bg-secondary/80 hover:bg-secondary text-foreground text-xs font-semibold border border-border flex items-center gap-1 transition-colors"
                        title="Edit Timetable Slot"
                      >
                        <Edit2 className="h-3.5 w-3.5 text-indigo-400" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSlot(slot.id)}
                        className="px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold border border-red-500/30 flex items-center gap-1 transition-colors"
                        title="Delete Timetable Slot"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Delete</span>
                      </button>
                    </div>
                  ) : (
                    <Badge variant="secondary" className="text-xs bg-secondary/80">
                      4 Credits
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* =========================================================================
          CREATE / EDIT TIMETABLE SLOT MODAL (HOD / PRINCIPAL)
         ========================================================================= */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border/80 rounded-2xl w-full max-w-lg p-6 shadow-2xl animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground">
                  {editingSlotId ? "Edit Timetable Slot" : "Create New Timetable Slot"}
                </h3>
                <p className="text-xs text-muted-foreground">
                  Allocate academic subject, professor, room, and day of week
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSlot} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Academic Day *</label>
                  <select
                    value={formData.day_of_week}
                    onChange={(e) => setFormData({ ...formData, day_of_week: parseInt(e.target.value) })}
                    className="w-full bg-secondary/60 border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {DAYS.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold block mb-1">Batch / Class Cohort *</label>
                  <select
                    value={formData.batch}
                    onChange={(e) => setFormData({ ...formData, batch: e.target.value })}
                    className="w-full bg-secondary/60 border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {availableBatches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold block mb-1">Subject / Course Module *</label>
                <select
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full bg-secondary/60 border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {availableSubjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code}: {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold block mb-1">Allocated Faculty / Lecturer *</label>
                <select
                  value={formData.faculty}
                  onChange={(e) => setFormData({ ...formData, faculty: e.target.value })}
                  className="w-full bg-secondary/60 border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {availableFaculties.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Start Time *</label>
                  <input
                    type="time"
                    required
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    className="w-full bg-secondary/60 border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="font-semibold block mb-1">End Time *</label>
                  <input
                    type="time"
                    required
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                    className="w-full bg-secondary/60 border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="font-semibold block mb-1">Room / Lab *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Hall 304, Lab 2"
                    value={formData.room}
                    onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                    className="w-full bg-secondary/60 border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/60">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="gradient"
                  size="sm"
                  disabled={submitting}
                >
                  {submitting ? "Saving Slot..." : editingSlotId ? "Save Changes" : "Create Slot"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
