import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell, Search, Shield, Check, ExternalLink } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/api";
import { Badge } from "@/components/ui/badge";

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  notification_type: string;
  action_url: string;
  is_read: boolean;
  created_at: string;
}

function ParentWardSelector() {
  const [wards, setWards] = useState<any[]>([]);
  const [selectedWard, setSelectedWard] = useState<string>(
    localStorage.getItem("campyteq_selected_ward_id") || ""
  );

  useEffect(() => {
    apiRequest<any[]>("/parent/wards/")
      .then((res) => {
        const list = Array.isArray(res) ? res : (res as any)?.results || [];
        setWards(list);
        if (list.length > 0 && !selectedWard) {
          const firstId = list[0]?.student_id || list[0]?.student?.id || list[0]?.id;
          if (firstId) {
            setSelectedWard(firstId);
            localStorage.setItem("campyteq_selected_ward_id", firstId);
          }
        }
      })
      .catch((err) => console.error("Failed to load parent wards:", err));
  }, []);

  const handleSelect = (id: string) => {
    setSelectedWard(id);
    localStorage.setItem("campyteq_selected_ward_id", id);
    window.dispatchEvent(new CustomEvent("parent_ward_changed", { detail: { wardId: id } }));
  };

  if (wards.length === 0) return <span className="text-[11px] text-muted-foreground">No linked ward</span>;

  return (
    <select
      id="parent-ward-selector"
      aria-label="Select Linked Ward"
      value={selectedWard}
      onChange={(e) => handleSelect(e.target.value)}
      className="bg-transparent text-xs font-semibold text-emerald-300 focus:outline-none cursor-pointer"
    >
      {wards.map((w: any) => {
        const sid = w?.student_id || w?.student?.id || w?.id;
        const sname = w?.name || w?.student?.name || "Ward";
        const sroll = w?.roll_number || w?.student?.roll_number || "";
        return (
          <option key={sid} value={sid} className="bg-card text-foreground">
            {sname} {sroll ? `(${sroll})` : ""}
          </option>
        );
      })}
    </select>
  );
}

