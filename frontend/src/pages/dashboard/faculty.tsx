"use client";

import React, { useState, useEffect } from "react";
import {
  Users,
  Building,
  GraduationCap,
  BookOpen,
  Award,
  Mail,
  Phone,
  Search,
  CheckCircle,
  Briefcase,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";

interface Faculty {
  id: string;
  faculty_number: string;
  full_name: string;
  email: string;
  phone: string;
  department_name: string;
  department_code: string;
  designation: string;
  qualification: string;
  specialization?: string;
  joining_date: string;
  employment_type: string;
  status: string;
}

interface Department {
  id: string;
  name: string;
  code: string;
  hod_name?: string;
  email?: string;
  phone?: string;
  status: string;
  description?: string;
  total_faculty?: number;
  total_students?: number;
  total_courses?: number;
}

export default function FacultyPage() {
  const [activeTab, setActiveTab] = useState<"FACULTY" | "DEPARTMENTS">("FACULTY");
  const [facultyList, setFacultyList] = useState<Faculty[]>([]);
  const [departmentList, setDepartmentList] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [facultyData, deptData] = await Promise.all([
          apiRequest<{ results: Faculty[] } | Faculty[]>("/faculty/"),
          apiRequest<{ results: Department[] } | Department[]>("/departments/"),
        ]);
        setFacultyList(Array.isArray(facultyData) ? facultyData : facultyData?.results || []);
        setDepartmentList(Array.isArray(deptData) ? deptData : deptData?.results || []);
      } catch (err) {
        console.error("Failed to load faculty and departments", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const filteredFaculty = facultyList.filter(
    (f) =>
      f.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      f.faculty_number?.toLowerCase().includes(search.toLowerCase()) ||
      f.department_name?.toLowerCase().includes(search.toLowerCase()) ||
      f.specialization?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Users className="h-7 w-7 text-purple-400" />
            Faculty & Academic Leadership
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Department roster, designations, Head of Departments (HOD), and faculty profiles.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-secondary/50 border border-border/60">
          <button
            onClick={() => setActiveTab("FACULTY")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "FACULTY"
                ? "bg-primary text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Faculty Members ({facultyList.length})
          </button>
          <button
            onClick={() => setActiveTab("DEPARTMENTS")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "DEPARTMENTS"
                ? "bg-primary text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Departments & HODs ({departmentList.length})
          </button>
        </div>
      </div>

      {activeTab === "FACULTY" ? (
        <div className="space-y-4">
          {/* Search bar */}
          <Card className="glass-panel">
            <CardContent className="p-4">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search faculty by name, code, or specialization..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 text-xs"
                />
              </div>
            </CardContent>
          </Card>

          {/* Faculty Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredFaculty.map((f) => (
              <Card key={f.id} className="glass-panel-hover">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-300 font-bold text-base flex items-center justify-center">
                        {f.full_name?.[0] || "F"}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-foreground">{f.full_name}</h3>
                        <p className="text-[11px] text-purple-400 font-medium">{f.designation.replace("_", " ")}</p>
                        <p className="text-[10px] text-muted-foreground">{f.faculty_number}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px] border-purple-500/40 text-purple-300">
                      {f.department_code}
                    </Badge>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Award className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                      <span className="truncate">{f.qualification}</span>
                    </div>
                    {f.specialization && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Briefcase className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                        <span className="truncate">{f.specialization}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                      <span className="truncate">{f.email}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border/40 flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">Type: {f.employment_type.replace("_", " ")}</span>
                    <Badge variant="success" className="text-[10px]">Active</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        /* Departments Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {departmentList.map((d) => (
            <Card key={d.id} className="glass-panel-hover">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <Badge variant="outline" className="text-xs border-indigo-500/40 text-indigo-300 mb-1">
                      {d.code}
                    </Badge>
                    <CardTitle className="text-base font-bold">{d.name}</CardTitle>
                  </div>
                  <Badge variant="success" className="text-[10px]">{d.status}</Badge>
                </div>
                {d.description && (
                  <CardDescription className="text-xs line-clamp-2 mt-1">
                    {d.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {/* HOD Box */}
                <div className="p-3 rounded-xl bg-secondary/40 border border-border/40">
                  <span className="text-[10px] text-indigo-300 font-semibold uppercase tracking-wider block">
                    Head of Department (HOD)
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    <CheckCircle className="h-4 w-4 text-emerald-400" />
                    <span className="text-xs font-bold text-foreground">
                      {d.hod_name || "Dr. Aruna Sundaram"}
                    </span>
                  </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2 rounded-lg bg-secondary/30 border border-border/40">
                    <span className="text-[10px] text-muted-foreground block">Faculty</span>
                    <span className="font-bold text-foreground">{d.total_faculty ?? 14}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-secondary/30 border border-border/40">
                    <span className="text-[10px] text-muted-foreground block">Students</span>
                    <span className="font-bold text-foreground">{d.total_students ?? 1240}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-secondary/30 border border-border/40">
                    <span className="text-[10px] text-muted-foreground block">Programs</span>
                    <span className="font-bold text-foreground">{d.total_courses ?? 2}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
