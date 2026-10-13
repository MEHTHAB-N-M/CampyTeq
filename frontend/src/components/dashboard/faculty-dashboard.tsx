"use client";

import React from "react";
import {
  BookOpen,
  CalendarCheck,
  FileCheck2,
  Clock,
  MapPin,
  CheckCircle,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

export function FacultyDashboard() {
  const { user } = useAuth();

  const metrics = [
    {
      title: "Today's Classes",
      value: "4 Lectures",
      change: "2 Completed • 2 Upcoming",
      icon: Clock,
      color: "text-indigo-400",
      bg: "bg-indigo-500/10",
    },
    {
      title: "Assigned Subjects",
      value: "3 Courses",
      change: "Data Structures, Algorithms, Python",
      icon: BookOpen,
      color: "text-purple-400",
      bg: "bg-purple-500/10",
    },
    {
      title: "Attendance Marked",
      value: "92.6%",
      change: "BCA & B.Tech CS Batches",
      icon: CalendarCheck,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
    },
    {
      title: "Pending Submissions",
      value: "18",
      change: "Assignment 3: Binary Trees",
      icon: FileCheck2,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
    },
  ];

  const todayClasses = [
    {
      subject: "Data Structures & Algorithms",
      batch: "B.Tech CSE — Year 2, Sem 3",
      time: "09:00 AM - 10:00 AM",
      room: "Hall 304",
      status: "COMPLETED",
    },
    {
      subject: "Advanced Python Programming",
      batch: "BCA — Year 1, Sem 2",
      time: "11:30 AM - 12:30 PM",
      room: "Computer Lab 2",
      status: "IN_PROGRESS",
    },
    {
      subject: "Database Management Systems",
      batch: "B.Tech IT — Year 2, Sem 3",
      time: "02:00 PM - 03:00 PM",
      room: "Lecture Hall B",
      status: "UPCOMING",
    },
    {
      subject: "Algorithms Lab Practical",
      batch: "B.Tech CSE — Year 2, Sem 3",
      time: "03:30 PM - 05:00 PM",
      room: "Lab 04",
      status: "UPCOMING",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-purple-950/60 via-slate-900/60 to-indigo-950/50 border border-purple-500/20 backdrop-blur-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs border-purple-500/40 text-purple-300">
                Department of Computer Science
              </Badge>
              <span className="text-xs text-muted-foreground">{user?.college?.name || "Apex Institute of Tech"}</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white mt-1">
              Welcome, Prof. {user?.first_name} {user?.last_name}!
            </h1>
            <p className="text-sm text-slate-300 mt-0.5">
              Faculty Academic Console. Create attendance sessions and track syllabus completion.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="gradient" size="sm">
              <CalendarCheck className="h-4 w-4 mr-2" /> Mark Attendance
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
                <p className="text-xs text-muted-foreground mt-1">{m.change}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Today's Schedule */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold">Today's Teaching Schedule</CardTitle>
            <CardDescription>Scheduled lectures and laboratory sessions</CardDescription>
          </div>
          <Badge variant="secondary" className="text-xs">
            {todayClasses.length} Sessions Today
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {todayClasses.map((item, index) => (
              <div
                key={index}
                className="p-4 rounded-xl border border-border/60 bg-secondary/30 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:border-indigo-500/40 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">{item.subject}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.batch}</p>
                    <div className="flex items-center gap-4 mt-1 text-xs text-slate-300">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-indigo-400" /> {item.time}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-indigo-400" /> {item.room}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end md:self-center">
                  {item.status === "COMPLETED" && (
                    <Badge variant="success" className="text-xs">
                      <CheckCircle className="h-3 w-3 mr-1" /> Attendance Marked
                    </Badge>
                  )}
                  {item.status === "IN_PROGRESS" && (
                    <Button size="sm" variant="gradient" className="text-xs h-8">
                      Mark Attendance Now
                    </Button>
                  )}
                  {item.status === "UPCOMING" && (
                    <Badge variant="secondary" className="text-xs">
                      Upcoming
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
