"use client";

import React, { useState, useEffect } from "react";
import {
  BookOpen,
  Calendar,
  Layers,
  ChevronRight,
  Clock,
  GraduationCap,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/api";

interface Course {
  id: string;
  name: string;
  code: string;
  department_name: string;
  degree_level: string;
  duration_years: number;
  total_semesters: number;
  status: string;
  batches?: Array<{
    id: string;
    name: string;
    academic_year: string;
    status: string;
    total_students: number;
    semesters?: Array<{
      id: string;
      semester_number: number;
      name: string;
      is_current: boolean;
    }>;
  }>;
}

export default function AcademicsPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAcademics() {
      try {
        setLoading(true);
        const data = await apiRequest<{ results: Course[] } | Course[]>("/academics/courses/");
        const list = Array.isArray(data) ? data : data?.results || [];
        setCourses(list);
      } catch (err) {
        console.error("Failed to load courses", err);
      } finally {
        setLoading(false);
      }
    }
    loadAcademics();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <BookOpen className="h-7 w-7 text-indigo-400" />
            Academics & Program Hierarchy
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Degree programs, curriculum duration, cohort batches, and active semesters.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-indigo-500/40 text-indigo-300 text-xs py-1">
            Department ➔ Course ➔ Batch ➔ Semester
          </Badge>
        </div>
      </div>

      {/* Courses List */}
      <div className="space-y-6">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent mr-2 align-middle" />
            Loading Academic Structure...
          </div>
        ) : (
          courses.map((course) => (
            <Card key={course.id} className="glass-panel overflow-hidden">
              <CardHeader className="border-b border-border/40 pb-4 bg-secondary/20">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 font-bold flex items-center justify-center shrink-0">
                      <GraduationCap className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] border-indigo-500/40 text-indigo-300">
                          {course.code}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{course.department_name}</span>
                      </div>
                      <CardTitle className="text-base font-bold text-foreground mt-0.5">
                        {course.name}
                      </CardTitle>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {course.duration_years} Years ({course.total_semesters} Semesters)
                    </Badge>
                    <Badge variant="success" className="text-xs">
                      {course.status}
                    </Badge>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-6">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-indigo-400" />
                  Active Batches & Semesters
                </h4>

                {course.batches && course.batches.length > 0 ? (
                  <div className="space-y-4">
                    {course.batches.map((batch) => (
                      <div
                        key={batch.id}
                        className="p-4 rounded-xl bg-secondary/40 border border-border/40 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-foreground">{batch.name}</span>
                            <span className="text-[10px] text-muted-foreground">({batch.academic_year})</span>
                          </div>
                          <Badge variant="outline" className="text-[10px] border-border/60">
                            {batch.total_students} Enrolled Students
                          </Badge>
                        </div>

                        {/* Semesters Pills */}
                        <div className="flex flex-wrap gap-2 pt-1">
                          {batch.semesters && batch.semesters.length > 0 ? (
                            batch.semesters.map((sem) => (
                              <div
                                key={sem.id}
                                className={`px-3 py-1.5 rounded-lg border text-xs flex items-center gap-1.5 ${
                                  sem.is_current
                                    ? "bg-indigo-500/20 border-indigo-500/50 text-indigo-300 font-semibold shadow-sm"
                                    : "bg-secondary/60 border-border/60 text-muted-foreground"
                                }`}
                              >
                                <span>{sem.name}</span>
                                {sem.is_current && (
                                  <Badge variant="success" className="text-[8px] py-0 px-1 h-3.5 leading-none">
                                    Current
                                  </Badge>
                                )}
                              </div>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground italic">
                              Semesters 1 through {course.total_semesters}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-secondary/20 border border-border/40 text-xs text-muted-foreground">
                    Batch 2026-2030 (Active • Academic Year 2026-2027) with Semesters 1 through {course.total_semesters}.
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
