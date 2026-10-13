import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  CalendarCheck,
  CreditCard,
  Printer,
  Library,
  Video,
  FileText,
  Bell,
  MessageSquare,
  ShieldCheck,
  Settings,
  LogOut,
  Building2,
  Building,
  FileSpreadsheet,
  Megaphone,
  CalendarX,
  FileCheck2,
  BarChart3,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export function Sidebar() {
  const { pathname } = useLocation();
  const { user, logout } = useAuth();

  if (!user) return null;

  const role = user.role;

  // Build navigation items according to current role
  const navItems = [
    {
      title: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
      roles: ["ALL"],
    },
    {
      title: "Students",
      href: "/dashboard/students",
      icon: GraduationCap,
      roles: ["PRINCIPAL", "MANAGEMENT", "HOD", "MENTOR", "FACULTY"],
    },
    {
      title: "Faculty & Staff",
      href: "/dashboard/faculty",
      icon: Users,
      roles: ["PRINCIPAL", "MANAGEMENT", "HOD"],
    },
    {
      title: "Academics & Classes",
      href: "/dashboard/academics",
      icon: BookOpen,
      roles: ["PRINCIPAL", "HOD", "FACULTY", "STUDENT"],
    },
    {
      title: "Timetable",
      href: "/dashboard/timetable",
      icon: CalendarCheck,
      roles: ["PRINCIPAL", "HOD", "MENTOR", "FACULTY", "STUDENT"],
    },
    {
      title: "Exams & Results",
      href: "/dashboard/exams",
      icon: FileSpreadsheet,
      roles: ["PRINCIPAL", "HOD", "FACULTY", "STUDENT", "PARENT"],
    },
    {
      title: "Assignments",
      href: "/dashboard/assignments",
      icon: FileText,
      roles: ["PRINCIPAL", "HOD", "FACULTY", "STUDENT"],
    },
    {
      title: "Attendance",
      href: "/dashboard/attendance",
      icon: CalendarCheck,
      roles: ["PRINCIPAL", "HOD", "MENTOR", "FACULTY", "STUDENT"],
    },
    {
      title: "Fees & Invoices",
      href: "/dashboard/fees",
      icon: CreditCard,
      roles: ["PRINCIPAL", "MANAGEMENT", "ACCOUNTANT", "STUDENT", "PARENT"],
    },
    {
      title: "Payroll & Salary",
      href: "/dashboard/payroll",
      icon: FileSpreadsheet,
      roles: ["PRINCIPAL", "MANAGEMENT"],
    },
    {
      title: "Facility Bookings",
      href: "/dashboard/facilities",
      icon: Building,
      roles: ["PRINCIPAL", "HOD", "MENTOR", "FACULTY"],
    },
    {
      title: "Announcements",
      href: "/dashboard/announcements",
      icon: Megaphone,
      roles: ["ALL"],
    },
    {
      title: "Leave Requests",
      href: "/dashboard/leave",
      icon: CalendarX,
      roles: ["ALL"],
    },
    {
      title: "Messages & Chat",
      href: "/dashboard/messages",
      icon: MessageSquare,
      roles: ["ALL"],
    },
    {
      title: "Documents & Certs",
      href: "/dashboard/documents",
      icon: FileCheck2,
      roles: ["PRINCIPAL", "MANAGEMENT", "HOD", "MENTOR", "FACULTY", "STUDENT"],
    },
    {
      title: "Campus Print Shop",
      href: "/dashboard/printshop",
      icon: Printer,
      roles: ["ALL"],
    },
    {
      title: "Library Catalog",
      href: "/dashboard/library",
      icon: Library,
      roles: ["PRINCIPAL", "LIBRARY_STAFF", "MENTOR", "FACULTY", "STUDENT"],
    },
    {
      title: "Authorized Cameras",
      href: "/dashboard/cameras",
      icon: Video,
      roles: ["PRINCIPAL", "HOD", "MENTOR", "FACULTY", "SECURITY"],
    },
    {
      title: "Analytics & AI Radar",
      href: "/dashboard/analytics",
      icon: BarChart3,
      roles: ["PRINCIPAL", "MANAGEMENT", "HOD", "MENTOR", "FACULTY"],
    },
    {
      title: "Audit Logs",
      href: "/dashboard/audit",
      icon: ShieldCheck,
      roles: ["PRINCIPAL"],
    },
  ];

  const filteredNav = navItems.filter((item) => {
    if (role === "PRINCIPAL" && item.href === "/dashboard/printshop") {
      return false;
    }
    return item.roles.includes("ALL") || item.roles.includes(role) || role === "SUPER_ADMIN";
  });

  return (
    <aside className="w-64 border-r border-border bg-card/60 backdrop-blur-xl flex flex-col justify-between h-screen sticky top-0">
      <div>
        {/* Brand Header */}
        <div className="p-5 border-b border-border/60 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-600 flex items-center justify-center text-white font-bold shadow-md shadow-indigo-500/20">
              CT
            </div>
            <div>
              <span className="font-bold tracking-tight text-foreground text-lg block leading-none">
                Campy<span className="text-indigo-400">Teq</span>
              </span>
              <span className="text-[10px] text-muted-foreground tracking-wider font-semibold uppercase block mt-1">
                Unified Ecosystem
              </span>
            </div>
          </Link>
        </div>

        {/* Tenant College Indicator */}
        <div className="px-4 py-3 border-b border-border/40 bg-secondary/30">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-indigo-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground truncate">
                {user.college?.name || "Campus Administration"}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4 border-indigo-500/40 text-indigo-300">
                  {user.college?.code || "SAAS-ROOT"}
                </Badge>
                <span className="text-[10px] text-emerald-400 font-medium">● Isolated</span>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation list */}
        <div className="p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-280px)]">
          <p className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Main Navigation
          </p>
          {filteredNav.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all group",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm shadow-indigo-500/25 font-semibold"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-colors",
                    isActive ? "text-white" : "text-muted-foreground group-hover:text-indigo-400"
                  )}
                />
                <span>{item.title}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Footer User Info & Logout */}
      <div className="p-4 border-t border-border/60 bg-card/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-8 w-8 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 font-semibold text-xs flex items-center justify-center">
              {user.first_name[0]}
              {user.last_name ? user.last_name[0] : ""}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">
                {user.full_name}
              </p>
              <p className="text-[10px] text-indigo-400 font-medium uppercase truncate">
                {user.role.replace("_", " ")}
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            title="Sign Out"
            className="p-1.5 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
