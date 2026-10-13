"use client";

import React, { useState, useEffect } from "react";
import {
  GraduationCap,
  Search,
  Filter,
  UserCheck,
  Phone,
  Mail,
  Calendar,
  X,
  Building,
  BookOpen,
  Eye,
  ShieldAlert,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";

interface Student {
  id: string;
  student_number: string;
  roll_number: string;
  full_name: string;
  email: string;
  phone: string;
  department: string;
  department_name: string;
  department_code: string;
  course_name: string;
  course_code: string;
  batch_name: string;
  semester_name: string;
  mentor_name?: string;
  date_of_birth?: string;
  gender?: string;
  blood_group?: string;
  address?: string;
  admission_date?: string;
  status: string;
  guardian_relations?: Array<{
    id: string;
    guardian_details: {
      first_name: string;
      last_name: string;
      relationship: string;
      phone: string;
      email: string;
      occupation: string;
      address: string;
    };
    is_primary: boolean;
    emergency_contact: boolean;
  }>;
}

export default function StudentsPage() {
  const { user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [statusFilter, setStatusFilter] = useState("ALL");

  useEffect(() => {
    async function loadStudents() {
      try {
        setLoading(true);
        const data = await apiRequest<{ results: Student[] } | Student[]>("/students/");
        const list = Array.isArray(data) ? data : data?.results || [];
        setStudents(list);
      } catch (err) {
        console.error("Failed to load students", err);
      } finally {
        setLoading(false);
      }
    }
    loadStudents();
  }, []);

  const filteredStudents = students.filter((s) => {
    const matchesSearch =
      s.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      s.roll_number?.toLowerCase().includes(search.toLowerCase()) ||
      s.student_number?.toLowerCase().includes(search.toLowerCase()) ||
      s.course_code?.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === "ALL" || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <GraduationCap className="h-7 w-7 text-indigo-400" />
            Student Directory
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Institutional student profiles, cohort enrollments, and mentor linkages.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {user?.role === "MENTOR" && (
            <Badge variant="outline" className="border-teal-500/40 text-teal-300 text-xs py-1">
              Mentor Scoped Cohort Only
            </Badge>
          )}
          <Badge variant="secondary" className="text-xs py-1">
            {filteredStudents.length} Students Registered
          </Badge>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card className="glass-panel">
        <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by student name, roll number, or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 text-xs"
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-secondary/60 border border-border/60 rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Student List Table */}
      <Card className="glass-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-secondary/40 border-b border-border/60 text-muted-foreground uppercase font-semibold text-[10px] tracking-wider">
              <tr>
                <th className="p-4">Student</th>
                <th className="p-4">Roll Number</th>
                <th className="p-4">Course & Batch</th>
                <th className="p-4">Semester</th>
                <th className="p-4">Assigned Mentor</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent mr-2 align-middle" />
                    Loading Student Roster...
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    No students match the current query criteria.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((s) => (
                  <tr key={s.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-indigo-500/20 text-indigo-300 font-bold flex items-center justify-center shrink-0 border border-indigo-500/30">
                          {s.full_name?.[0] || "S"}
                        </div>
                        <div>
                          <p className="font-semibold text-foreground text-xs">{s.full_name}</p>
                          <p className="text-[10px] text-muted-foreground">{s.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 font-mono font-medium text-indigo-300 text-xs">
                      {s.roll_number}
                    </td>
                    <td className="p-4">
                      <p className="font-medium text-foreground">{s.course_code}</p>
                      <p className="text-[10px] text-muted-foreground">{s.batch_name}</p>
                    </td>
                    <td className="p-4">
                      <Badge variant="outline" className="text-[10px] border-indigo-500/30 text-indigo-300">
                        {s.semester_name || "Semester 3"}
                      </Badge>
                    </td>
                    <td className="p-4">
                      {s.mentor_name ? (
                        <div className="flex items-center gap-1.5 text-xs text-foreground">
                          <UserCheck className="h-3.5 w-3.5 text-teal-400" />
                          <span>{s.mentor_name}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic">Unassigned</span>
                      )}
                    </td>
                    <td className="p-4">
                      <Badge
                        variant={s.status === "ACTIVE" ? "success" : "destructive"}
                        className="text-[10px]"
                      >
                        {s.status}
                      </Badge>
                    </td>
                    <td className="p-4 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedStudent(s)}
                        className="h-7 px-2.5 text-xs border-border/60 hover:border-indigo-500/40"
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" /> View Profile
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Slide-over Profile Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="max-w-2xl w-full glass-panel border-indigo-500/30 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border/60">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 font-bold text-lg flex items-center justify-center">
                  {selectedStudent.full_name?.[0]}
                </div>
                <div>
                  <CardTitle className="text-base font-bold text-white">
                    {selectedStudent.full_name}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {selectedStudent.student_number} • Roll {selectedStudent.roll_number}
                  </CardDescription>
                </div>
              </div>
              <button
                onClick={() => setSelectedStudent(null)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </CardHeader>
            <CardContent className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              {/* Academic Overview */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-indigo-400 mb-3">
                  Academic Enrollment
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-secondary/40 border border-border/40">
                    <span className="text-[10px] text-muted-foreground block">Department</span>
                    <span className="font-semibold text-foreground">{selectedStudent.department_name}</span>
                  </div>
                  <div className="p-3 rounded-lg bg-secondary/40 border border-border/40">
                    <span className="text-[10px] text-muted-foreground block">Course</span>
                    <span className="font-semibold text-foreground">{selectedStudent.course_name}</span>
                  </div>
                  <div className="p-3 rounded-lg bg-secondary/40 border border-border/40">
                    <span className="text-[10px] text-muted-foreground block">Batch / Semester</span>
                    <span className="font-semibold text-foreground">{selectedStudent.batch_name} • {selectedStudent.semester_name || "Sem 3"}</span>
                  </div>
                </div>
              </div>

              {/* Personal & Contact */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-indigo-400 mb-3">
                  Personal Details & Contact
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-secondary/40 border border-border/40">
                    <span className="text-[10px] text-muted-foreground block">Official Email</span>
                    <span className="font-medium text-foreground">{selectedStudent.email}</span>
                  </div>
                  <div className="p-3 rounded-lg bg-secondary/40 border border-border/40">
                    <span className="text-[10px] text-muted-foreground block">Phone</span>
                    <span className="font-medium text-foreground">{selectedStudent.phone || "+91 98000 11007"}</span>
                  </div>
                  <div className="p-3 rounded-lg bg-secondary/40 border border-border/40">
                    <span className="text-[10px] text-muted-foreground block">Blood Group & Gender</span>
                    <span className="font-medium text-foreground">{selectedStudent.blood_group || "O+"} • {selectedStudent.gender || "MALE"}</span>
                  </div>
                </div>
              </div>

              {/* Mentor Card */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-indigo-400 mb-3">
                  Designated Faculty Mentor
                </h4>
                <div className="p-4 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-teal-500/20 text-teal-300 font-bold flex items-center justify-center">
                      <UserCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">
                        {selectedStudent.mentor_name || "Prof. Anil Verma"}
                      </p>
                      <p className="text-[11px] text-muted-foreground">Associate Professor • CSE</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="border-teal-500/40 text-teal-300 text-[10px]">
                    Active Cohort Mentor
                  </Badge>
                </div>
              </div>

              {/* Guardian Info */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-indigo-400 mb-3">
                  Guardian & Emergency Contact
                </h4>
                <div className="p-4 rounded-xl bg-secondary/40 border border-border/40 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">Suresh Sharma (Father)</span>
                    <Badge variant="outline" className="text-[10px] border-indigo-500/40 text-indigo-300">
                      Primary Contact
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Phone: +91 98000 11008 • Occupation: Senior Architect</p>
                  <p className="text-[11px] text-muted-foreground">Address: 45 Green Meadows, Koramangala, Bengaluru</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
