"use client";

import React from "react";
import {
  GraduationCap,
  CalendarCheck,
  CreditCard,
  Printer,
  Library,
  Clock,
  MapPin,
  FileText,
  UserCheck,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

export function StudentDashboard() {
  const { user } = useAuth();

  const metrics = [
    {
      title: "Overall Attendance",
      value: "88.4%",
      sub: "Safe (> 75% Requirement)",
      icon: CalendarCheck,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
      badge: "Eligible for Exams",
      badgeVariant: "success" as const,
    },
    {
      title: "Pending Fee Dues",
      value: "₹0.00",
      sub: "Semester 3 All Clear",
      icon: CreditCard,
      color: "text-indigo-400",
      bg: "bg-indigo-500/10",
      badge: "Paid in Full",
      badgeVariant: "info" as const,
    },
    {
      title: "Active Assignments",
      value: "2 Pending",
      sub: "Data Structures & Python",
      icon: FileText,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
      badge: "Due this Friday",
      badgeVariant: "warning" as const,
    },
    {
      title: "Print Orders",
      value: "1 Ready",
      sub: "Project Report (42 Pages)",
      icon: Printer,
      color: "text-purple-400",
      bg: "bg-purple-500/10",
      badge: "Ready at Counter",
      badgeVariant: "default" as const,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Student Profile Card */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900/80 via-indigo-950/40 to-slate-900/80 border border-indigo-500/20 backdrop-blur-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 font-bold text-xl flex items-center justify-center shadow-inner">
              {user?.first_name[0]}
              {user?.last_name ? user.last_name[0] : ""}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs border-indigo-500/40 text-indigo-300">
                  Roll # 2026-CSE-042
                </Badge>
                <span className="text-xs text-muted-foreground">B.Tech CSE • Semester 3</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white mt-1">
                {user?.full_name}
              </h1>
              <p className="text-xs text-slate-300 mt-0.5">
                {user?.college?.name || "Apex Institute of Technology"} • Mentor: Prof. Anil Verma
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm">
              <FileText className="h-4 w-4 mr-1.5" /> Hall Ticket
            </Button>
            <Button variant="gradient" size="sm">
              <Printer className="h-4 w-4 mr-1.5" /> Order Print
            </Button>
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
                <p className="text-xs text-muted-foreground mt-1">{m.sub}</p>
                <div className="mt-3">
                  <Badge variant={m.badgeVariant} className="text-[10px]">
                    {m.badge}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Next Class & Quick Student Services */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Next Class Timeline */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Today's Academic Schedule</CardTitle>
            <CardDescription>Timetable for Tuesday, September 6</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              {
                time: "09:00 AM - 10:00 AM",
                subject: "Data Structures & Algorithms",
                faculty: "Prof. Priya Nair",
                room: "Hall 304",
                status: "Attended",
                variant: "success" as const,
              },
              {
                time: "11:30 AM - 12:30 PM",
                subject: "Database Management Systems",
                faculty: "Dr. Aruna Sundaram",
                room: "Hall 201",
                status: "Next Class",
                variant: "info" as const,
              },
              {
                time: "02:00 PM - 03:30 PM",
                subject: "Software Engineering & Architecture",
                faculty: "Prof. Anil Verma",
                room: "Seminar Hall 1",
                status: "Upcoming",
                variant: "secondary" as const,
              },
            ].map((cls, i) => (
              <div
                key={i}
                className="p-3.5 rounded-xl border border-border/60 bg-secondary/30 flex items-center justify-between hover:border-indigo-500/40 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-foreground">{cls.subject}</h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {cls.faculty} • Room {cls.room}
                    </p>
                    <span className="text-[10px] text-indigo-300 font-medium">{cls.time}</span>
                  </div>
                </div>
                <Badge variant={cls.variant} className="text-xs">
                  {cls.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Quick Portal Links */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Campus Services</CardTitle>
            <CardDescription>Instant access to university resources</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {[
              { title: "Campus Print Shop", desc: "1 order ready for pickup", icon: Printer },
              { title: "Library Circulation", desc: "1 book due in 4 days", icon: Library },
              { title: "Mentor Office Hours", desc: "Connect with Prof. Anil", icon: UserCheck },
              { title: "Fee Receipts & Tax Proof", desc: "Download verified PDFs", icon: CreditCard },
            ].map((service, i) => {
              const Icon = service.icon;
              return (
                <div
                  key={i}
                  className="p-3 rounded-lg bg-secondary/40 border border-border/40 flex items-center justify-between hover:bg-secondary/70 cursor-pointer transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 group-hover:scale-105 transition-transform">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-foreground">{service.title}</p>
                      <p className="text-[11px] text-muted-foreground">{service.desc}</p>
                    </div>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all" />
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