export function Header() {
  const { user, logout, switchRole } = useAuth();
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const [listRes, countRes] = await Promise.all([
        apiRequest<any>("/communication/notifications/"),
        apiRequest<{ unread_count: number }>("/communication/notifications/unread_count/"),
      ]);
      const items = listRes?.results || (Array.isArray(listRes) ? listRes : []);
      setNotifications(items.slice(0, 8));
      setUnreadCount(countRes?.unread_count || 0);
    } catch (err) {
      console.error("Failed to load notifications", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 30000); // 30s polling
      return () => clearInterval(interval);
    }
  }, [user]);

  const markAllAsRead = async () => {
    try {
      await apiRequest("/communication/notifications/mark_all_read/", { method: "POST" });
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (err) {
      console.error("Failed to mark all as read", err);
    }
  };

  const handleNotificationClick = async (notif: NotificationItem) => {
    if (!notif.is_read) {
      try {
        await apiRequest(`/communication/notifications/${notif.id}/mark_read/`, { method: "POST" });
        setUnreadCount((c) => Math.max(0, c - 1));
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
        );
      } catch (err) {
        console.error(err);
      }
    }
    setShowNotifications(false);
    if (notif.action_url) {
      navigate(notif.action_url);
    }
  };

  if (!user) return null;

  return (
    <header className="h-16 border-b border-border/60 bg-card/40 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-20">
      {/* Search and context */}
      <div className="flex items-center gap-4 flex-1 max-w-md">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={
              user.role === "PRINT_STAFF"
                ? "Search print orders, pickup PINs..."
                : user.role === "LIBRARY_STAFF"
                ? "Search books, authors, ISBNs..."
                : user.role === "SECURITY"
                ? "Search camera zones, student sighting ID..."
                : user.role === "ACCOUNTANT"
                ? "Search student invoices, roll numbers..."
                : "Search students, faculty, circulars, roll numbers..."
            }
            className="w-full bg-secondary/50 border border-border/60 rounded-lg pl-9 pr-4 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-all"
          />
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-4">
        {/* Parent Ward Selector */}
        {(user.active_role || user.role) === "PARENT" && (
          <div className="flex items-center gap-1.5 bg-secondary/80 border border-emerald-500/30 px-2 py-1 rounded-lg text-xs">
            <span className="text-[11px] text-emerald-400 font-medium">Ward:</span>
            <ParentWardSelector />
          </div>
        )}

        {/* Dynamic Multi-Role Switcher (Section 2 & 14) */}
        {user.available_roles && user.available_roles.filter(r => r.is_active).length > 1 ? (
          <div className="flex items-center gap-1 bg-secondary/80 border border-indigo-500/40 px-2.5 py-1 rounded-lg text-xs shadow-inner">
            <Shield className="h-3.5 w-3.5 text-indigo-400" />
            <span className="text-[10px] text-muted-foreground mr-1 uppercase font-semibold">Active:</span>
            <select
              id="role-switcher-select"
              aria-label="Active Role Switcher"
              value={user.active_role || user.role}
              onChange={(e) => switchRole(e.target.value)}
              className="bg-transparent text-xs font-semibold text-indigo-300 focus:outline-none cursor-pointer"
            >
              {user.available_roles
                .filter((r) => r.is_active)
                .map((r) => (
                  <option key={r.role} value={r.role} className="bg-card text-foreground">
                    {r.role.replace("_", " ")} {r.source === "assignment" ? "(Assignment)" : ""}
                  </option>
                ))}
            </select>
          </div>
        ) : (
          <Badge
            variant="secondary"
            className="text-xs bg-indigo-500/10 text-indigo-300 border-indigo-500/20 font-medium px-2.5 py-1"
          >
            <Shield className="h-3 w-3 mr-1 text-indigo-400 inline" />
            {(user.active_role || user.role).replace("_", " ")}
          </Badge>
        )}

        {/* Real Live Notifications Bell */}
        <div className="relative">
          <button
            onClick={() => {
              setShowNotifications(!showNotifications);
              if (!showNotifications) fetchNotifications();
            }}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary/60 rounded-lg relative transition-colors"
            title="Notifications"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-card animate-pulse">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-84 sm:w-96 rounded-xl border border-border bg-card p-3 shadow-2xl z-50 glass-panel">
              <div className="flex items-center justify-between pb-2 border-b border-border/60">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold">Campus Notifications</span>
                  {unreadCount > 0 && (
                    <Badge variant="outline" className="text-[10px] bg-indigo-500/10 text-indigo-400 border-indigo-500/30">
                      {unreadCount} unread
                    </Badge>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer transition-colors"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div className="mt-2 space-y-1.5 max-h-80 overflow-y-auto pr-1">
                {notifications.length === 0 ? (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    No notifications yet.
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => handleNotificationClick(notif)}
                      className={`p-2.5 rounded-lg border transition-all cursor-pointer text-xs ${
                        notif.is_read
                          ? "bg-secondary/20 border-border/30 opacity-70 hover:opacity-100"
                          : "bg-indigo-500/10 border-indigo-500/30 shadow-sm"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-foreground text-[12px]">{notif.title}</p>
                        {!notif.is_read && (
                          <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0 mt-1" />
                        )}
                      </div>
                      <p className="text-muted-foreground text-[11px] mt-0.5 leading-relaxed">
                        {notif.message}
                      </p>
                      <div className="flex items-center justify-between mt-2 pt-1 border-t border-border/20 text-[10px] text-muted-foreground">
                        <span className="uppercase tracking-wider font-mono text-[9px] text-indigo-400/80">
                          {notif.notification_type.replace("_", " ")}
                        </span>
                        {notif.action_url && (
                          <span className="flex items-center gap-1 text-indigo-400 hover:underline">
                            Open <ExternalLink className="h-2.5 w-2.5" />
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="pt-2 mt-2 border-t border-border/60 text-center">
                <Link
                  to="/dashboard/announcements"
                  onClick={() => setShowNotifications(false)}
                  className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  View all announcements & bulletins →
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* User profile dropdown snippet */}
        <div className="flex items-center gap-3 pl-2 border-l border-border/60">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-semibold text-foreground">{user.full_name}</p>
            <p className="text-[10px] text-muted-foreground">{user.email}</p>
          </div>
          <button
            onClick={logout}
            className="text-xs px-2.5 py-1 text-muted-foreground hover:text-red-400 border border-border/60 rounded-lg hover:bg-red-500/10 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    </header>
  );
}

