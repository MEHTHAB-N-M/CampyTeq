"use client";

import React, { useState, useEffect } from "react";
import {
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  Printer,
  Search,
  Building2,
  Calendar,
  Sparkles,
  ShieldCheck,
  CreditCard,
  Plus,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Payslip {
  id: string;
  payslip_number: string;
  faculty: string;
  faculty_name: string;
  faculty_number: string;
  department_name: string;
  designation: string;
  month: number;
  year: number;
  working_days: number;
  present_days: number;
  leave_days: number;
  basic_salary: string;
  allowances: string;
  gross_salary: string;
  deductions: string;
  tax_deducted: string;
  net_salary: string;
  status: "DRAFT" | "PROCESSED" | "PAID";
  payment_date: string | null;
  payment_method: string;
  transaction_ref: string;
  remarks: string;
  created_at: string;
}

interface SalaryStructure {
  id: string;
  faculty: string;
  faculty_name: string;
  faculty_number: string;
  department_name: string;
  basic_salary: string;
  hra: string;
  da: string;
  special_allowance: string;
  pf_deduction: string;
  tax_deduction: string;
  other_deductions: string;
  gross_salary: string;
  total_deductions: string;
  net_salary: string;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function PayrollPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [structures, setStructures] = useState<SalaryStructure[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMonth, setSelectedMonth] = useState<number>(9);
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [activeTab, setActiveTab] = useState<"payslips" | "structures">("payslips");

  // Selected Payslip for Detailed Modal View
  const [detailedPayslip, setDetailedPayslip] = useState<Payslip | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [processingPayroll, setProcessingPayroll] = useState(false);

  useEffect(() => {
    fetchPayrollData();
  }, [user, selectedMonth, selectedYear]);

  const fetchPayrollData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Payslips
      const pRes = await apiRequest<{ results: Payslip[] } | Payslip[]>("/payroll/payslips/");
      const pList = Array.isArray(pRes) ? pRes : pRes.results || [];
      setPayslips(pList);

      // 2. Fetch Salary Structures if staff
      if (["PRINCIPAL", "MANAGEMENT"].includes(user?.role || "")) {
        const sRes = await apiRequest<{ results: SalaryStructure[] } | SalaryStructure[]>("/payroll/structures/");
        const sList = Array.isArray(sRes) ? sRes : sRes.results || [];
        setStructures(sList);
      }
    } catch (err) {
      console.error("Failed to load payroll:", err);
    } finally {
      setLoading(false);
    }
  };

  // Generate monthly payroll batch
  const handleGenerateMonthly = async () => {
    setProcessingPayroll(true);
    try {
      const res = await apiRequest<any>("/payroll/payslips/generate_monthly/", {
        method: "POST",
        body: JSON.stringify({ month: selectedMonth, year: selectedYear }),
      });
      setSuccessToast(`Payroll run completed! Processed ${res.total_faculty} faculty members.`);
      setTimeout(() => setSuccessToast(null), 4000);
      fetchPayrollData();
    } catch (err) {
      console.error("Payroll run failed:", err);
    } finally {
      setProcessingPayroll(false);
    }
  };

  // Mark Payslip as Disbursed / Paid
  const handleDisbursePayslip = async (id: string) => {
    try {
      await apiRequest(`/payroll/payslips/${id}/mark_paid/`, {
        method: "POST",
        body: JSON.stringify({
          payment_method: "DIRECT_DEPOSIT",
          transaction_ref: `CMS-SAL-NEFT-${Math.floor(100000 + Math.random() * 900000)}`,
        }),
      });
      setSuccessToast("Salary disbursed and marked as PAID!");
      setTimeout(() => setSuccessToast(null), 3000);
      fetchPayrollData();
    } catch (err) {
      console.error("Disbursement failed:", err);
    }
  };

  const filteredPayslips = payslips.filter((p) => {
    const matchesSearch =
      p.faculty_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.faculty_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.payslip_number.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const totalDisbursed = payslips
    .filter((p) => p.status === "PAID")
    .reduce((acc, curr) => acc + Number(curr.net_salary), 0);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Faculty Salary & Payroll
            </h1>
            <Badge variant="outline" className="text-xs bg-indigo-500/10 text-indigo-400 border-indigo-500/20">
              Direct Deposit & Payslips
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Automated salary calculations, Provident Fund/TDS deduction compliance, and confidential electronic payslips.
          </p>
        </div>

        {/* Action / Success Banner */}
        <div className="flex items-center gap-3">
          {successToast && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-2 rounded-lg text-xs flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{successToast}</span>
            </div>
          )}

          {["PRINCIPAL", "MANAGEMENT"].includes(user?.role || "") && (
            <Button
              size="sm"
              variant="gradient"
              disabled={processingPayroll}
              onClick={handleGenerateMonthly}
              className="text-xs h-9 px-3.5"
            >
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              {processingPayroll ? "Processing..." : `Run ${MONTH_NAMES[selectedMonth - 1]} Payroll`}
            </Button>
          )}
        </div>
      </div>

      {/* KPI Metric Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card/50 border-border/60">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Disbursed This Cycle</p>
              <h3 className="text-xl font-bold text-emerald-400 mt-1">
                ₹{totalDisbursed.toLocaleString()}
              </h3>
              <p className="text-[10px] text-emerald-400/80 mt-0.5">NEFT direct deposits</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <TrendingUp className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/60">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Faculty On Payroll</p>
              <h3 className="text-xl font-bold text-foreground mt-1">
                {structures.length > 0 ? structures.length : 3} Active Staff
              </h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">Designated academic roster</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Building2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/60">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Processed Payslips</p>
              <h3 className="text-xl font-bold text-foreground mt-1">{payslips.length} Total</h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">Across Fall semester cycles</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/60">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Tax / PF Deductions</p>
              <h3 className="text-xl font-bold text-amber-400 mt-1">₹44,000</h3>
              <p className="text-[10px] text-amber-400/80 mt-0.5">Statutory compliance</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for Staff */}
      {["PRINCIPAL", "MANAGEMENT"].includes(user?.role || "") && (
        <div className="flex border-b border-border/60 gap-4 text-xs font-medium">
          <button
            onClick={() => setActiveTab("payslips")}
            className={`pb-2.5 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === "payslips"
                ? "border-primary text-primary font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <FileSpreadsheet className="h-3.5 w-3.5" /> Monthly Payslip Registry
          </button>
          <button
            onClick={() => setActiveTab("structures")}
            className={`pb-2.5 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === "structures"
                ? "border-primary text-primary font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <CreditCard className="h-3.5 w-3.5" /> Salary Packages & Structures
          </button>
        </div>
      )}

      {/* TAB 1: PAYSLIPS */}
      {activeTab === "payslips" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search faculty name or payslip ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-xs h-9"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                aria-label="Select payroll month"
                className="bg-secondary/50 border border-border/60 text-foreground text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {MONTH_NAMES.map((name, idx) => (
                  <option key={name} value={idx + 1}>
                    {name}
                  </option>
                ))}
              </select>
              <span className="text-xs font-mono text-muted-foreground font-semibold">2026</span>
            </div>
          </div>

          {/* Payslip Table */}
          <div className="overflow-x-auto rounded-xl border border-border/60 bg-card/40">
            <table className="w-full text-xs text-left">
              <thead className="bg-secondary/40 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border/60">
                <tr>
                  <th className="px-4 py-3">Payslip ID</th>
                  <th className="px-4 py-3">Faculty Member</th>
                  <th className="px-4 py-3">Month / Year</th>
                  <th className="px-4 py-3">Gross Pay</th>
                  <th className="px-4 py-3">Deductions</th>
                  <th className="px-4 py-3">Net Salary</th>
                  <th className="px-4 py-3">Disbursement Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filteredPayslips.map((p) => (
                  <tr key={p.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-primary">
                      {p.payslip_number}
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">
                      {p.faculty_name}
                      <span className="block text-[10px] text-muted-foreground font-mono">
                        {p.faculty_number} • {p.designation}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {MONTH_NAMES[p.month - 1]} {p.year}
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold text-foreground">
                      ₹{Number(p.gross_salary).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-mono text-amber-400">
                      -₹{(Number(p.deductions) + Number(p.tax_deducted)).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-emerald-400">
                      ₹{Number(p.net_salary).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={p.status === "PAID" ? "success" : "warning"} className="text-xs">
                        {p.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {p.status !== "PAID" && ["PRINCIPAL", "MANAGEMENT"].includes(user?.role || "") && (
                          <Button
                            size="sm"
                            variant="gradient"
                            onClick={() => handleDisbursePayslip(p.id)}
                            className="text-[11px] h-7 px-2.5"
                          >
                            Disburse
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setDetailedPayslip(p)}
                          className="text-[11px] h-7 px-2 border-border/70"
                        >
                          <Printer className="h-3 w-3 mr-1" /> View Statement
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: SALARY STRUCTURES */}
      {activeTab === "structures" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {structures.map((s) => (
            <Card key={s.id} className="bg-card/50 border-border/60">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-foreground">{s.faculty_name}</h3>
                    <p className="text-[11px] text-muted-foreground font-mono">
                      {s.faculty_number} • {s.department_name}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 border-emerald-500/20">
                    ₹{Number(s.net_salary).toLocaleString()}/mo
                  </Badge>
                </div>

                <div className="p-3 bg-secondary/30 rounded-xl space-y-1.5 text-xs font-mono border border-border/30">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Basic Salary</span>
                    <span className="text-foreground">₹{Number(s.basic_salary).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">HRA & DA</span>
                    <span className="text-foreground">₹{(Number(s.hra) + Number(s.da)).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Special Allowance</span>
                    <span className="text-foreground">₹{Number(s.special_allowance).toLocaleString()}</span>
                  </div>
                  <div className="border-t border-border/40 pt-1 flex justify-between font-semibold">
                    <span className="text-muted-foreground">Gross Pay</span>
                    <span className="text-primary">₹{Number(s.gross_salary).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-rose-400">
                    <span>PF & Tax Deductions</span>
                    <span>-₹{Number(s.total_deductions).toLocaleString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* DETAILED PAYSLIP STATEMENT MODAL */}
      {detailedPayslip && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-xl bg-card border-border/80 shadow-2xl animate-in zoom-in-95">
            <div className="p-6 space-y-5">
              {/* Header */}
              <div className="border-b border-border/60 pb-3 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-primary" />
                    <h2 className="text-base font-bold text-foreground">
                      Apex Institute of Technology
                    </h2>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Official Salary & Remuneration Payslip Statement
                  </p>
                </div>
                <button
                  onClick={() => setDetailedPayslip(null)}
                  className="text-muted-foreground hover:text-foreground text-xs"
                >
                  ✕
                </button>
              </div>

              {/* Faculty & Month Summary */}
              <div className="grid grid-cols-2 gap-3 bg-secondary/30 p-3.5 rounded-xl border border-border/40 text-xs">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase block">Employee Name</span>
                  <span className="font-bold text-foreground">{detailedPayslip.faculty_name}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase block">Employee ID / Designation</span>
                  <span className="font-mono text-foreground">{detailedPayslip.faculty_number} • {detailedPayslip.designation}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase block">Payslip Number</span>
                  <span className="font-mono text-primary font-semibold">{detailedPayslip.payslip_number}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase block">Pay Period</span>
                  <span className="font-medium text-foreground">{MONTH_NAMES[detailedPayslip.month - 1]} {detailedPayslip.year}</span>
                </div>
              </div>

              {/* Earnings vs Deductions Table */}
              <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                {/* Earnings */}
                <div className="space-y-2 p-3.5 rounded-xl bg-secondary/20 border border-border/30">
                  <h4 className="font-semibold text-foreground border-b border-border/40 pb-1 font-sans">
                    Earnings
                  </h4>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Basic Salary</span>
                    <span className="text-foreground">₹{Number(detailedPayslip.basic_salary).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Allowances (HRA/DA)</span>
                    <span className="text-foreground">₹{Number(detailedPayslip.allowances).toLocaleString()}</span>
                  </div>
                  <div className="border-t border-border/40 pt-1 flex justify-between font-bold text-primary">
                    <span>Gross Earnings</span>
                    <span>₹{Number(detailedPayslip.gross_salary).toLocaleString()}</span>
                  </div>
                </div>

                {/* Deductions */}
                <div className="space-y-2 p-3.5 rounded-xl bg-secondary/20 border border-border/30">
                  <h4 className="font-semibold text-foreground border-b border-border/40 pb-1 font-sans">
                    Deductions
                  </h4>
                  <div className="flex justify-between text-rose-400">
                    <span>Provident Fund</span>
                    <span>₹{Number(detailedPayslip.deductions).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-rose-400">
                    <span>Income Tax (TDS)</span>
                    <span>₹{Number(detailedPayslip.tax_deducted).toLocaleString()}</span>
                  </div>
                  <div className="border-t border-border/40 pt-1 flex justify-between font-bold text-rose-400">
                    <span>Total Deductions</span>
                    <span>₹{(Number(detailedPayslip.deductions) + Number(detailedPayslip.tax_deducted)).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Net Pay Box */}
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-emerald-400 font-medium">Net Remuneration Disbursed</p>
                  <p className="text-2xl font-bold font-mono text-emerald-400">
                    ₹{Number(detailedPayslip.net_salary).toLocaleString()}
                  </p>
                </div>
                <div className="text-right text-[11px] text-muted-foreground">
                  <p>Mode: {detailedPayslip.payment_method}</p>
                  {detailedPayslip.transaction_ref && (
                    <p className="font-mono text-xs text-foreground font-semibold mt-0.5">
                      {detailedPayslip.transaction_ref}
                    </p>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="border-t border-border/60 pt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Verified Payroll System Record
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.print()}
                    className="text-xs h-8 px-3"
                  >
                    <Printer className="h-3.5 w-3.5 mr-1" /> Print Payslip
                  </Button>
                  <Button
                    size="sm"
                    variant="gradient"
                    onClick={() => setDetailedPayslip(null)}
                    className="text-xs h-8 px-3"
                  >
                    Close
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
