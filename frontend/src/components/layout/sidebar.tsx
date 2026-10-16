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
  ExternalLink,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export function Sidebar() {
  const { pathname } = useLocation();
  const { user, logout } = useAuth();

  if (!user) return null;

  const role = user.active_role || user.role;

  // Build navigation items according to active role (Section 11 & 14 spec)
  const navItems = [
    {
      title: role === "PARENT" ? "Ward Dashboard" : "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
      roles: ["SUPER_ADMIN", "PRINCIPAL", "HOD", "FACULTY", "LAB_FACULTY", "CLASS_INCHARGE", "MENTOR", "STUDENT", "PARENT"],
    },
    {
      title: "Mentees (360° Profile)",
      href: "/dashboard/mentorship",
      icon: GraduationCap,
      roles: ["MENTOR", "PRINCIPAL", "SUPER_ADMIN"],
    },
    {
      title: "Students",
      href: "/dashboard/students",
      icon: GraduationCap,
      roles: ["SUPER_ADMIN", "PRINCIPAL", "HOD", "CLASS_INCHARGE", "FACULTY"],
    },
    {
      title: "Faculty & Staff",
      href: "/dashboard/faculty",
      icon: Users,
      roles: ["SUPER_ADMIN", "PRINCIPAL", "HOD"],
    },
    {
      title: ["HOD", "PRINCIPAL", "SUPER_ADMIN"].includes(role) ? "Create & Manage Timetable" : "Timetable",
      href: "/dashboard/timetable",
      icon: CalendarCheck,
      roles: ["SUPER_ADMIN", "PRINCIPAL", "HOD", "FACULTY", "LAB_FACULTY", "CLASS_INCHARGE", "STUDENT", "PARENT"],
    },
    {
      title: role === "PARENT" ? "Ward Marks & Results" : "Exams & Results",
      href: "/dashboard/exams",
      icon: FileSpreadsheet,
      roles: ["SUPER_ADMIN", "PRINCIPAL", "HOD", "FACULTY", "LAB_FACULTY", "CLASS_INCHARGE", "STUDENT", "PARENT"],
    },
    {
      title: "Assignments",
      href: "/dashboard/assignments",
      icon: FileText,
      roles: ["SUPER_ADMIN", "PRINCIPAL", "HOD", "FACULTY", "LAB_FACULTY", "CLASS_INCHARGE", "STUDENT"],
    },
    {
      title: role === "PARENT" ? "Ward Attendance" : "Attendance",
      href: "/dashboard/attendance",
      icon: CalendarCheck,
      roles: ["SUPER_ADMIN", "PRINCIPAL", "HOD", "FACULTY", "LAB_FACULTY", "CLASS_INCHARGE", "STUDENT", "PARENT"],
    },
    {
      title: role === "PARENT" ? "Fee Ledger & Receipts" : "Fees & Invoices",
      href: "/dashboard/fees",
      icon: CreditCard,
      roles: ["SUPER_ADMIN", "PRINCIPAL", "ACCOUNTANT", "STUDENT", "PARENT"],
    },
    {
      title: "Facility Bookings",
      href: "/dashboard/facilities",
      icon: Building,
      roles: ["SUPER_ADMIN", "PRINCIPAL", "HOD", "FACULTY", "LAB_FACULTY", "CLASS_INCHARGE", "MENTOR"],
    },
    {
      title: "Announcements",
      href: "/dashboard/announcements",
      icon: Megaphone,
      roles: ["SUPER_ADMIN", "PRINCIPAL", "HOD", "FACULTY", "LAB_FACULTY", "CLASS_INCHARGE", "STUDENT", "PARENT", "ACCOUNTANT"],
    },
    {
      title: "Leave Requests",
      href: "/dashboard/leave",
      icon: CalendarX,
      roles: ["SUPER_ADMIN", "PRINCIPAL", "HOD", "FACULTY", "LAB_FACULTY", "CLASS_INCHARGE", "STUDENT"],
    },
    {
      title: "Documents & Notes",
      href: "/dashboard/documents",
      icon: FileCheck2,
      roles: ["SUPER_ADMIN", "PRINCIPAL", "HOD", "FACULTY", "LAB_FACULTY", "CLASS_INCHARGE", "STUDENT"],
    },
    {
      title: "Campus Print Shop",
      href: "/dashboard/printshop",
      icon: Printer,
      roles: ["PRINT_STAFF", "STUDENT", "FACULTY", "LAB_FACULTY", "CLASS_INCHARGE", "HOD"],
    },
    {
      title: "Library Bookings",
      href: "/dashboard/library",
      icon: Library,
      roles: ["LIBRARY_FACULTY", "PRINCIPAL", "HOD", "FACULTY", "LAB_FACULTY", "CLASS_INCHARGE", "MENTOR"],
    },
    {
      title: "Authorized Cameras",
      href: "/dashboard/cameras",
      icon: Video,
      roles: ["SECURITY", "SUPER_ADMIN", "PRINCIPAL"],
    },
    {
      title: "Analytics & AI Radar",
      href: "/dashboard/analytics",
      icon: BarChart3,
      roles: ["SUPER_ADMIN", "PRINCIPAL", "HOD", "CLASS_INCHARGE", "MENTOR"],
    },
    {
      title: "Audit Logs",
      href: "/dashboard/audit",
      icon: ShieldCheck,
      roles: ["SUPER_ADMIN", "PRINCIPAL"],
    },
  ];

  const filteredNav = navItems.filter((item) => {
    return item.roles.includes(role);
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

        {/* Super Admin Direct Access to Django Admin */}
        {user.role === "SUPER_ADMIN" && (
          <div className="p-3 mx-3 mb-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
            <div className="flex items-center justify-between text-xs font-semibold text-emerald-300 mb-1">
              <span>Django Admin Portal</span>
              <ExternalLink className="h-3 w-3" />
            </div>
            <p className="text-[10px] text-muted-foreground mb-2">
              Direct access to database models and superuser console.
            </p>
            <a
              href="http://127.0.0.1:8000/admin/"
              target="_blank"
              rel="noreferrer"
              className="w-full py-1.5 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
            >
              Open Django Admin ↗
            </a>
          </div>
        )}
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
