"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/api";
import {
  Video,
  ShieldCheck,
  Search,
  Activity,
  MapPin,
  Clock,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Radio,
  Layers,
  Wifi,
  WifiOff,
  Camera as CameraIcon,
  Navigation,
  History,
  Lock,
  Info,
  SlidersHorizontal,
  ChevronRight,
  Eye,
  AlertCircle,
  Sparkles,
  Play,
  Maximize2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface CameraItem {
  id: string;
  code: string;
  name: string;
  zone: string;
  zone_name: string;
  zone_code: string;
  building: string;
  floor: number;
  camera_type: string;
  ip_address: string;
  rtsp_url: string;
  location_description: string;
  status: "ONLINE" | "OFFLINE" | "MAINTENANCE";
  last_heartbeat: string | null;
  resolution: string;
  fps: number;
  is_active: boolean;
}

interface ZoneItem {
  id: string;
  name: string;
  code: string;
  building: string;
  floor: number;
  description: string;
  camera_count: number;
  online_camera_count: number;
  is_active: boolean;
}

interface CameraStats {
  total_cameras: number;
  online_cameras: number;
  offline_cameras: number;
  maintenance_cameras: number;
  system_health_percentage: number;
  total_zones: number;
  active_zones: number;
  recent_detections_24h: number;
}

interface DetectionEventItem {
  id: string;
  camera_code: string;
  camera_name: string;
  zone_name: string;
  zone_code: string;
  building: string;
  floor: number;
  student_name: string;
  student_number: string;
  roll_number: string;
  detected_at: string;
  confidence_score: string | number;
  event_type: string;
  snapshot_url?: string;
}

interface StudentLastSeenResult {
  student: {
    id: string;
    student_number: string;
    roll_number: string;
    full_name: string;
    email: string;
    department: string | null;
    batch: string | null;
    status: string;
  };
  latest_location: {
    zone_name: string;
    zone_code: string;
    building: string;
    floor: number;
    camera_code: string;
    camera_name: string;
    detected_at: string;
    confidence_score: string | number;
  } | null;
  trajectory_history: DetectionEventItem[];
  total_sightings_48h: number;
  disclaimer: string;
}

interface AuditLogItem {
  id: string;
  user_email: string;
  user_name: string;
  user_role: string;
  student_name: string;
  student_number: string;
  roll_number: string;
  action: string;
  reason: string;
  ip_address: string;
  accessed_at: string;
}

export default function CamerasAndTrackingPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"cctv" | "tracker" | "stream" | "zones" | "audit">("cctv");

  // Data states
  const [cameras, setCameras] = useState<CameraItem[]>([]);
  const [zones, setZones] = useState<ZoneItem[]>([]);
  const [stats, setStats] = useState<CameraStats | null>(null);
  const [recentDetections, setRecentDetections] = useState<DetectionEventItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters for CCTV Grid
  const [zoneFilter, setZoneFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Student Tracking Search State
  const [searchQuery, setSearchQuery] = useState("2026-CSE-042");
  const [selectedReason, setSelectedReason] = useState("Routine academic mentorship and attendance follow-up.");
  const [customReason, setCustomReason] = useState("");
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingResult, setTrackingResult] = useState<StudentLastSeenResult | null>(null);
  const [trackingError, setTrackingError] = useState<string | null>(null);

  // Heartbeat action state
  const [pingingCamera, setPingingCamera] = useState<string | null>(null);

  // Live HUD Clock simulation
  const [currentTime, setCurrentTime] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toISOString().replace("T", " ").substring(0, 19) + " UTC");
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch initial data
  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [statsData, camsData, zonesData] = await Promise.all([
        apiRequest("/cameras/stats/").catch(() => null),
        apiRequest("/cameras/cameras/").catch(() => null),
        apiRequest("/cameras/zones/").catch(() => null),
      ]);

      if (statsData) {
        setStats(statsData.data || statsData);
      }
      if (camsData) {
        const list = camsData.results || camsData.data || camsData;
        setCameras(Array.isArray(list) ? list : []);
      }
      if (zonesData) {
        const list = zonesData.results || zonesData.data || zonesData;
        setZones(Array.isArray(list) ? list : []);
      }

      // Load detection stream & audit logs if role is authorized
      if (["PRINCIPAL", "HOD"].includes(user?.role || "")) {
        const [detData, auditData] = await Promise.all([
          apiRequest("/tracking/detections/").catch(() => null),
          apiRequest("/tracking/audit-logs/").catch(() => null),
        ]);
        if (detData) {
          const list = detData.results || detData.data || detData;
          setRecentDetections(Array.isArray(list) ? list : []);
        }
        if (auditData) {
          const list = auditData.results || auditData.data || auditData;
          setAuditLogs(Array.isArray(list) ? list : []);
        }
      }
    } catch (err) {
      console.error("Error loading camera data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  if (user && !["PRINCIPAL", "HOD", "MENTOR"].includes(user.role)) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
        <div className="h-16 w-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
          <AlertCircle className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Restricted Camera & CCTV Access</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          Campus surveillance and location tracking are strictly restricted to Principal, Heads of Department (HOD), and Mentors.
        </p>
      </div>
    );
  }

  useEffect(() => {
    loadDashboardData();
  }, [user]);

  // Execute Last-Detected Location Search
  const handleSearchStudent = async () => {
    const finalReason = customReason.trim().length >= 5 ? customReason.trim() : selectedReason;
    if (!searchQuery.trim()) {
      setTrackingError("Please enter a student roll number or ID.");
      return;
    }
    if (!finalReason || finalReason.length < 5) {
      setTrackingError("An operational reason (minimum 5 characters) is legally required to view detection history.");
      return;
    }

    setTrackingLoading(true);
    setTrackingError(null);
    try {
      const res = await apiRequest(
        `/tracking/last-seen/?student_number=${encodeURIComponent(searchQuery.trim())}&reason=${encodeURIComponent(
          finalReason
        )}`
      );
      if (res?.success) {
        setTrackingResult(res.data);
      } else {
        setTrackingError(res?.message || "Failed to retrieve student location.");
      }
    } catch (err: any) {
      const msg = err.message || "Student not found or access denied for this cohort.";
      setTrackingError(msg);
      setTrackingResult(null);
    } finally {
      setTrackingLoading(false);
    }
  };

  // Trigger Heartbeat Ping
  const handlePingHeartbeat = async (cameraId: string) => {
    setPingingCamera(cameraId);
    try {
      await apiRequest(`/cameras/cameras/${cameraId}/heartbeat/`, {
        method: "POST",
        body: JSON.stringify({
          status: "ONLINE",
          fps: Math.floor(Math.random() * 6) + 25,
        }),
      });
      // Refresh cameras list
      const camsData = await apiRequest("/cameras/cameras/");
      const list = camsData.results || camsData.data || camsData;
      if (Array.isArray(list)) setCameras(list);
    } catch (err) {
      console.error("Failed to ping camera:", err);
    } finally {
      setPingingCamera(null);
    }
  };

  // Filtered cameras
  const filteredCameras = cameras.filter((cam) => {
    if (zoneFilter !== "ALL" && cam.zone_code !== zoneFilter) return false;
    if (statusFilter !== "ALL" && cam.status !== statusFilter) return false;
    return true;
  });

  const isSecurityOrAdmin = ["PRINCIPAL", "HOD"].includes(user?.role || "");

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-primary font-medium text-xs">
            <Radio className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
            <span>Campus Security & Computer Vision Network</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground mt-1 flex items-center gap-2.5">
            <Video className="w-7 h-7 text-primary" />
            Authorized Cameras & Student Detection Hub
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">
            Stationary IP camera feeds, real-time edge detections, and privacy-audited student location tracking.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setRefreshing(true);
              loadDashboardData();
            }}
            disabled={refreshing}
            className="px-3.5 py-1.5 bg-card hover:bg-muted text-foreground text-xs font-semibold rounded-lg border border-border/80 flex items-center gap-2 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Sync Feeds
          </button>
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30 px-3 py-1.5 flex items-center gap-1.5 text-xs font-mono">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Edge mTLS Active</span>
          </Badge>
        </div>
      </div>

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Cameras</span>
            <CameraIcon className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-bold text-foreground">{stats?.total_cameras ?? cameras.length}</div>
          <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
            {stats?.online_cameras ?? cameras.filter((c) => c.status === "ONLINE").length} Online
            <span className="text-muted-foreground/40">•</span>
            <span className="text-amber-500">{stats?.maintenance_cameras ?? 0} Maint</span>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Network Health</span>
            <Activity className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-500">{stats?.system_health_percentage ?? 100}%</div>
          <div className="text-[11px] text-muted-foreground">
            RTSP latency avg: <span className="font-medium text-foreground">38ms</span>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Monitored Zones</span>
            <Layers className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-bold text-foreground">{stats?.total_zones ?? zones.length}</div>
          <div className="text-[11px] text-muted-foreground">
            {stats?.active_zones ?? zones.length} Sectors Active & Monitored
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">24h Sightings</span>
            <Eye className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-bold text-foreground">{stats?.recent_detections_24h ?? 142}</div>
          <div className="text-[11px] text-muted-foreground">Edge YOLO + Face Recognition</div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-border/60 pb-2">
        <button
          onClick={() => setActiveTab("cctv")}
          className={`px-4 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition-all ${
            activeTab === "cctv"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          }`}
        >
          <Video className="w-3.5 h-3.5" />
          Live CCTV Feeds ({cameras.length})
        </button>

        <button
          onClick={() => setActiveTab("tracker")}
          className={`px-4 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition-all ${
            activeTab === "tracker"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          }`}
        >
          <Navigation className="w-3.5 h-3.5 text-emerald-400" />
          Student Location Tracker
        </button>

        {isSecurityOrAdmin && (
          <button
            onClick={() => setActiveTab("stream")}
            className={`px-4 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition-all ${
              activeTab === "stream"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <Radio className="w-3.5 h-3.5 text-rose-400" />
            Real-Time Sighting Stream
          </button>
        )}

        {isSecurityOrAdmin && (
          <button
            onClick={() => setActiveTab("zones")}
            className={`px-4 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition-all ${
              activeTab === "zones"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Zones & Hardware ({zones.length})
          </button>
        )}

        {isSecurityOrAdmin && (
          <button
            onClick={() => setActiveTab("audit")}
            className={`px-4 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition-all ${
              activeTab === "audit"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            Privacy Audit Trail ({auditLogs.length})
          </button>
        )}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: LIVE CCTV FEEDS                                                    */}
      {/* ========================================================================= */}
      {activeTab === "cctv" && (
        <div className="space-y-6">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-card/40 p-4 rounded-xl border border-border/60">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold uppercase">
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Zone:</span>
              </div>
              <select
                value={zoneFilter}
                onChange={(e) => setZoneFilter(e.target.value)}
                className="px-3 py-1.5 bg-background border border-border/70 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="ALL">All Zones ({cameras.length} Cams)</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.code}>
                    {z.name} ({z.code})
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 bg-background border border-border/70 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="ALL">All Statuses</option>
                <option value="ONLINE">Online Only</option>
                <option value="MAINTENANCE">Maintenance</option>
                <option value="OFFLINE">Offline Only</option>
              </select>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span>CCTV CLOCK: {currentTime || "SYNCING..."}</span>
            </div>
          </div>

          {/* Cameras Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCameras.map((camera) => {
              const isOnline = camera.status === "ONLINE";
              const isMaintenance = camera.status === "MAINTENANCE";

              return (
                <div
                  key={camera.id}
                  className="rounded-xl overflow-hidden border border-border/70 bg-card/70 shadow-sm hover:border-primary/40 transition-all flex flex-col justify-between"
                >
                  {/* Simulated Video Canvas Viewport */}
                  <div className="relative aspect-video bg-neutral-950 flex flex-col justify-between p-3 text-white overflow-hidden select-none">
                    {/* Simulated Camera Feed Texture */}
                    <div
                      className={`absolute inset-0 opacity-20 pointer-events-none ${
                        isOnline
                          ? "bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:16px_16px]"
                          : "bg-[radial-gradient(#ef4444_1px,transparent_1px)] [background-size:8px_8px]"
                      }`}
                    />

                    {/* Animated HUD scanline */}
                    {isOnline && (
                      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-500/5 to-transparent h-16 w-full animate-pulse pointer-events-none" />
                    )}

                    {/* HUD Header */}
                    <div className="relative z-10 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {isOnline ? (
                          <div className="flex items-center gap-1.5 bg-rose-950/80 border border-rose-500/40 text-rose-300 text-[10px] font-mono px-2 py-0.5 rounded">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                            <span>REC</span>
                          </div>
                        ) : isMaintenance ? (
                          <div className="flex items-center gap-1.5 bg-amber-950/80 border border-amber-500/40 text-amber-300 text-[10px] font-mono px-2 py-0.5 rounded">
                            <AlertTriangle className="w-3 h-3" />
                            <span>MAINT</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 bg-neutral-900 border border-neutral-700 text-neutral-400 text-[10px] font-mono px-2 py-0.5 rounded">
                            <WifiOff className="w-3 h-3" />
                            <span>SIGNAL LOST</span>
                          </div>
                        )}
                        <span className="text-[11px] font-mono font-bold tracking-wider text-emerald-400 drop-shadow">
                          {camera.code}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[10px] font-mono text-neutral-400">
                        <span>{camera.resolution}</span>
                        <span>•</span>
                        <span>{isOnline ? `${camera.fps} FPS` : "0 FPS"}</span>
                      </div>
                    </div>

                    {/* Center Optical Crosshair */}
                    <div className="relative z-10 flex flex-col items-center justify-center my-auto pointer-events-none">
                      {isOnline ? (
                        <div className="w-14 h-14 border border-white/20 rounded-full flex items-center justify-center">
                          <div className="w-2 h-2 border border-emerald-400/60 rounded-full" />
                        </div>
                      ) : (
                        <div className="text-center space-y-1">
                          <AlertCircle className="w-7 h-7 text-neutral-600 mx-auto" />
                          <p className="text-[11px] font-mono text-neutral-500 uppercase">Camera Inactive</p>
                        </div>
                      )}
                    </div>

                    {/* HUD Footer */}
                    <div className="relative z-10 flex items-end justify-between text-[10px] font-mono text-neutral-300">
                      <div>
                        <div className="text-white font-semibold truncate max-w-[200px]">{camera.name}</div>
                        <div className="text-emerald-300/80 text-[9px] truncate">{camera.zone_name}</div>
                      </div>
                      <div className="text-right text-[9px] text-neutral-400">
                        {currentTime.split(" ")[1] || "LIVE"}
                      </div>
                    </div>
                  </div>

                  {/* Camera Metadata Footer */}
                  <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-primary" />
                        {camera.building} (Flr {camera.floor})
                      </span>
                      <Badge
                        variant="outline"
                        className={
                          isOnline
                            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                            : isMaintenance
                            ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                            : "bg-rose-500/10 text-rose-500 border-rose-500/20"
                        }
                      >
                        {camera.status}
                      </Badge>
                    </div>

                    <p className="text-xs text-muted-foreground line-clamp-1 italic">
                      "{camera.location_description || "Stationary campus perimeter coverage lens"}"
                    </p>

                    <div className="pt-2 border-t border-border/50 flex items-center justify-between">
                      <span className="text-[11px] font-mono text-muted-foreground truncate max-w-[160px]">
                        IP: {camera.ip_address || "DHCP Assigned"}
                      </span>
                      {isSecurityOrAdmin && (
                        <button
                          disabled={pingingCamera === camera.id}
                          onClick={() => handlePingHeartbeat(camera.id)}
                          className="px-2.5 py-1 text-xs font-medium rounded-lg text-primary hover:bg-primary/10 border border-primary/20 flex items-center gap-1 transition-colors"
                        >
                          <RefreshCw className={`w-3 h-3 ${pingingCamera === camera.id ? "animate-spin" : ""}`} />
                          Ping Heartbeat
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: STUDENT LOCATION TRACKER                                           */}
      {/* ========================================================================= */}
      {activeTab === "tracker" && (
        <div className="space-y-6">
          {/* Compliance Notice */}
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3 text-xs md:text-sm text-amber-600 dark:text-amber-400">
            <Info className="w-5 h-5 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">Statutory Privacy & Tracking Safeguard Notice</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                CampyTeq records only <strong>Last Detected Location</strong> based on authorized stationary campus cameras.
                Mobile GPS tracking is strictly forbidden. Every tracking inquiry mandates an operational justification and
                is permanently stored in the institutional privacy audit log.
              </p>
            </div>
          </div>

          {/* Search Bar & Justification Form */}
          <div className="p-5 rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm space-y-4">
            <div className="flex items-center gap-2">
              <Search className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-bold text-foreground">Authorized Student Location Inquiry</h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Search by student roll number or ID. Lookups are restricted to cohort Mentors, Security, and Executive Administration.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {/* Roll Number Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase text-muted-foreground">
                  Student Roll Number or ID
                </label>
                <input
                  type="text"
                  placeholder="e.g. 2026-CSE-042 or STU-2026-0042"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border/70 rounded-lg text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <p className="text-[11px] text-muted-foreground">
                  Quick Select:{" "}
                  <button type="button" onClick={() => setSearchQuery("2026-CSE-042")} className="text-primary underline">
                    Rahul Kumar (2026-CSE-042)
                  </button>
                  ,{" "}
                  <button type="button" onClick={() => setSearchQuery("2026-CSE-015")} className="text-primary underline">
                    Ananya Sen (2026-CSE-015)
                  </button>
                  ,{" "}
                  <button type="button" onClick={() => setSearchQuery("2026-CSE-028")} className="text-primary underline">
                    Rohan Gupta (2026-CSE-028)
                  </button>
                </p>
              </div>

              {/* Justification Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-amber-500" />
                  Mandatory Operational Reason
                </label>
                <select
                  value={selectedReason}
                  onChange={(e) => setSelectedReason(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border/70 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="Routine academic mentorship and attendance follow-up.">
                    Routine Academic Mentorship Follow-up
                  </option>
                  <option value="Parent or guardian urgent safety confirmation.">
                    Parent / Guardian Safety Inquiry
                  </option>
                  <option value="Medical emergency and student welfare locate check.">
                    Medical / Emergency Welfare Check
                  </option>
                  <option value="Examination hall presence verification.">
                    Examination Hall Presence Verification
                  </option>
                  <option value="Campus perimeter security checkpoint protocol.">
                    Perimeter Security Protocol
                  </option>
                  <option value="CUSTOM">Other (Specify Below...)</option>
                </select>
              </div>
            </div>

            {selectedReason === "CUSTOM" && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase text-muted-foreground">
                  Custom Operational Justification (Minimum 5 characters)
                </label>
                <input
                  type="text"
                  placeholder="Enter specific administrative or welfare reason..."
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border/70 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            )}

            {trackingError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{trackingError}</span>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={handleSearchStudent}
                disabled={trackingLoading || !searchQuery.trim()}
                className="px-5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                {trackingLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                {trackingLoading ? "Querying Edge Nodes..." : "Search Last-Detected Location"}
              </button>
            </div>
          </div>

          {/* Sighting Result & Trajectory Timeline */}
          {trackingResult && (
            <div className="space-y-6 animate-in fade-in-50 duration-300">
              {/* Primary Location Card */}
              <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-card via-card to-primary/5 shadow-md overflow-hidden">
                <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-border/60">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center text-xl font-bold text-primary">
                      {trackingResult.student.full_name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl md:text-2xl font-bold text-foreground">
                          {trackingResult.student.full_name}
                        </h2>
                        <Badge variant="outline" className="text-xs font-mono font-bold bg-primary/10 text-primary border-primary/20">
                          {trackingResult.student.roll_number}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {trackingResult.student.department} • {trackingResult.student.batch}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30 px-3 py-1 text-xs uppercase font-bold tracking-wider">
                      ● Active Campus Presence
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {trackingResult.total_sightings_48h} detections recorded in past 48h
                    </p>
                  </div>
                </div>

                {/* Last Seen Details */}
                <div className="p-6 bg-card/40">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-emerald-500" />
                    Last Detected Stationary Camera Sighting
                  </div>

                  {trackingResult.latest_location ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-background/80 p-5 rounded-xl border border-border/80">
                      <div>
                        <div className="text-xs text-muted-foreground">Monitored Zone</div>
                        <div className="text-base font-bold text-foreground mt-0.5">
                          {trackingResult.latest_location.zone_name}
                        </div>
                        <div className="text-xs text-emerald-500 font-mono">
                          {trackingResult.latest_location.zone_code}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs text-muted-foreground">Building & Floor</div>
                        <div className="text-base font-bold text-foreground mt-0.5">
                          {trackingResult.latest_location.building}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Floor {trackingResult.latest_location.floor}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs text-muted-foreground">Sighting Timestamp</div>
                        <div className="text-base font-bold text-foreground mt-0.5 font-mono">
                          {new Date(trackingResult.latest_location.detected_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(trackingResult.latest_location.detected_at).toLocaleDateString()}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs text-muted-foreground">Detection Confidence</div>
                        <div className="text-base font-bold text-emerald-500 mt-0.5">
                          {(Number(trackingResult.latest_location.confidence_score) * 100).toFixed(1)}%
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Camera: {trackingResult.latest_location.camera_code}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 text-center text-muted-foreground text-sm">
                      No stationary detections recorded for this student in the past 48 hours.
                    </div>
                  )}
                </div>
              </div>

              {/* Trajectory Timeline */}
              <div className="p-5 rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm space-y-4">
                <div>
                  <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                    <History className="w-4 h-4 text-primary" />
                    Chronological Detection Breadcrumb Trajectory (Past 48h)
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Sequential camera transit sightings verified by institutional edge face recognition.
                  </p>
                </div>

                <div className="relative border-l-2 border-primary/30 ml-4 space-y-6 py-2">
                  {trackingResult.trajectory_history.map((item, idx) => {
                    const isLatest = idx === 0;
                    const timeStr = new Date(item.detected_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    });

                    return (
                      <div key={item.id} className="relative pl-6">
                        <div
                          className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 ${
                            isLatest
                              ? "bg-emerald-500 border-background shadow-[0_0_8px_rgba(16,185,129,0.6)]"
                              : "bg-card border-primary/50"
                          }`}
                        />

                        <div className="bg-card/90 p-4 rounded-xl border border-border/70 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm font-bold text-foreground">{timeStr}</span>
                              <Badge variant="outline" className="text-[11px] font-mono">
                                {item.zone_code}
                              </Badge>
                              {isLatest && (
                                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px]">
                                  Current Last Seen
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm font-semibold text-foreground mt-1">{item.zone_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.building} (Flr {item.floor}) • Camera: {item.camera_code}
                            </p>
                          </div>

                          <div className="flex items-center gap-4 text-xs">
                            <div className="text-right">
                              <span className="text-muted-foreground">Confidence: </span>
                              <span className="font-mono font-semibold text-emerald-500">
                                {(Number(item.confidence_score) * 100).toFixed(1)}%
                              </span>
                            </div>
                            <Badge variant="outline" className="text-[10px] uppercase text-muted-foreground">
                              {item.event_type.replace("_", " ")}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: REAL-TIME SIGHTING STREAM                                          */}
      {/* ========================================================================= */}
      {activeTab === "stream" && isSecurityOrAdmin && (
        <div className="p-5 rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <Radio className="w-4 h-4 text-rose-500 animate-pulse" />
                Live Edge Camera Sighting Stream
              </h2>
              <p className="text-xs text-muted-foreground">
                Real-time metadata stream dispatched by edge YOLO models across campus zones.
              </p>
            </div>
            <Badge variant="outline" className="text-xs font-mono">
              Showing Latest {recentDetections.length} Events
            </Badge>
          </div>

          <div className="divide-y divide-border/50">
            {recentDetections.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No recent detection events found. Run edge stream simulator to populate live feed.
              </div>
            ) : (
              recentDetections.map((event) => {
                const timeAgo = new Date(event.detected_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                });

                return (
                  <div key={event.id} className="p-4 hover:bg-muted/40 transition-colors flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary text-sm">
                        {event.student_name ? event.student_name[0] : "S"}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-foreground">{event.student_name}</span>
                          <Badge variant="outline" className="text-[10px] font-mono">
                            {event.roll_number}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Sighted at <span className="font-medium text-foreground">{event.zone_name}</span> ({event.building})
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-right">
                      <div>
                        <div className="text-xs font-mono font-semibold text-emerald-500">
                          {(Number(event.confidence_score) * 100).toFixed(1)}% Match
                        </div>
                        <div className="text-[11px] font-mono text-muted-foreground">
                          {event.camera_code} • {timeAgo}
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px] uppercase">
                        {event.event_type.replace("_", " ")}
                      </Badge>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: ZONES & HARDWARE                                                   */}
      {/* ========================================================================= */}
      {activeTab === "zones" && isSecurityOrAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {zones.map((zone) => (
            <div key={zone.id} className="p-5 rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm space-y-3">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-xs font-mono font-bold">
                  {zone.code}
                </Badge>
                <Badge
                  variant="outline"
                  className={zone.is_active ? "bg-emerald-500/10 text-emerald-500" : "bg-neutral-500/10 text-neutral-500"}
                >
                  {zone.is_active ? "Active" : "Disabled"}
                </Badge>
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">{zone.name}</h3>
                <p className="text-xs text-muted-foreground">
                  {zone.building} • Floor {zone.floor}
                </p>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">
                {zone.description || "Campus boundary zone"}
              </p>
              <div className="pt-3 border-t border-border/50 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Assigned Cameras:</span>
                <span className="font-semibold text-foreground">
                  {zone.online_camera_count} / {zone.camera_count} Online
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: PRIVACY AUDIT TRAIL                                                */}
      {/* ========================================================================= */}
      {activeTab === "audit" && isSecurityOrAdmin && (
        <div className="rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm overflow-hidden space-y-3 p-5">
          <div>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-500" />
              Statutory Tracking Access Audit Trail
            </h2>
            <p className="text-xs text-muted-foreground">
              Immutable compliance ledger recording all faculty and security inquiries of student campus movement.
            </p>
          </div>

          <div className="overflow-x-auto pt-2">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/60 text-muted-foreground uppercase font-semibold border-b border-border/60">
                <tr>
                  <th className="p-3 pl-4">Timestamp</th>
                  <th className="p-3">Accessor User</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Target Student</th>
                  <th className="p-3">Stated Institutional Justification</th>
                  <th className="p-3 pr-4">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-muted-foreground">
                      No tracking inquiries recorded yet.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3 pl-4 font-mono text-muted-foreground whitespace-nowrap">
                        {new Date(log.accessed_at).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="p-3 font-medium text-foreground">{log.user_name || log.user_email}</td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-[10px]">
                          {log.user_role}
                        </Badge>
                      </td>
                      <td className="p-3 font-semibold text-foreground">
                        {log.student_name} ({log.roll_number})
                      </td>
                      <td className="p-3 text-muted-foreground max-w-xs truncate" title={log.reason}>
                        "{log.reason}"
                      </td>
                      <td className="p-3 pr-4 font-mono text-muted-foreground">{log.ip_address || "127.0.0.1"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
