"use client";

import React, { useState, useEffect } from "react";
import {
  Calendar,
  Clock,
  MapPin,
  BookOpen,
  UserCheck,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";

interface TimetableItem {
  id: string;
  course_code: string;
  batch_name: string;
  subject_name: string;
  subject_code: string;
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
  const [selectedDay, setSelectedDay] = useState(2); // Tuesday default
  const [schedule, setSchedule] = useState<TimetableItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSchedule() {
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
    }
    loadSchedule();
  }, [selectedDay]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Calendar className="h-7 w-7 text-indigo-400" />
            {user?.role === "FACULTY" ? "Lab Timetable" : "Weekly Academic Timetable"}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {user?.role === "FACULTY"
              ? "Dedicated laboratory practicals and hands-on sessions allocated to your faculty profile."
              : "Scheduled lectures, laboratory practicals, and seminar allocations."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {user?.role === "FACULTY" && (
            <Badge className="text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
              Lab Faculty Only
            </Badge>
          )}
          <Badge variant="outline" className="text-xs border-indigo-500/40 text-indigo-300">
            Batch 2026-2030 • Sem 3
          </Badge>
          <Badge variant="secondary" className="text-xs">
            {schedule.length} Sessions on {DAYS.find((d) => d.id === selectedDay)?.name}
          </Badge>
        </div>
      </div>

      {/* Day Selector Pills */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-2xl bg-secondary/40 border border-border/60">
        {DAYS.map((d) => {
          const isSelected = selectedDay === d.id;
          return (
            <button
              key={d.id}
              onClick={() => setSelectedDay(d.id)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
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
          <Card className="glass-panel text-center p-8">
            <Calendar className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm font-semibold text-foreground">No Classes Scheduled</p>
            <p className="text-xs text-muted-foreground mt-1">
              There are no scheduled lectures for this cohort on {DAYS.find((d) => d.id === selectedDay)?.name}.
            </p>
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
                      <span className="text-xs text-muted-foreground">{slot.course_code}</span>
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
                  <Badge variant="secondary" className="text-xs bg-secondary/80">
                    4 Credits
                  </Badge>
                  <Button size="sm" variant="outline" className="h-8 text-xs border-border/60">
                    Syllabus
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
