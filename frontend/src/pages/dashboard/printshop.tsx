"use client";

import React, { useState, useEffect } from "react";
import {
  Printer,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  Layers,
  Sparkles,
  Download,
  IndianRupee,
  PackageCheck,
  Play,
  RotateCcw,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/api";
import { Badge } from "@/components/ui/badge";

interface PrintOrder {
  id: string;
  order_number: string;
  user: string;
  user_name: string;
  user_email: string;
  user_role: string;
  document_name: string;
  file_url: string;
  page_count: number;
  copies: number;
  print_color: "BW" | "COLOR";
  print_side: "SINGLE" | "DUPLEX";
  paper_size: "A4" | "A3";
  binding_type: "NONE" | "STAPLE" | "SPIRAL" | "HARD_BINDING";
  lamination: boolean;
  special_instructions: string;
  total_amount: string;
  payment_status: "PENDING" | "PAID" | "ON_PICKUP";
  status: "PENDING" | "QUEUED" | "PRINTING" | "READY_FOR_PICKUP" | "COMPLETED" | "CANCELLED";
  handled_by_name?: string;
  created_at: string;
}

export default function PrintShopPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<PrintOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"MY_ORDERS" | "STATION_QUEUE">("MY_ORDERS");
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // New Print Order Form State
  const [formData, setFormData] = useState({
    document_name: "",
    file_url: "/printshop/sample_upload.pdf",
    page_count: 10,
    copies: 1,
    print_color: "BW",
    print_side: "DUPLEX",
    paper_size: "A4",
    binding_type: "SPIRAL",
    lamination: false,
    special_instructions: "",
    payment_status: "ON_PICKUP",
  });
  const [submitting, setSubmitting] = useState(false);

  const isPrintStaff = ["PRINT_STAFF", "PRINCIPAL"].includes(user?.role || "");

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await apiRequest<any>("/printshop/orders/");
      const items = res?.results || (Array.isArray(res) ? res : []);
      setOrders(items);
    } catch (err) {
      console.error("Failed to load print orders", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // Client-side cost estimate for interactive preview
  const calculateEstimatedCost = () => {
    const ratePerPage = formData.print_color === "COLOR" ? 10 : 2;
    const sizeMultiplier = formData.paper_size === "A3" ? 1.8 : 1.0;
    const totalPages = formData.page_count * formData.copies;
    let base = totalPages * ratePerPage * sizeMultiplier;

    if (formData.print_side === "DUPLEX") {
      base = base * 0.9; // 10% duplex discount
    }

    let bindingCost = 0;
    if (formData.binding_type === "SPIRAL") bindingCost = 30 * formData.copies;
    else if (formData.binding_type === "HARD_BINDING") bindingCost = 150 * formData.copies;

    let laminationCost = formData.lamination ? 30 * formData.copies : 0;

    return Math.round((base + bindingCost + laminationCost) * 100) / 100;
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await apiRequest("/printshop/orders/", {
        method: "POST",
        body: JSON.stringify(formData),
      });
      setShowOrderModal(false);
      setFormData({
        document_name: "",
        file_url: "/printshop/sample_upload.pdf",
        page_count: 10,
        copies: 1,
        print_color: "BW",
        print_side: "DUPLEX",
        paper_size: "A4",
        binding_type: "SPIRAL",
        lamination: false,
        special_instructions: "",
        payment_status: "ON_PICKUP",
      });
      fetchOrders();
    } catch (err) {
      console.error("Failed to submit print job", err);
      alert("Failed to submit print job.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
    try {
      setActionLoading(true);
      await apiRequest(`/printshop/orders/${orderId}/update_status/`, {
        method: "POST",
        body: JSON.stringify({ status: newStatus }),
      });
      fetchOrders();
    } catch (err) {
      console.error("Failed to update status", err);
      alert("Failed to transition order status.");
    } finally {
      setActionLoading(false);
    }
  };

  const myOrders = orders.filter((o) => o.user === user?.id || o.user_email === user?.email);
  const queueOrders = orders.filter(
    (o) => o.status === "QUEUED" || o.status === "PRINTING" || o.status === "READY_FOR_PICKUP"
  );

  const statusBadges: Record<string, { label: string; badge: string }> = {
    QUEUED: { label: "In Queue", badge: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
    PRINTING: { label: "Printing...", badge: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
    READY_FOR_PICKUP: {
      label: "Ready for Pickup",
      badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 animate-pulse",
    },
    COMPLETED: { label: "Completed", badge: "bg-slate-500/10 text-slate-300 border-slate-500/30" },
    CANCELLED: { label: "Cancelled", badge: "bg-rose-500/10 text-rose-400 border-rose-500/30" },
    PENDING: { label: "Pending", badge: "bg-purple-500/10 text-purple-400 border-purple-500/30" },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Printer className="h-6 w-6 text-indigo-400" />
            Campus Print Station
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Fast, high-quality printing, automated duplex discounts, spiral binding, and live pickup tracking.
          </p>
        </div>

        <button
          onClick={() => setShowOrderModal(true)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow-md shadow-indigo-600/20 flex items-center gap-2 transition-colors self-start md:self-auto"
        >
          <Plus className="h-4 w-4" />
          Send New Print Job
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-border/60 bg-card/60 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">Total Print Orders</p>
            <p className="text-xl font-bold text-foreground">{orders.length}</p>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border/60 bg-card/60 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-400">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">In Queue / Printing</p>
            <p className="text-xl font-bold text-blue-400">
              {orders.filter((o) => o.status === "QUEUED" || o.status === "PRINTING").length}
            </p>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border/60 bg-card/60 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400">
            <PackageCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">Ready for Pickup</p>
            <p className="text-xl font-bold text-emerald-400">
              {orders.filter((o) => o.status === "READY_FOR_PICKUP").length}
            </p>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border/60 bg-card/60 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-slate-500/10 text-slate-300">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">Completed Jobs</p>
            <p className="text-xl font-bold text-slate-300">
              {orders.filter((o) => o.status === "COMPLETED").length}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border/60 pb-2">
        <button
          onClick={() => setActiveTab("MY_ORDERS")}
          className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
            activeTab === "MY_ORDERS"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
          }`}
        >
          My Print Orders ({myOrders.length})
        </button>

        {isPrintStaff && (
          <button
            onClick={() => setActiveTab("STATION_QUEUE")}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === "STATION_QUEUE"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
            }`}
          >
            Station Queue Manager
            {queueOrders.length > 0 && (
              <span className="h-4 px-1.5 rounded-full bg-indigo-500 text-white text-[10px] font-bold">
                {queueOrders.length}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">Loading print orders...</div>
      ) : activeTab === "STATION_QUEUE" ? (
        /* Staff View: Station Queue Manager */
        <div className="space-y-4">
          {queueOrders.length === 0 ? (
            <div className="py-16 text-center bg-card/40 rounded-xl border border-border/60">
              <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-2 opacity-80" />
              <p className="text-sm font-semibold text-foreground">Print Queue Empty</p>
              <p className="text-xs text-muted-foreground mt-1">
                No active print orders waiting in the station queue.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {queueOrders.map((ord) => (
                <div
                  key={ord.id}
                  className="p-5 rounded-xl border border-border/60 bg-card/60 flex flex-col justify-between shadow-sm"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="font-mono text-xs font-bold text-indigo-400">
                        {ord.order_number}
                      </span>
                      <Badge variant="outline" className={statusBadges[ord.status]?.badge}>
                        {statusBadges[ord.status]?.label}
                      </Badge>
                    </div>

                    <h3 className="font-bold text-sm text-foreground mb-1">{ord.document_name}</h3>
                    <p className="text-xs text-muted-foreground mb-3">
                      Ordered by: <strong className="text-foreground">{ord.user_name}</strong> (
                      {ord.user_role})
                    </p>

                    <div className="grid grid-cols-2 gap-2 text-xs bg-secondary/30 p-3 rounded-lg border border-border/40 font-mono">
                      <div>
                        <span className="text-muted-foreground text-[10px] block">PAGES & COPIES</span>
                        <span>
                          {ord.page_count} pgs × {ord.copies} {ord.copies === 1 ? "copy" : "copies"}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-[10px] block">SPECIFICATION</span>
                        <span>
                          {ord.print_color} • {ord.print_side}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-[10px] block">BINDING & LAMINATE</span>
                        <span>
                          {ord.binding_type} {ord.lamination ? "+ Lam" : ""}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-[10px] block">BILL AMOUNT</span>
                        <span className="font-bold text-foreground">₹{ord.total_amount}</span>
                      </div>
                    </div>

                    {ord.special_instructions && (
                      <p className="text-[11px] text-amber-400/90 mt-2 italic bg-amber-500/5 p-2 rounded border border-amber-500/20">
                        Note: &quot;{ord.special_instructions}&quot;
                      </p>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-end gap-2">
                    {ord.status === "QUEUED" && (
                      <button
                        onClick={() => handleUpdateStatus(ord.id, "PRINTING")}
                        disabled={actionLoading}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
                      >
                        <Play className="h-3.5 w-3.5" /> Start Printing
                      </button>
                    )}

                    {ord.status === "PRINTING" && (
                      <button
                        onClick={() => handleUpdateStatus(ord.id, "READY_FOR_PICKUP")}
                        disabled={actionLoading}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
                      >
                        <PackageCheck className="h-3.5 w-3.5" /> Mark Ready for Pickup
                      </button>
                    )}

                    {ord.status === "READY_FOR_PICKUP" && (
                      <button
                        onClick={() => handleUpdateStatus(ord.id, "COMPLETED")}
                        disabled={actionLoading}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Complete & Collect
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* My Orders View */
        <div className="space-y-4">
          {myOrders.length === 0 ? (
            <div className="py-16 text-center bg-card/40 rounded-xl border border-border/60">
              <Printer className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-60" />
              <p className="text-sm font-semibold text-foreground">No print orders yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Upload your assignments or manuals to send your first print job.
              </p>
            </div>
          ) : (
            <div className="bg-card/60 rounded-xl border border-border/60 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-secondary/40 border-b border-border/60 text-muted-foreground">
                  <tr>
                    <th className="p-3.5 font-semibold">Order ID</th>
                    <th className="p-3.5 font-semibold">Document</th>
                    <th className="p-3.5 font-semibold">Specs</th>
                    <th className="p-3.5 font-semibold">Cost</th>
                    <th className="p-3.5 font-semibold">Status</th>
                    <th className="p-3.5 font-semibold">Submission Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {myOrders.map((ord) => (
                    <tr key={ord.id} className="hover:bg-secondary/20 transition-colors">
                      <td className="p-3.5 font-mono font-bold text-indigo-400">{ord.order_number}</td>
                      <td className="p-3.5">
                        <p className="font-semibold text-foreground">{ord.document_name}</p>
                        <span className="text-[10px] text-muted-foreground">
                          {ord.page_count} pages • {ord.copies} {ord.copies === 1 ? "copy" : "copies"}
                        </span>
                      </td>
                      <td className="p-3.5 text-muted-foreground">
                        <span className="inline-block px-1.5 py-0.5 rounded bg-secondary/80 text-[10px] mr-1">
                          {ord.print_color}
                        </span>
                        <span className="inline-block px-1.5 py-0.5 rounded bg-secondary/80 text-[10px] mr-1">
                          {ord.print_side}
                        </span>
                        <span className="inline-block px-1.5 py-0.5 rounded bg-secondary/80 text-[10px]">
                          {ord.binding_type}
                        </span>
                      </td>
                      <td className="p-3.5 font-bold text-foreground">₹{ord.total_amount}</td>
                      <td className="p-3.5">
                        <Badge variant="outline" className={statusBadges[ord.status]?.badge}>
                          {statusBadges[ord.status]?.label}
                        </Badge>
                      </td>
                      <td className="p-3.5 text-muted-foreground font-mono text-[11px]">
                        {new Date(ord.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* New Print Order Modal with Realtime Price Estimate */}
      {showOrderModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border/80 rounded-2xl w-full max-w-lg p-6 shadow-2xl animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-foreground mb-1">Submit Print Job</h2>
            <p className="text-xs text-muted-foreground mb-4">
              Configure layout, binding, and color preferences. Instant pricing is calculated automatically.
            </p>

            <form onSubmit={handleCreateOrder} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold block mb-1">Document Name / File *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Distributed_Systems_Project_Report.pdf"
                  value={formData.document_name}
                  onChange={(e) => setFormData({ ...formData, document_name: e.target.value })}
                  className="w-full bg-secondary/50 border border-border/80 rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Page Count *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.page_count}
                    onChange={(e) => setFormData({ ...formData, page_count: parseInt(e.target.value) || 1 })}
                    className="w-full bg-secondary/50 border border-border/80 rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Number of Copies *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.copies}
                    onChange={(e) => setFormData({ ...formData, copies: parseInt(e.target.value) || 1 })}
                    className="w-full bg-secondary/50 border border-border/80 rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Color Mode</label>
                  <select
                    value={formData.print_color}
                    onChange={(e) => setFormData({ ...formData, print_color: e.target.value as any })}
                    className="w-full bg-secondary/50 border border-border/80 rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="BW">Black & White (₹2 / page)</option>
                    <option value="COLOR">Full Color (₹10 / page)</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold block mb-1">Print Layout</label>
                  <select
                    value={formData.print_side}
                    onChange={(e) => setFormData({ ...formData, print_side: e.target.value as any })}
                    className="w-full bg-secondary/50 border border-border/80 rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="DUPLEX">Double Sided / Duplex (10% Off)</option>
                    <option value="SINGLE">Single Sided</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Binding</label>
                  <select
                    value={formData.binding_type}
                    onChange={(e) => setFormData({ ...formData, binding_type: e.target.value as any })}
                    className="w-full bg-secondary/50 border border-border/80 rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="NONE">No Binding</option>
                    <option value="STAPLE">Corner Staple (Free)</option>
                    <option value="SPIRAL">Spiral Coil Binding (+₹30)</option>
                    <option value="HARD_BINDING">Hardcover Book Binding (+₹150)</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold block mb-1">Paper Size</label>
                  <select
                    value={formData.paper_size}
                    onChange={(e) => setFormData({ ...formData, paper_size: e.target.value as any })}
                    className="w-full bg-secondary/50 border border-border/80 rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="A4">Standard A4</option>
                    <option value="A3">Large A3 (1.8x)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="laminationCheck"
                  checked={formData.lamination}
                  onChange={(e) => setFormData({ ...formData, lamination: e.target.checked })}
                  className="rounded border-border"
                />
                <label htmlFor="laminationCheck" className="cursor-pointer text-xs font-medium">
                  Front & Back Sheet Lamination (+₹30 / copy)
                </label>
              </div>

              <div>
                <label className="font-semibold block mb-1">Special Instructions</label>
                <input
                  type="text"
                  placeholder="e.g. Header transparency on first page..."
                  value={formData.special_instructions}
                  onChange={(e) => setFormData({ ...formData, special_instructions: e.target.value })}
                  className="w-full bg-secondary/50 border border-border/80 rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Price Estimate Banner */}
              <div className="p-3.5 rounded-xl bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-transparent border border-indigo-500/30 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-mono block">
                    TOTAL ESTIMATED COST
                  </span>
                  <span className="text-xl font-bold text-foreground">
                    ₹{calculateEstimatedCost()}
                  </span>
                </div>
                <Badge variant="secondary" className="bg-indigo-500/20 text-indigo-400">
                  Pay at Station Pickup
                </Badge>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => setShowOrderModal(false)}
                  className="px-4 py-2 border border-border/80 rounded-lg hover:bg-secondary/60 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg shadow-md transition-colors disabled:opacity-50"
                >
                  {submitting ? "Submitting..." : "Confirm & Send to Queue"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
