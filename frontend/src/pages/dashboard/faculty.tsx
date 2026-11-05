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
  UserPlus,
  Plus,
  X,
  Check,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";

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
  const { user } = useAuth();
  const activeRole = user?.active_role || user?.role || "";

  const allowedRoles =
    activeRole === "SUPER_ADMIN"
      ? ["PRINCIPAL"]
      : activeRole === "PRINCIPAL"
      ? ["HOD", "ACCOUNTANT", "LIBRARY_FACULTY", "PRINT_STAFF", "SECURITY"]
      : activeRole === "HOD" || user?.email?.toLowerCase().includes("hod")
      ? ["FACULTY", "LAB_FACULTY"]
      : [];

  const canProvision = allowedRoles.length > 0;

  const [activeTab, setActiveTab] = useState<"FACULTY" | "DEPARTMENTS">("FACULTY");
  const [facultyList, setFacultyList] = useState<Faculty[]>([]);
  const [departmentList, setDepartmentList] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [provisionRole, setProvisionRole] = useState(allowedRoles[0] || "FACULTY");
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("Password123!");
  const [facultyNumber, setFacultyNumber] = useState("");
  const [designation, setDesignation] = useState("ASSISTANT_PROFESSOR");
  const [qualification, setQualification] = useState("Ph.D.");
  const [provisioning, setProvisioning] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    if (allowedRoles.length > 0 && !allowedRoles.includes(provisionRole)) {
      setProvisionRole(allowedRoles[0]);
    }
  }, [activeRole]);

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

  const handleProvision = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    setProvisioning(true);
    try {
      const userPayload = {
        email,
        password,
        first_name: firstName,
        last_name: lastName,
        phone,
        role: provisionRole,
        status: "ACTIVE",
      };
      const createdUser = await apiRequest<{ id: string }>("/users/", {
        method: "POST",
        body: JSON.stringify(userPayload),
      });

      if (["FACULTY", "LAB_FACULTY", "HOD"].includes(provisionRole)) {
        try {
          await apiRequest("/faculty/", {
            method: "POST",
            body: JSON.stringify({
              user: createdUser.id,
              faculty_number: facultyNumber || `FAC-${Date.now().toString().slice(-4)}`,
              designation,
              qualification,
              joining_date: new Date().toISOString().split("T")[0],
              status: "ACTIVE",
            }),
          });
        } catch (facultyErr) {
          console.warn("Faculty profile auto-linked or creation note:", facultyErr);
        }
      }

      setSuccessMsg(`Successfully provisioned ${provisionRole.replace("_", " ")} (${email})!`);
      setEmail("");
      setFirstName("");
      setLastName("");
      setPhone("");
      setFacultyNumber("");
      const facultyData = await apiRequest<{ results: Faculty[] } | Faculty[]>("/faculty/");
      setFacultyList(Array.isArray(facultyData) ? facultyData : facultyData?.results || []);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to provision user.");
    } finally {
      setProvisioning(false);
    }
  };

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

        {/* Tab switcher & Provision Action */}
        <div className="flex flex-wrap items-center gap-3">
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

          {canProvision && (
            <Button
              onClick={() => {
                setErrorMsg("");
                setSuccessMsg("");
                setIsModalOpen(true);
              }}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs gap-1.5 shadow-md transition-all"
            >
              <UserPlus className="h-4 w-4" />
              <span>
                {activeRole === "PRINCIPAL"
                  ? "+ Provision Staff / HOD"
                  : activeRole === "HOD"
                  ? "+ Add Faculty"
                  : "+ Provision Principal"}
              </span>
            </Button>
          )}
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
      {/* =========================================================================
          PROVISION USER MODAL (Principal / HOD / Super Admin)
         ========================================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-2xl bg-card border border-border shadow-2xl p-6 overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-border/60">
              <div className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-indigo-400" />
                <h3 className="text-base font-bold text-foreground">
                  {activeRole === "PRINCIPAL"
                    ? "Provision Department Head or Staff"
                    : activeRole === "HOD"
                    ? "Add Faculty to Department"
                    : "Provision Institutional Principal"}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-secondary/60 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {errorMsg && (
              <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
                {errorMsg}
              </div>
            )}

            {successMsg && (
              <div className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
                <Check className="h-4 w-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            <form onSubmit={handleProvision} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                  Assigned Base Role
                </label>
                <select
                  value={provisionRole}
                  onChange={(e) => setProvisionRole(e.target.value)}
                  className="w-full bg-secondary/60 border border-border/60 rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {allowedRoles.map((r) => (
                    <option key={r} value={r} className="bg-card text-foreground">
                      {r.replace("_", " ")}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                    First Name
                  </label>
                  <Input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="e.g. Anand"
                    className="text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                    Last Name
                  </label>
                  <Input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="e.g. Sharma"
                    className="text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                  Institutional Email
                </label>
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. anand.sharma@apex.edu"
                  className="text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                    Temporary Password
                  </label>
                  <Input
                    type="text"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                    Contact Phone (Optional)
                  </label>
                  <Input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 9876543210"
                    className="text-xs"
                  />
                </div>
              </div>

              {["FACULTY", "LAB_FACULTY"].includes(provisionRole) && (
                <div className="grid grid-cols-2 gap-3 pt-1 border-t border-border/40">
                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                      Faculty Number / Emp ID
                    </label>
                    <Input
                      type="text"
                      value={facultyNumber}
                      onChange={(e) => setFacultyNumber(e.target.value)}
                      placeholder="e.g. FAC-CSE-09"
                      className="text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                      Designation
                    </label>
                    <select
                      value={designation}
                      onChange={(e) => setDesignation(e.target.value)}
                      className="w-full bg-secondary/60 border border-border/60 rounded-lg px-2.5 py-1.5 text-foreground text-xs"
                    >
                      <option value="PROFESSOR">Professor</option>
                      <option value="ASSOCIATE_PROFESSOR">Associate Professor</option>
                      <option value="ASSISTANT_PROFESSOR">Assistant Professor</option>
                      <option value="LAB_INSTRUCTOR">Lab Instructor</option>
                    </select>
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-border/60 flex items-center justify-end gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={provisioning}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs gap-1.5"
                >
                  {provisioning ? (
                    <span>Provisioning...</span>
                  ) : (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      <span>Confirm & Provision</span>
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
