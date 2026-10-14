"use client";

import React, { useState } from "react";
import { Lock, Mail, Building2, Shield, ArrowRight, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/api";

const DEMO_ACCOUNTS = [
  { role: "Super Admin", email: "superadmin@campyteq.io", note: "Global Platform Operator & Cross-College Administration", color: "border-purple-500/40 text-purple-300" },
  { role: "Principal", email: "principal@apex.edu", note: "Apex Tech Executive Dashboard & Full Administration", color: "border-indigo-500/40 text-indigo-300" },
  { role: "HOD (CS)", email: "hod.cs@apex.edu", note: "Department Roster & Facility Approvals", color: "border-cyan-500/40 text-cyan-300" },
  { role: "Faculty & Mentor", email: "faculty.priya@apex.edu", note: "Classes, Attendance, Mentees & AI Radar", color: "border-emerald-500/40 text-emerald-300" },
  { role: "Campus Security", email: "security.chief@apex.edu", note: "Perimeter Cameras & AI Face Sightings", color: "border-teal-500/40 text-teal-300" },
  { role: "Student", email: "student.rahul@apex.edu", note: "Academic Hub, Attendance & Schedule", color: "border-amber-500/40 text-amber-300" },
  { role: "Accountant", email: "accountant.raman@apex.edu", note: "Fees, Invoices & Fee Announcements", color: "border-yellow-500/40 text-yellow-300" },
  { role: "Print Staff", email: "printstaff.dev@apex.edu", note: "Print Order Fulfillment & Chat", color: "border-pink-500/40 text-pink-300" },
  { role: "Library Staff", email: "librarystaff.anita@apex.edu", note: "Circulation & Book Requests", color: "border-rose-500/40 text-rose-300" },
];

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("principal@apex.edu");
  const [password, setPassword] = useState("Password123!");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await apiRequest("/auth/token/", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      login({
        access: response.access,
        refresh: response.refresh,
        user: response.user,
      });
    } catch (err: any) {
      setErrorMessage(err.message || "Invalid credentials. Please verify your email and password.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectDemo = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword("Password123!");
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/40 relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-4xl z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold">
            <Building2 className="h-3.5 w-3.5" />
            Enterprise Multi-College SaaS
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            Campy<span className="text-indigo-400">Teq</span>
          </h1>
          <p className="text-sm text-slate-400 font-medium">
            One Campus. One Platform. One Digital Ecosystem.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Main Login Card */}
          <Card className="lg:col-span-6 glass-panel border-indigo-500/20 shadow-2xl">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-lg font-bold">Institutional Sign In</CardTitle>
              <CardDescription className="text-xs">
                Enter your institutional credentials or choose a demo persona below.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {errorMessage && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Official Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="username@institution.edu"
                      className="pl-9 text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-300">Password</label>
                    <span className="text-[11px] text-indigo-400 hover:underline cursor-pointer">
                      Forgot?
                    </span>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="pl-9 text-xs"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                    <input type="checkbox" defaultChecked className="rounded border-border bg-secondary/50 text-indigo-500" />
                    <span>Keep me logged in</span>
                  </label>
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Shield className="h-3 w-3 text-emerald-400" /> 256-Bit Encrypted
                  </span>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  variant="gradient"
                  className="w-full text-xs font-semibold h-10 mt-2"
                >
                  {isLoading ? "Authenticating Persona..." : "Enter Campus Ecosystem"}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Quick Demo Switcher Card */}
          <Card className="lg:col-span-6 glass-panel border-indigo-500/20">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Development Demo Personas</CardTitle>
                <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30">
                  Local Dev Ready
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Click any persona below to quickly test role-tailored dashboards and strict multi-tenant isolation.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 max-h-[340px] overflow-y-auto pr-1">
                {DEMO_ACCOUNTS.map((account) => {
                  const isSelected = email === account.email;
                  return (
                    <button
                      type="button"
                      key={account.email}
                      onClick={() => handleSelectDemo(account.email)}
                      className={`p-2.5 rounded-xl border text-left transition-all relative ${
                        isSelected
                          ? "border-indigo-500 bg-indigo-500/20 shadow-md shadow-indigo-500/10"
                          : "border-border/60 bg-secondary/30 hover:border-indigo-500/40 hover:bg-secondary/60"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground truncate">{account.role}</span>
                        {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-indigo-400 shrink-0" />}
                      </div>
                      <p className="text-[10px] text-indigo-300/80 truncate mt-0.5">{account.email}</p>
                      <p className="text-[9px] text-muted-foreground truncate mt-1">{account.note}</p>
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-300">
                Default Password for all seeded accounts: <code className="font-bold">Password123!</code>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
