"use client";

import React, { useState, useEffect } from "react";
import {
  FileCheck2,
  FileText,
  Download,
  Upload,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  AlertCircle,
  GraduationCap,
  Calendar,
  Eye,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/api";
import { Badge } from "@/components/ui/badge";

interface DocumentItem {
  id: string;
  title: string;
  document_type:
    | "BONAFIDE_CERTIFICATE"
    | "GRADE_SHEET"
    | "FEE_RECEIPT"
    | "ID_PROOF"
    | "TRANSFER_CERTIFICATE"
    | "SYLLABUS_COPY";
  student?: string;
  student_name?: string;
  student_roll?: string;
  uploaded_by_name?: string;
  file_url: string;
  status: "VERIFIED" | "PENDING_VERIFICATION" | "REJECTED";
  issued_date: string;
  created_at: string;
}

export default function DocumentsPage() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Upload/Request form
  const [formData, setFormData] = useState({
    title: "",
    document_type: "BONAFIDE_CERTIFICATE",
    file_url: "/documents/sample_document.pdf",
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const res = await apiRequest<any>("/communication/documents/");
      const items: DocumentItem[] = res?.results || (Array.isArray(res) ? res : []);
      setDocuments(items);
    } catch (err) {
      console.error("Failed to load documents", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await apiRequest("/communication/documents/", {
        method: "POST",
        body: JSON.stringify(formData),
      });
      setShowUploadModal(false);
      setFormData({
        title: "",
        document_type: "BONAFIDE_CERTIFICATE",
        file_url: "/documents/sample_document.pdf",
      });
      fetchDocuments();
    } catch (err) {
      console.error("Failed to issue document", err);
      alert("Failed to submit document.");
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = documents.filter((doc) => {
    const matchesType = typeFilter === "ALL" || doc.document_type === typeFilter;
    const matchesSearch =
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (doc.student_roll && doc.student_roll.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (doc.student_name && doc.student_name.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesType && matchesSearch;
  });

  const verifiedCount = documents.filter((d) => d.status === "VERIFIED").length;
  const pendingCount = documents.filter((d) => d.status === "PENDING_VERIFICATION").length;
  const syllabusCount = documents.filter((d) => d.document_type === "SYLLABUS_COPY").length;

  const docTypeLabels: Record<string, { label: string; badge: string }> = {
    BONAFIDE_CERTIFICATE: {
      label: "Bonafide Certificate",
      badge: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    },
    GRADE_SHEET: {
      label: "Official Grade Sheet",
      badge: "bg-purple-500/10 text-purple-400 border-purple-500/30",
    },
    FEE_RECEIPT: {
      label: "Fee Receipt",
      badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    },
    ID_PROOF: {
      label: "Identity Document",
      badge: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    },
    TRANSFER_CERTIFICATE: {
      label: "Transfer Certificate",
      badge: "bg-rose-500/10 text-rose-400 border-rose-500/30",
    },
    SYLLABUS_COPY: {
      label: "Course Syllabus",
      badge: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30",
    },
  };

  const statusBadges: Record<string, { label: string; badge: string }> = {
    VERIFIED: {
      label: "Verified Official",
      badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    },
    PENDING_VERIFICATION: {
      label: "Pending Verification",
      badge: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    },
    REJECTED: {
      label: "Rejected",
      badge: "bg-rose-500/10 text-rose-400 border-rose-500/30",
    },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <FileCheck2 className="h-6 w-6 text-indigo-400" />
            Official Documents & Certificates
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Secure digital repository of bonafide certificates, validated semester grade sheets, and curriculum syllabi.
          </p>
        </div>

        <button
          onClick={() => setShowUploadModal(true)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow-md shadow-indigo-600/20 flex items-center gap-2 transition-colors self-start md:self-auto"
        >
          <Upload className="h-4 w-4" />
          Request / Upload Document
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-border/60 bg-card/60 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">Total Documents</p>
            <p className="text-xl font-bold text-foreground">{documents.length}</p>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border/60 bg-card/60 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">Official & Verified</p>
            <p className="text-xl font-bold text-emerald-400">{verifiedCount}</p>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border/60 bg-card/60 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">Pending Review</p>
            <p className="text-xl font-bold text-amber-400">{pendingCount}</p>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border/60 bg-card/60 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-purple-500/10 text-purple-400">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">Syllabi & Circulars</p>
            <p className="text-xl font-bold text-purple-400">{syllabusCount}</p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-card/60 p-3 rounded-xl border border-border/60">
        <div className="flex flex-wrap gap-1.5 w-full sm:w-auto">
          {[
            { key: "ALL", label: "All Documents" },
            { key: "BONAFIDE_CERTIFICATE", label: "Bonafide Certs" },
            { key: "GRADE_SHEET", label: "Grade Sheets" },
            { key: "SYLLABUS_COPY", label: "Curriculum Syllabi" },
            { key: "FEE_RECEIPT", label: "Fee Receipts" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setTypeFilter(tab.key)}
              className={`px-3 py-1 text-xs rounded-lg font-medium transition-all ${
                typeFilter === tab.key
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-secondary/40 text-muted-foreground hover:text-foreground hover:bg-secondary/80"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by title, roll number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-secondary/50 border border-border/60 rounded-lg pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Documents Grid / Table */}
      {loading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">Loading documents...</div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center bg-card/40 rounded-xl border border-border/60">
          <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-60" />
          <p className="text-sm font-semibold text-foreground">No documents found</p>
          <p className="text-xs text-muted-foreground mt-1">
            Try adjusting your search criteria or category filter.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((doc) => {
            const typeInfo = docTypeLabels[doc.document_type] || {
              label: doc.document_type,
              badge: "bg-secondary text-foreground",
            };
            const statusInfo = statusBadges[doc.status] || {
              label: doc.status,
              badge: "bg-secondary text-foreground",
            };

            return (
              <div
                key={doc.id}
                className="p-5 rounded-xl border border-border/60 bg-card/60 hover:bg-card/90 transition-all flex flex-col justify-between shadow-sm"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <Badge variant="outline" className={`text-[10px] ${typeInfo.badge}`}>
                      {typeInfo.label}
                    </Badge>
                    <Badge variant="outline" className={`text-[10px] ${statusInfo.badge}`}>
                      {statusInfo.label}
                    </Badge>
                  </div>

                  <h3 className="font-bold text-sm text-foreground mb-2 leading-snug">
                    {doc.title}
                  </h3>

                  {doc.student_roll ? (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
                      <GraduationCap className="h-3.5 w-3.5 text-indigo-400" />
                      <span>
                        Student: <strong className="text-foreground">{doc.student_name}</strong> (
                        {doc.student_roll})
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Public College Academic Resource</span>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono">
                    <Calendar className="h-3 w-3" />
                    <span>Issued: {doc.issued_date}</span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">
                    By {doc.uploaded_by_name || "Campus Registry"}
                  </span>

                  <button
                    onClick={() => {
                      alert(`Downloading: ${doc.title}\n(Simulated download for ${doc.file_url})`);
                    }}
                    className="px-3 py-1.5 bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors border border-border/60"
                  >
                    <Download className="h-3.5 w-3.5 text-indigo-400" />
                    Download PDF
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border/80 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <h2 className="text-lg font-bold text-foreground mb-1">Request / Upload Document</h2>
            <p className="text-xs text-muted-foreground mb-4">
              Submit an official certificate request or upload an academic document.
            </p>

            <form onSubmit={handleUpload} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold block mb-1">Document Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Bonafide Certificate Request for Passport"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full bg-secondary/50 border border-border/80 rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">Document Category</label>
                <select
                  value={formData.document_type}
                  onChange={(e) => setFormData({ ...formData, document_type: e.target.value as any })}
                  className="w-full bg-secondary/50 border border-border/80 rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="BONAFIDE_CERTIFICATE">Bonafide Certificate</option>
                  <option value="GRADE_SHEET">Official Grade Sheet</option>
                  <option value="SYLLABUS_COPY">Course Syllabus Copy</option>
                  <option value="ID_PROOF">Identity Proof Document</option>
                  <option value="FEE_RECEIPT">Fee Receipt / Voucher</option>
                </select>
              </div>

              <div>
                <label className="font-semibold block mb-1">Simulated File Attachment Link</label>
                <input
                  type="text"
                  value={formData.file_url}
                  onChange={(e) => setFormData({ ...formData, file_url: e.target.value })}
                  className="w-full bg-secondary/50 border border-border/80 rounded-lg px-3 py-2 text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 border border-border/80 rounded-lg hover:bg-secondary/60 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg shadow-md transition-colors disabled:opacity-50"
                >
                  {submitting ? "Processing..." : "Submit Record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
