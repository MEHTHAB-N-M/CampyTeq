"use client";

import React from "react";
import {
  Users,
  GraduationCap,
  CalendarCheck,
  CreditCard,
  Video,
  AlertTriangle,
  ArrowUpRight,
  ShieldCheck,
  Building,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

export function AdminDashboard() {
  const { user } = useAuth();

  const metrics = [
    {
      title: "Total Students",
      value: "4,821",
      change: "+12% vs last year",
      icon: GraduationCap,
      color: "text-indigo-400",
      bg: "bg-indigo-500/10",
    },
    {
      title: "Total Faculty",
      value: "286",
      change: "Across 6 Departments",
      icon: Users,
      color: "text-purple-400",
      bg: "bg-purple-500/10",
    },
    {
      title: "Campus Attendance",
      value: "85.1%",
      change: "+2.4% this month",
      icon: CalendarCheck,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
    },
    {
      title: "Fee Collection",
      value: "₹28.4L",
      change: "₹8.4L Pending",
      icon: CreditCard,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
    },
    {
      title: "Authorized Cameras",
      value: "14 / 14 Online",
      change: "All Zones Operational",
      icon: Video,
      color: "text-sky-400",
      bg: "bg-sky-500/10",
    },
    {
      title: "System Status",
      value: "Healthy",
      change: "Multi-tenant Isolated",
      icon: ShieldCheck,
      color: "text-teal-400",
      bg: "bg-teal-500/10",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-indigo-950/60 via-slate-900/60 to-purple-950/50 border border-indigo-500/20 backdrop-blur-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs border-indigo-500/40 text-indigo-300">
                {user?.college?.name || "Apex Institute of Technology"}
              </Badge>
              <span className="text-xs text-muted-foreground">Academic Year 2026-2027</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white mt-1">
              Welcome back, {user?.first_name}!
            </h1>
            <p className="text-sm text-slate-300 mt-0.5">
              Institution Command & Analytics Center. All departmental rosters and attendance systems are synchronized.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" className="border-border/60">
              Download Report
            </Button>
            <Button variant="gradient" size="sm">
              Manage Users
            </Button>
          </div>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {metrics.map((m, idx) => {
          const Icon = m.icon;
          return (
            <Card key={idx} className="glass-panel-hover">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {m.title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${m.bg}`}>
                  <Icon className={`h-4 w-4 ${m.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{m.value}</div>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <ArrowUpRight className="h-3 w-3 text-emerald-400 inline" />
                  {m.change}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Operational Highlights & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Department Attendance & Performance</CardTitle>
            <CardDescription>Real-time attendance rates across academic divisions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { name: "Computer Science & Engineering", count: "1,240 Students", rate: 89, color: "bg-indigo-500" },
              { name: "Electronics & Communication", count: "980 Students", rate: 84, color: "bg-purple-500" },
              { name: "Mechanical Engineering", count: "820 Students", rate: 78, color: "bg-sky-500" },
              { name: "Information Technology", count: "940 Students", rate: 91, color: "bg-emerald-500" },
              { name: "Civil Engineering", count: "841 Students", rate: 82, color: "bg-amber-500" },
            ].map((dept, i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-foreground">{dept.name}</span>
                  <span className="text-muted-foreground">{dept.rate}% ({dept.count})</span>
                </div>
                <div className="w-full h-2 rounded-full bg-secondary/80 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${dept.color}`}
                    style={{ width: `${dept.rate}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Security & Camera Zone Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Campus Zone Security</CardTitle>
            <CardDescription>Authorized detection sensors</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="p-3 rounded-lg bg-secondary/40 border border-border/40 flex items-center justify-between">
              <div>
                <p className="font-semibold text-foreground">Main Gate Alpha</p>
                <p className="text-[11px] text-muted-foreground">Zone 1 • Optical RTSP</p>
              </div>
              <Badge variant="success" className="text-[10px]">Online</Badge>
            </div>
            <div className="p-3 rounded-lg bg-secondary/40 border border-border/40 flex items-center justify-between">
              <div>
                <p className="font-semibold text-foreground">Computer Lab 2</p>
                <p className="text-[11px] text-muted-foreground">Zone 4 • Lab Corridor</p>
              </div>
              <Badge variant="success" className="text-[10px]">Online</Badge>
            </div>
            <div className="p-3 rounded-lg bg-secondary/40 border border-border/40 flex items-center justify-between">
              <div>
                <p className="font-semibold text-foreground">Central Library Entry</p>
                <p className="text-[11px] text-muted-foreground">Zone 6 • Circulation</p>
              </div>
              <Badge variant="success" className="text-[10px]">Online</Badge>
            </div>
            <div className="pt-2 text-[11px] text-muted-foreground italic">
              Note: Camera feeds process strictly on authorized premises. Mobile continuous tracking is disabled.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
