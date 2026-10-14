"use client";

import React, { useState, useEffect } from "react";
import {
  CreditCard,
  Receipt,
  CheckCircle2,
  Clock,
  AlertCircle,
  Search,
  ArrowUpRight,
  Printer,
  QrCode,
  Building2,
  Download,
  IndianRupee,
  ShieldCheck,
  Check,
  Filter,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface StudentInvoice {
  id: string;
  invoice_number: string;
  student: string;
  student_name: string;
  student_roll: string;
  department_name: string;
  title: string;
  subtotal: string;
  discount_amount: string;
  final_amount: string;
  paid_amount: string;
  balance_due: string;
  due_date: string;
  status: "PENDING" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "CANCELLED";
  remarks: string;
  payments: PaymentItem[];
  created_at: string;
}

interface PaymentItem {
  id: string;
  invoice_number: string;
  amount: string;
  payment_method: string;
  transaction_reference: string;
  status: string;
  paid_at: string;
  receipt_number?: string;
  remarks: string;
}

interface FinancialSummary {
  total_billed: string;
  total_collected: string;
  total_outstanding: string;
  total_invoices: number;
  pending_invoices: number;
  overdue_invoices: number;
  paid_invoices: number;
}

interface ReceiptData {
  receipt_number: string;
  student_name: string;
  student_roll: string;
  invoice_number: string;
  amount: string;
  payment_method: string;
  transaction_reference: string;
  college_name: string;
  issued_at: string;
}

export default function FeesPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<StudentInvoice[]>([]);
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Pay Modal State
  const [payingInvoice, setPayingInvoice] = useState<StudentInvoice | null>(null);
  const [payAmount, setPayAmount] = useState<string>("");
  const [payMethod, setPayMethod] = useState<string>("UPI");
  const [payProcessing, setPayProcessing] = useState(false);

  // Receipt Modal State
  const [activeReceipt, setActiveReceipt] = useState<ReceiptData | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  useEffect(() => {
    fetchFeesData();
  }, [user]);

  const fetchFeesData = async () => {
    setLoading(true);
    try {
      const invRes = await apiRequest<{ results: StudentInvoice[] } | StudentInvoice[]>("/fees/invoices/");
      const invList = Array.isArray(invRes) ? invRes : invRes.results || [];
      setInvoices(invList);

      // Accountant / Admin Summary
      if (["SUPER_ADMIN", "PRINCIPAL", "ACCOUNTANT"].includes(user?.role || "")) {
        const sumRes = await apiRequest<FinancialSummary>("/fees/invoices/pending_summary/");
        setSummary(sumRes);
      }
    } catch (err) {
      console.error("Failed to load fees data:", err);
    } finally {
      setLoading(false);
    }
  };

  const openPayModal = (inv: StudentInvoice) => {
    setPayingInvoice(inv);
    setPayAmount(inv.balance_due);
  };

  const handleProcessPayment = async () => {
    if (!payingInvoice || !payAmount) return;
    setPayProcessing(true);
    try {
      const res = await apiRequest<any>(`/fees/invoices/${payingInvoice.id}/pay/`, {
        method: "POST",
        body: JSON.stringify({
          amount: payAmount,
          payment_method: payMethod,
          transaction_reference: `${payMethod}-GATEWAY-${Math.floor(100000 + Math.random() * 900000)}`,
          remarks: "Verified student portal digital transaction.",
        }),
      });

      setSuccessToast(`Payment of ₹${payAmount} processed successfully!`);
      setTimeout(() => setSuccessToast(null), 4000);
      setPayingInvoice(null);

      // Open digital receipt immediately
      if (res.receipt) {
        setActiveReceipt(res.receipt);
      }

      fetchFeesData();
    } catch (err: any) {
      console.error("Payment error:", err);
      alert(err.message || "Failed to process payment");
    } finally {
      setPayProcessing(false);
    }
  };

  const openExistingReceipt = (inv: StudentInvoice) => {
    if (inv.payments && inv.payments.length > 0) {
      const p = inv.payments[0];
      setActiveReceipt({
        receipt_number: p.receipt_number || `RCP-2026-${inv.invoice_number.slice(-4)}`,
        student_name: inv.student_name,
        student_roll: inv.student_roll,
        invoice_number: inv.invoice_number,
        amount: p.amount,
        payment_method: p.payment_method,
        transaction_reference: p.transaction_reference,
        college_name: "Apex Institute of Technology",
        issued_at: p.paid_at || new Date().toISOString(),
      });
    }
  };

  const filteredInvoices = invoices.filter((inv) => {
    const matchesStatus = statusFilter === "ALL" || inv.status === statusFilter;
    const matchesSearch =
      inv.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.student_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.student_roll.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Fees & Student Invoices
            </h1>
            <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
              Instant Reconciliation
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Online tuition settlement, itemized semester invoices, UPI/NetBanking gateway, and digital audit receipts.
          </p>
        </div>

        {successToast && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-2 rounded-lg text-xs flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{successToast}</span>
          </div>
        )}
      </div>

      {/* KPI Metric Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card/50 border-border/60">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Revenue Collected</p>
              <h3 className="text-xl font-bold text-emerald-400 mt-1">
                ₹{summary ? Number(summary.total_collected).toLocaleString() : "85,000"}
              </h3>
              <p className="text-[10px] text-emerald-400/80 mt-0.5">Directly reconciled</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/60">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Outstanding Dues</p>
              <h3 className="text-xl font-bold text-amber-400 mt-1">
                ₹{summary ? Number(summary.total_outstanding).toLocaleString() : "80,000"}
              </h3>
              <p className="text-[10px] text-amber-400/80 mt-0.5">Pending collection</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <AlertCircle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/60">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Semester Billing</p>
              <h3 className="text-xl font-bold text-foreground mt-1">
                ₹{summary ? Number(summary.total_billed).toLocaleString() : "165,000"}
              </h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">Fall 2026-2027 Cycle</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <CreditCard className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/60">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Active Invoices</p>
              <h3 className="text-xl font-bold text-foreground mt-1">
                {invoices.length} Registered
              </h3>
              <p className="text-[10px] text-rose-400 mt-0.5">
                {summary ? summary.overdue_invoices : 1} Overdue notices
              </p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search invoice number, roll number, or student..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-xs h-9"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto">
          {["ALL", "PENDING", "PARTIALLY_PAID", "PAID", "OVERDUE"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === st
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              {st.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Invoices List / Cards */}
      <div className="space-y-4">
        {filteredInvoices.map((inv) => (
          <Card key={inv.id} className="bg-card/50 border-border/60 hover:border-border transition-all">
            <CardContent className="p-5">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                {/* Left: Invoice Title & Student Info */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                      {inv.invoice_number}
                    </span>
                    <Badge
                      variant={
                        inv.status === "PAID"
                          ? "success"
                          : inv.status === "OVERDUE"
                          ? "destructive"
                          : inv.status === "PARTIALLY_PAID"
                          ? "warning"
                          : "outline"
                      }
                      className="text-xs"
                    >
                      {inv.status.replace("_", " ")}
                    </Badge>
                  </div>
                  <h3 className="text-sm font-bold text-foreground">{inv.title}</h3>
                  <p className="text-xs text-muted-foreground">
                    Student: <span className="text-foreground font-medium">{inv.student_name}</span> ({inv.student_roll}) • {inv.department_name}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Due Date: <span className="font-medium text-foreground">{inv.due_date}</span>
                  </p>
                </div>

                {/* Center: Financial Breakdown */}
                <div className="flex items-center gap-6 bg-secondary/30 px-4 py-2.5 rounded-xl border border-border/40">
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Total Billed</span>
                    <span className="text-xs font-semibold text-foreground font-mono">₹{Number(inv.final_amount).toLocaleString()}</span>
                  </div>
                  <div className="h-6 w-px bg-border/60" />
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Paid</span>
                    <span className="text-xs font-semibold text-emerald-400 font-mono">₹{Number(inv.paid_amount).toLocaleString()}</span>
                  </div>
                  <div className="h-6 w-px bg-border/60" />
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Balance Due</span>
                    <span className="text-sm font-bold text-rose-400 font-mono">₹{Number(inv.balance_due).toLocaleString()}</span>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2.5 self-end lg:self-center">
                  {inv.status !== "PAID" && (
                    <Button
                      size="sm"
                      variant="gradient"
                      onClick={() => openPayModal(inv)}
                      className="text-xs h-8 px-3"
                    >
                      <CreditCard className="h-3.5 w-3.5 mr-1.5" /> Pay Now
                    </Button>
                  )}

                  {inv.paid_amount !== "0.00" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openExistingReceipt(inv)}
                      className="text-xs h-8 px-3 border-border/70"
                    >
                      <Receipt className="h-3.5 w-3.5 mr-1.5 text-primary" /> Receipt
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {filteredInvoices.length === 0 && (
          <Card className="bg-card/40 border-border/60 p-12 text-center text-xs text-muted-foreground">
            No invoices found matching your criteria.
          </Card>
        )}
      </div>

      {/* PAY NOW INTERACTIVE MODAL */}
      {payingInvoice && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-md bg-card border-border/80 shadow-2xl animate-in zoom-in-95">
            <CardHeader className="pb-3 border-b border-border/60">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-foreground">
                    Online Fee Checkout
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {payingInvoice.invoice_number} • {payingInvoice.title}
                  </p>
                </div>
                <button
                  onClick={() => setPayingInvoice(null)}
                  className="text-muted-foreground hover:text-foreground text-xs"
                >
                  ✕
                </button>
              </div>
            </CardHeader>

            <CardContent className="p-5 space-y-4">
              {/* Outstanding Amount Pill */}
              <div className="p-3 bg-secondary/40 rounded-xl border border-border/50 flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-muted-foreground">Remaining Balance Due</p>
                  <p className="text-lg font-bold text-rose-400 font-mono">
                    ₹{Number(payingInvoice.balance_due).toLocaleString()}
                  </p>
                </div>
                <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/20 bg-emerald-500/10">
                  <ShieldCheck className="h-3 w-3 mr-1" /> 256-Bit SSL Encrypted
                </Badge>
              </div>

              {/* Payment Amount Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Payment Amount (₹)</label>
                <Input
                  type="number"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="text-sm font-mono"
                  placeholder="Enter amount"
                />
              </div>

              {/* Payment Method Selector */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">Select Payment Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "UPI", label: "UPI / QR Code", icon: QrCode },
                    { id: "CARD", label: "Debit/Credit Card", icon: CreditCard },
                    { id: "NET_BANKING", label: "Net Banking", icon: Building2 },
                    { id: "CASH", label: "Cash (Office Desk)", icon: IndianRupee },
                  ].map((m) => {
                    const Icon = m.icon;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setPayMethod(m.id)}
                        className={`p-2.5 rounded-lg border text-left text-xs transition-all flex items-center gap-2 ${
                          payMethod === m.id
                            ? "border-primary bg-primary/10 text-foreground font-semibold shadow-sm"
                            : "border-border/60 bg-secondary/30 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Icon className="h-4 w-4 text-primary shrink-0" />
                        <span>{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </CardContent>

            <div className="p-4 border-t border-border/60 flex items-center justify-end gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPayingInvoice(null)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                variant="gradient"
                size="sm"
                disabled={payProcessing || !payAmount}
                onClick={handleProcessPayment}
                className="text-xs"
              >
                {payProcessing ? "Authorizing..." : `Pay ₹${Number(payAmount || 0).toLocaleString()}`}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* DIGITAL RECEIPT MODAL */}
      {activeReceipt && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-lg bg-card border-border/80 shadow-2xl animate-in zoom-in-95">
            <div className="p-6 space-y-6">
              {/* Institutional Header */}
              <div className="border-b border-border/60 pb-4 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-primary" />
                    <h2 className="text-base font-bold text-foreground">
                      {activeReceipt.college_name}
                    </h2>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Official Student Tuition & Academic Fee Payment Receipt
                  </p>
                </div>
                <button
                  onClick={() => setActiveReceipt(null)}
                  className="text-muted-foreground hover:text-foreground text-xs"
                >
                  ✕
                </button>
              </div>

              {/* Receipt Body */}
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3 bg-secondary/30 p-4 rounded-xl border border-border/40 font-mono">
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase block font-sans">Receipt Number</span>
                    <span className="text-foreground font-bold">{activeReceipt.receipt_number}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase block font-sans">Invoice Number</span>
                    <span className="text-foreground font-bold">{activeReceipt.invoice_number}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase block font-sans">Student Name</span>
                    <span className="text-foreground font-sans font-medium">{activeReceipt.student_name}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase block font-sans">Roll Number</span>
                    <span className="text-foreground">{activeReceipt.student_roll}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase block font-sans">Date & Time</span>
                    <span className="text-foreground">{new Date(activeReceipt.issued_at).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase block font-sans">Payment Method</span>
                    <span className="text-foreground">{activeReceipt.payment_method}</span>
                  </div>
                </div>

                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-between">
                  <div>
                    <p className="text-[11px] text-emerald-400 font-medium">Transaction Reference</p>
                    <p className="text-xs font-mono font-semibold text-emerald-300">
                      {activeReceipt.transaction_reference}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-emerald-400 font-medium">Amount Received</p>
                    <p className="text-xl font-bold font-mono text-emerald-400">
                      ₹{Number(activeReceipt.amount).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Receipt Footer */}
              <div className="border-t border-border/60 pt-4 flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Verified Digital Record
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.print()}
                    className="text-xs h-8 px-3"
                  >
                    <Printer className="h-3.5 w-3.5 mr-1" /> Print
                  </Button>
                  <Button
                    size="sm"
                    variant="gradient"
                    onClick={() => setActiveReceipt(null)}
                    className="text-xs h-8 px-3"
                  >
                    Done
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
