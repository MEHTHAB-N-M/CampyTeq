"use client";

import React, { useState, useEffect } from "react";
import {
  Megaphone,
  Pin,
  Calendar,
  User,
  Filter,
  Search,
  Plus,
  AlertCircle,
  Clock,
  Building,
  Tag,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/api";
import { Badge } from "@/components/ui/badge";

interface Announcement {
  id: string;
  title: string;
  content: string;
  category: "ACADEMIC" | "EXAM" | "EVENT" | "ADMINISTRATIVE" | "HOLIDAY" | "URGENT";
  priority: "NORMAL" | "HIGH" | "URGENT";
  target_audience: "ENTIRE_COLLEGE" | "DEPARTMENT" | "FACULTY_ONLY" | "STUDENTS_ONLY";
  department_name?: string;
  department?: string;
  created_by_name?: string;
  is_pinned: boolean;
  published_at: string;
  attachment_url?: string;
}

export default function AnnouncementsPage() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form state for creating announcement
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    category: "ACADEMIC",
    priority: "NORMAL",
    target_audience: "ENTIRE_COLLEGE",
    is_pinned: false,
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const res = await apiRequest<any>("/communication/announcements/");
      const items = res?.results || (Array.isArray(res) ? res : []);
      setAnnouncements(items);
    } catch (err) {
      console.error("Failed to load announcements", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await apiRequest("/communication/announcements/", {
        method: "POST",
        body: JSON.stringify(formData),
      });
      setShowCreateModal(false);
      setFormData({
        title: "",
        content: "",
        category: "ACADEMIC",
        priority: "NORMAL",
        target_audience: "ENTIRE_COLLEGE",
        is_pinned: false,
      });
      fetchAnnouncements();
    } catch (err) {
      console.error("Failed to post announcement", err);
      alert("Failed to publish announcement.");
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = announcements.filter((ann) => {
    const matchesCategory = categoryFilter === "ALL" || ann.category === categoryFilter;
    const matchesSearch =
      ann.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ann.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const pinnedList = filtered.filter((a) => a.is_pinned);
  const regularList = filtered.filter((a) => !a.is_pinned);

  const canPost = ["PRINCIPAL", "HOD", "FACULTY", "ACCOUNTANT"].includes(user?.role || "");

  const categoryBadges: Record<string, string> = {
    ACADEMIC: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    EXAM: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    EVENT: "bg-purple-500/10 text-purple-400 border-purple-500/30",
    FEES: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
    ADMINISTRATIVE: "bg-slate-500/10 text-slate-300 border-slate-500/30",
    HOLIDAY: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    URGENT: "bg-rose-500/10 text-rose-400 border-rose-500/30",
  };

  const priorityColors: Record<string, string> = {
    NORMAL: "text-muted-foreground",
    HIGH: "text-amber-400 font-semibold",
    URGENT: "text-rose-400 font-bold animate-pulse",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Megaphone className="h-6 w-6 text-indigo-400" />
            Campus Bulletins & Announcements
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Official college circulars, examination alerts, fee notices, academic schedules, and institutional events.
          </p>
        </div>

        {canPost && (
          <button
            onClick={() => {
              if (user?.role === "ACCOUNTANT") {
                setFormData((prev) => ({ ...prev, category: "FEES" }));
              }
              setShowCreateModal(true);
            }}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow-md shadow-indigo-600/20 flex items-center gap-2 transition-colors self-start md:self-auto"
          >
            <Plus className="h-4 w-4" />
            {user?.role === "ACCOUNTANT" ? "Publish Fee Notice" : "Publish Circular"}
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-card/60 p-3 rounded-xl border border-border/60">
        <div className="flex flex-wrap gap-1.5 w-full sm:w-auto">
          {["ALL", "ACADEMIC", "EXAM", "EVENT", "FEES", "ADMINISTRATIVE", "HOLIDAY", "URGENT"].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1 text-xs rounded-lg font-medium transition-all ${
                categoryFilter === cat
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-secondary/40 text-muted-foreground hover:text-foreground hover:bg-secondary/80"
              }`}
            >
              {cat === "ALL" ? "All Categories" : cat.charAt(0) + cat.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search circulars..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-secondary/50 border border-border/60 rounded-lg pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">Loading announcements...</div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center bg-card/40 rounded-xl border border-border/60">
          <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-60" />
          <p className="text-sm font-semibold text-foreground">No circulars found</p>
          <p className="text-xs text-muted-foreground mt-1">
            Try adjusting your search query or category filter.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Pinned Circulars */}
          {pinnedList.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-indigo-400 uppercase tracking-wider">
                <Pin className="h-3.5 w-3.5 rotate-45" /> Pinned & High Priority
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pinnedList.map((ann) => (
                  <div
                    key={ann.id}
                    className="p-5 rounded-xl border border-indigo-500/30 bg-gradient-to-br from-indigo-500/5 via-card/80 to-purple-500/5 shadow-md hover:border-indigo-500/50 transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2.5">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={categoryBadges[ann.category] || ""}>
                            {ann.category}
                          </Badge>
                          <span className={`text-[10px] uppercase font-mono ${priorityColors[ann.priority]}`}>
                            {ann.priority} Priority
                          </span>
                        </div>
                        <Badge variant="secondary" className="text-[10px] bg-indigo-500/10 text-indigo-400">
                          <Pin className="h-2.5 w-2.5 mr-1 inline" /> Pinned
                        </Badge>
                      </div>

                      <h3 className="text-base font-bold text-foreground hover:text-indigo-400 transition-colors">
                        {ann.title}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-2 leading-relaxed whitespace-pre-line">
                        {ann.content}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between text-[11px] text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <User className="h-3 w-3" />
                        <span>{ann.created_by_name || "Campus Authority"}</span>
                      </div>
                      <div className="flex items-center gap-1.5 font-mono text-[10px]">
                        <Clock className="h-3 w-3" />
                        <span>{new Date(ann.published_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Regular Circulars */}
          <div className="space-y-3">
            {pinnedList.length > 0 && (
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Recent Notices
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {regularList.map((ann) => (
                <div
                  key={ann.id}
                  className="p-5 rounded-xl border border-border/60 bg-card/60 hover:bg-card/90 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={categoryBadges[ann.category] || ""}>
                          {ann.category}
                        </Badge>
                        <span className={`text-[10px] uppercase font-mono ${priorityColors[ann.priority]}`}>
                          {ann.priority} Priority
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {ann.target_audience.replace("_", " ")}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-foreground hover:text-indigo-400 transition-colors">
                      {ann.title}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-2 leading-relaxed whitespace-pre-line">
                      {ann.content}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between text-[11px] text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <User className="h-3 w-3" />
                      <span>{ann.created_by_name || "Campus Authority"}</span>
                    </div>
                    <div className="flex items-center gap-1.5 font-mono text-[10px]">
                      <Clock className="h-3 w-3" />
                      <span>{new Date(ann.published_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Publish Announcement Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border/80 rounded-2xl w-full max-w-lg p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <h2 className="text-lg font-bold text-foreground mb-1">Publish Circular / Notice</h2>
            <p className="text-xs text-muted-foreground mb-4">
              Broadcast an official notice to campus cohorts, departments, or entire institution.
            </p>

            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold block mb-1">Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Schedule for Mid-Term Practical Exams"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full bg-secondary/50 border border-border/80 rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                    disabled={user?.role === "ACCOUNTANT"}
                    className="w-full bg-secondary/50 border border-border/80 rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-80"
                  >
                    {user?.role === "ACCOUNTANT" ? (
                      <option value="FEES">Fees & Accounts (Locked to Accountant scope)</option>
                    ) : (
                      <>
                        <option value="ACADEMIC">Academic</option>
                        <option value="EXAM">Examination</option>
                        <option value="EVENT">Campus Event</option>
                        <option value="FEES">Fees & Accounts</option>
                        <option value="ADMINISTRATIVE">Administrative</option>
                        <option value="HOLIDAY">Holiday Notice</option>
                        <option value="URGENT">Urgent Notice</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="font-semibold block mb-1">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                    className="w-full bg-secondary/50 border border-border/80 rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="NORMAL">Normal</option>
                    <option value="HIGH">High Priority</option>
                    <option value="URGENT">Urgent Alert</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold block mb-1">Target Audience</label>
                <select
                  value={formData.target_audience}
                  onChange={(e) => setFormData({ ...formData, target_audience: e.target.value as any })}
                  className="w-full bg-secondary/50 border border-border/80 rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="ENTIRE_COLLEGE">Entire College (All Users)</option>
                  <option value="STUDENTS_ONLY">Students Only</option>
                  <option value="FACULTY_ONLY">Faculty & Staff Only</option>
                  <option value="DEPARTMENT">My Department</option>
                </select>
              </div>

              <div>
                <label className="font-semibold block mb-1">Notice Content *</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Provide comprehensive details for students and staff..."
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className="w-full bg-secondary/50 border border-border/80 rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="pinNotice"
                  checked={formData.is_pinned}
                  onChange={(e) => setFormData({ ...formData, is_pinned: e.target.checked })}
                  className="rounded border-border"
                />
                <label htmlFor="pinNotice" className="cursor-pointer text-xs font-medium">
                  Pin to top of bulletin board
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-border/80 rounded-lg hover:bg-secondary/60 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg shadow-md transition-colors disabled:opacity-50"
                >
                  {submitting ? "Publishing..." : "Publish Circular"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
