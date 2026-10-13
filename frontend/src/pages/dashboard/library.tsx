"use client";

import React, { useState, useEffect } from "react";
import {
  Library,
  BookOpen,
  Search,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Bookmark,
  User,
  ShieldCheck,
  RotateCcw,
  IndianRupee,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/api";
import { Badge } from "@/components/ui/badge";

interface Book {
  id: string;
  title: string;
  isbn: string;
  author: string;
  publisher: string;
  edition: string;
  publication_year?: number;
  category: string;
  shelf_location: string;
  total_copies: number;
  available_copies: number;
  description: string;
}

interface BookIssue {
  id: string;
  book: string;
  book_title: string;
  book_isbn: string;
  book_author: string;
  user: string;
  user_name: string;
  user_email: string;
  student_roll?: string;
  issued_by_name?: string;
  issue_date: string;
  due_date: string;
  return_date?: string;
  status: "ISSUED" | "RETURNED" | "OVERDUE" | "LOST";
  fine_amount: string;
  fine_paid: boolean;
  remarks: string;
}

interface LibraryRequest {
  id: string;
  book: string;
  book_title: string;
  book_isbn: string;
  requested_by_name: string;
  requested_by_role: string;
  request_type: string;
  urgency: string;
  justification: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reviewed_by_name?: string;
  review_remarks?: string;
  created_at: string;
}

export default function LibraryPage() {
  const { user } = useAuth();
  const [books, setBooks] = useState<Book[]>([]);
  const [issues, setIssues] = useState<BookIssue[]>([]);
  const [requests, setRequests] = useState<LibraryRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"CATALOG" | "MY_LOANS" | "CIRCULATION" | "MENTOR_REQUESTS">("CATALOG");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [showAddBookModal, setShowAddBookModal] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [reviewReqModal, setReviewReqModal] = useState<{ req: LibraryRequest | null; action: "APPROVED" | "REJECTED" }>({ req: null, action: "APPROVED" });
  const [reviewRemarks, setReviewRemarks] = useState("");
  const [returnModal, setReturnModal] = useState<{ issue: BookIssue | null }>({ issue: null });
  const [finePaid, setFinePaid] = useState(true);
  const [returnRemarks, setReturnRemarks] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // New Book Form
  const [bookForm, setBookForm] = useState({
    title: "",
    isbn: "",
    author: "",
    publisher: "",
    edition: "1st Edition",
    category: "COMPUTER_SCIENCE",
    shelf_location: "Rack CS-01",
    total_copies: 5,
    available_copies: 5,
    description: "",
  });

  // Issue Book Form
  const [issueForm, setIssueForm] = useState({
    book: "",
    user: "",
    remarks: "Issued for semester coursework",
  });

  // Mentor Request Form
  const [requestForm, setRequestForm] = useState({
    book: "",
    book_title: "",
    request_type: "RESERVATION",
    urgency: "MEDIUM",
    justification: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const isLibraryStaff = ["LIBRARY_STAFF", "PRINCIPAL"].includes(user?.role || "");
  const isMentor = ["MENTOR", "PRINCIPAL"].includes(user?.role || "");

  const fetchData = async () => {
    try {
      setLoading(true);
      const [booksRes, issuesRes, reqsRes] = await Promise.all([
        apiRequest<any>("/library/books/"),
        apiRequest<any>("/library/issues/"),
        apiRequest<any>("/library/requests/").catch(() => []),
      ]);
      setBooks(booksRes?.results || (Array.isArray(booksRes) ? booksRes : []));
      setIssues(issuesRes?.results || (Array.isArray(issuesRes) ? issuesRes : []));
      setRequests(reqsRes?.results || (Array.isArray(reqsRes) ? reqsRes : []));
    } catch (err) {
      console.error("Failed to load library data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddBook = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await apiRequest("/library/books/", {
        method: "POST",
        body: JSON.stringify(bookForm),
      });
      setShowAddBookModal(false);
      setBookForm({
        title: "",
        isbn: "",
        author: "",
        publisher: "",
        edition: "1st Edition",
        category: "COMPUTER_SCIENCE",
        shelf_location: "Rack CS-01",
        total_copies: 5,
        available_copies: 5,
        description: "",
      });
      fetchData();
    } catch (err) {
      console.error("Failed to add book", err);
      alert("Failed to add book to catalog.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleIssueBook = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await apiRequest("/library/issues/", {
        method: "POST",
        body: JSON.stringify(issueForm),
      });
      setShowIssueModal(false);
      setIssueForm({ book: "", user: "", remarks: "Issued for semester coursework" });
      fetchData();
    } catch (err: any) {
      console.error("Failed to issue book", err);
      alert(err.message || "Failed to issue book.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReturnBook = async () => {
    if (!returnModal.issue) return;
    try {
      setActionLoading(true);
      await apiRequest(`/library/issues/${returnModal.issue.id}/mark_return/`, {
        method: "POST",
        body: JSON.stringify({ fine_paid: finePaid, remarks: returnRemarks }),
      });
      setReturnModal({ issue: null });
      setReturnRemarks("");
      fetchData();
    } catch (err) {
      console.error("Failed to return book", err);
      alert("Failed to process book return.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await apiRequest("/library/requests/", {
        method: "POST",
        body: JSON.stringify(requestForm),
      });
      setShowRequestModal(false);
      setRequestForm({
        book: "",
        book_title: "",
        request_type: "RESERVATION",
        urgency: "MEDIUM",
        justification: "",
      });
      fetchData();
    } catch (err: any) {
      console.error("Failed to submit library request", err);
      alert(err.message || "Failed to submit request.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReviewRequest = async () => {
    if (!reviewReqModal.req) return;
    try {
      setActionLoading(true);
      await apiRequest(`/library/requests/${reviewReqModal.req.id}/review/`, {
        method: "POST",
        body: JSON.stringify({
          status: reviewReqModal.action,
          review_remarks: reviewRemarks,
        }),
      });
      setReviewReqModal({ req: null, action: "APPROVED" });
      setReviewRemarks("");
      fetchData();
    } catch (err: any) {
      console.error("Failed to review library request", err);
      alert(err.message || "Failed to submit review.");
    } finally {
      setActionLoading(false);
    }
  };

  const filteredBooks = books.filter((b) => {
    const matchesCategory = categoryFilter === "ALL" || b.category === categoryFilter;
    const matchesSearch =
      b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.isbn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.shelf_location.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const myLoans = issues.filter(
    (i) => (i.user === user?.id || i.user_email === user?.email) && i.status === "ISSUED"
  );
  const activeCirculation = issues.filter((i) => i.status === "ISSUED");

  const categoryLabels: Record<string, string> = {
    COMPUTER_SCIENCE: "Computer Science & AI",
    ELECTRONICS: "Electronics & VLSI",
    MECHANICAL: "Mechanical",
    MATHEMATICS: "Mathematics",
    PHYSICS: "Physics",
    MANAGEMENT: "Management",
    HUMANITIES: "Humanities",
    GENERAL: "General Reference",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Library className="h-6 w-6 text-indigo-400" />
            University Library & Books Catalog
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Search physical books, inspect real-time shelf availability, manage loans, and submit mentor acquisition requests.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          {isMentor && (
            <button
              onClick={() => {
                setRequestForm({
                  book: books[0]?.id || "",
                  book_title: books[0]?.title || "",
                  request_type: "RESERVATION",
                  urgency: "MEDIUM",
                  justification: "",
                });
                setShowRequestModal(true);
              }}
              className="px-3.5 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold rounded-lg shadow-md shadow-teal-600/20 flex items-center gap-1.5 transition-colors"
            >
              <Plus className="h-4 w-4" /> Mentor Request
            </button>
          )}
          {isLibraryStaff && (
            <>
              <button
                onClick={() => setShowAddBookModal(true)}
                className="px-3 py-2 bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold rounded-lg border border-border/80 flex items-center gap-1.5 transition-colors"
              >
                <Plus className="h-4 w-4" /> Add Book
              </button>
              <button
                onClick={() => setShowIssueModal(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow-md shadow-indigo-600/20 flex items-center gap-1.5 transition-colors"
              >
                <Bookmark className="h-4 w-4" /> Issue Book
              </button>
            </>
          )}
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-border/60 bg-card/60 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">Catalog Titles</p>
            <p className="text-xl font-bold text-foreground">{books.length}</p>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border/60 bg-card/60 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">Available On Shelf</p>
            <p className="text-xl font-bold text-emerald-400">
              {books.reduce((acc, b) => acc + b.available_copies, 0)}
            </p>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border/60 bg-card/60 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-400">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">Active Borrowed Loans</p>
            <p className="text-xl font-bold text-blue-400">{activeCirculation.length}</p>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border/60 bg-card/60 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-rose-500/10 text-rose-400">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">Overdue Books</p>
            <p className="text-xl font-bold text-rose-400">
              {
                issues.filter(
                  (i) => i.status === "ISSUED" && new Date(i.due_date) < new Date()
                ).length
              }
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border/60 pb-2">
        <button
          onClick={() => setActiveTab("CATALOG")}
          className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
            activeTab === "CATALOG"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
          }`}
        >
          Browse Books Catalog ({books.length})
        </button>

        <button
          onClick={() => setActiveTab("MY_LOANS")}
          className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
            activeTab === "MY_LOANS"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
          }`}
        >
          My Borrowed Books
          {myLoans.length > 0 && (
            <span className="h-4 px-1.5 rounded-full bg-indigo-500 text-white text-[10px] font-bold">
              {myLoans.length}
            </span>
          )}
        </button>

        {isLibraryStaff && (
          <button
            onClick={() => setActiveTab("CIRCULATION")}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === "CIRCULATION"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
            }`}
          >
            Circulation Management
            <span className="h-4 px-1.5 rounded-full bg-secondary text-muted-foreground text-[10px] font-bold">
              {issues.length}
            </span>
          </button>
        )}

        {(isMentor || isLibraryStaff) && (
          <button
            onClick={() => setActiveTab("MENTOR_REQUESTS")}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === "MENTOR_REQUESTS"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
            }`}
          >
            Mentor Requests
            {requests.length > 0 && (
              <span className="h-4 px-1.5 rounded-full bg-teal-500 text-white text-[10px] font-bold">
                {requests.length}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">Loading library data...</div>
      ) : activeTab === "CATALOG" ? (
        /* Catalog View */
        <div className="space-y-4">
          {/* Filters & Search */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-card/60 p-3 rounded-xl border border-border/60">
            <div className="flex flex-wrap gap-1.5 w-full sm:w-auto">
              {["ALL", "COMPUTER_SCIENCE", "MATHEMATICS", "ELECTRONICS"].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-1 text-xs rounded-lg font-medium transition-all ${
                    categoryFilter === cat
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "bg-secondary/40 text-muted-foreground hover:text-foreground hover:bg-secondary/80"
                  }`}
                >
                  {cat === "ALL" ? "All Subjects" : categoryLabels[cat] || cat}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by title, author, ISBN, shelf..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-secondary/50 border border-border/60 rounded-lg pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {filteredBooks.length === 0 ? (
            <div className="py-16 text-center bg-card/40 rounded-xl border border-border/60">
              <BookOpen className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-60" />
              <p className="text-sm font-semibold text-foreground">No books found</p>
              <p className="text-xs text-muted-foreground mt-1">
                Try searching another title, author, or category.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredBooks.map((book) => {
                const inStock = book.available_copies > 0;
                return (
                  <div
                    key={book.id}
                    className="p-5 rounded-xl border border-border/60 bg-card/60 hover:bg-card/90 transition-all flex flex-col justify-between shadow-sm"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2.5">
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-indigo-500/10 text-indigo-400 border-indigo-500/30"
                        >
                          {categoryLabels[book.category] || book.category}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-semibold ${
                            inStock
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                              : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                          }`}
                        >
                          {inStock ? `● Free (${book.available_copies}/${book.total_copies} available)` : "● Not Free (0 available)"}
                        </Badge>
                      </div>

                      <h3 className="font-bold text-sm text-foreground hover:text-indigo-400 transition-colors leading-snug">
                        {book.title}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">By {book.author}</p>

                      <div className="mt-3 space-y-1 text-[11px] text-muted-foreground font-mono bg-secondary/30 p-2.5 rounded-lg border border-border/40">
                        <div>
                          <span className="text-muted-foreground/70">ISBN:</span>{" "}
                          <span className="text-foreground">{book.isbn}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground/70">Location:</span>{" "}
                          <span className="text-indigo-400">{book.shelf_location}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground/70">Edition:</span>{" "}
                          <span>
                            {book.edition} ({book.publication_year || "N/A"})
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-muted-foreground mt-3 leading-relaxed line-clamp-2">
                        {book.description}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between text-[11px] gap-2">
                      <span className="text-muted-foreground">
                        Shelf: <strong className="text-indigo-300">{book.shelf_location}</strong>
                      </span>
                      <div className="flex items-center gap-1.5">
                        {isMentor && (
                          <button
                            onClick={() => {
                              setRequestForm({
                                book: book.id,
                                book_title: book.title,
                                request_type: "RESERVATION",
                                urgency: "MEDIUM",
                                justification: "",
                              });
                              setShowRequestModal(true);
                            }}
                            className="px-2.5 py-1 bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 border border-teal-500/40 rounded-lg text-xs font-semibold transition-colors"
                          >
                            Request Copy
                          </button>
                        )}
                        {isLibraryStaff && inStock && (
                          <button
                            onClick={() => {
                              setIssueForm({ ...issueForm, book: book.id });
                              setShowIssueModal(true);
                            }}
                            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition-colors"
                          >
                            Issue Copy
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : activeTab === "MY_LOANS" ? (
        /* My Loans View */
        <div className="space-y-4">
          {myLoans.length === 0 ? (
            <div className="py-16 text-center bg-card/40 rounded-xl border border-border/60">
              <Bookmark className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-60" />
              <p className="text-sm font-semibold text-foreground">No active book loans</p>
              <p className="text-xs text-muted-foreground mt-1">
                You do not have any borrowed books out from the library.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {myLoans.map((loan) => {
                const isOverdue = new Date(loan.due_date) < new Date();
                return (
                  <div
                    key={loan.id}
                    className={`p-5 rounded-xl border bg-card/60 flex flex-col justify-between ${
                      isOverdue ? "border-rose-500/40 bg-rose-500/5" : "border-border/60"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <Badge
                          variant="outline"
                          className={
                            isOverdue
                              ? "bg-rose-500/10 text-rose-400 border-rose-500/30 font-bold"
                              : "bg-blue-500/10 text-blue-400 border-blue-500/30"
                          }
                        >
                          {isOverdue ? "OVERDUE" : "BORROWED"}
                        </Badge>
                        <span className="font-mono text-[11px] text-muted-foreground">
                          Due: {loan.due_date}
                        </span>
                      </div>

                      <h3 className="font-bold text-sm text-foreground mb-1">{loan.book_title}</h3>
                      <p className="text-xs text-muted-foreground mb-3">By {loan.book_author}</p>

                      <div className="bg-secondary/30 p-3 rounded-lg border border-border/40 space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Borrow Date:</span>
                          <span className="font-mono">{loan.issue_date}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Issued By:</span>
                          <span>{loan.issued_by_name || "Library Circulation Desk"}</span>
                        </div>
                        {isOverdue && (
                          <div className="flex justify-between text-rose-400 font-bold pt-1 border-t border-border/20">
                            <span>Overdue Fine:</span>
                            <span>₹{loan.fine_amount || "5.00/day"}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-border/40 text-[11px] text-muted-foreground flex items-center justify-between">
                      <span>Standard Loan: 14 Days</span>
                      <span className="text-indigo-400">Return at Main Circulation Desk</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : activeTab === "CIRCULATION" ? (
        /* Circulation Management (Staff View) */
        <div className="bg-card/60 rounded-xl border border-border/60 overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-secondary/40 border-b border-border/60 text-muted-foreground">
              <tr>
                <th className="p-3.5 font-semibold">Book Title</th>
                <th className="p-3.5 font-semibold">Borrower</th>
                <th className="p-3.5 font-semibold">Issue Date</th>
                <th className="p-3.5 font-semibold">Due Date</th>
                <th className="p-3.5 font-semibold">Status</th>
                <th className="p-3.5 font-semibold">Fine</th>
                <th className="p-3.5 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {issues.map((issue) => {
                const isOverdue = issue.status === "ISSUED" && new Date(issue.due_date) < new Date();
                return (
                  <tr key={issue.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="p-3.5 font-semibold text-foreground">
                      <p>{issue.book_title}</p>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {issue.book_isbn}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <p className="font-semibold text-foreground">{issue.user_name}</p>
                      <span className="text-[10px] text-muted-foreground">{issue.user_email}</span>
                    </td>
                    <td className="p-3.5 text-muted-foreground font-mono">{issue.issue_date}</td>
                    <td className="p-3.5 text-muted-foreground font-mono">
                      <span className={isOverdue ? "text-rose-400 font-bold" : ""}>
                        {issue.due_date}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <Badge
                        variant="outline"
                        className={
                          issue.status === "RETURNED"
                            ? "bg-slate-500/10 text-slate-300 border-slate-500/30"
                            : isOverdue
                            ? "bg-rose-500/10 text-rose-400 border-rose-500/30 font-bold"
                            : "bg-blue-500/10 text-blue-400 border-blue-500/30"
                        }
                      >
                        {isOverdue ? "OVERDUE" : issue.status}
                      </Badge>
                    </td>
                    <td className="p-3.5 font-bold">
                      {parseFloat(issue.fine_amount) > 0 ? (
                        <span className={issue.fine_paid ? "text-muted-foreground" : "text-rose-400"}>
                          ₹{issue.fine_amount} {issue.fine_paid ? "(Paid)" : "(Unpaid)"}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-3.5 text-right">
                      {issue.status === "ISSUED" ? (
                        <button
                          onClick={() => setReturnModal({ issue })}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-colors inline-flex items-center gap-1"
                        >
                          <RotateCcw className="h-3 w-3" /> Process Return
                        </button>
                      ) : (
                        <span className="text-muted-foreground text-[11px] italic">Completed</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* Mentor Requests View */
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card/60 p-4 rounded-xl border border-border/60">
            <div>
              <h3 className="font-bold text-sm text-foreground">Mentor Book Acquisition & Reservation Requests</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isLibraryStaff
                  ? "Incoming requests from Academic Mentors for student cohort reference materials."
                  : "Track the fulfillment and approval of your library material requests."}
              </p>
            </div>
            {isMentor && (
              <button
                onClick={() => {
                  setRequestForm({
                    book: books[0]?.id || "",
                    book_title: books[0]?.title || "",
                    request_type: "RESERVATION",
                    urgency: "MEDIUM",
                    justification: "",
                  });
                  setShowRequestModal(true);
                }}
                className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-semibold shadow-sm flex items-center gap-1.5 self-start sm:self-auto"
              >
                <Plus className="h-3.5 w-3.5" /> New Request
              </button>
            )}
          </div>

          {requests.length === 0 ? (
            <div className="py-16 text-center bg-card/40 rounded-xl border border-border/60">
              <Bookmark className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-60" />
              <p className="text-sm font-semibold text-foreground">No mentor requests recorded</p>
              <p className="text-xs text-muted-foreground mt-1">
                Mentors can submit book reservations or new acquisition proposals at any time.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map((req) => (
                <div
                  key={req.id}
                  className="p-4 rounded-xl glass-panel border border-border/60 hover:border-indigo-500/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-sm text-foreground">{req.book_title}</span>
                      <Badge variant="outline" className="text-[10px] border-indigo-500/30 text-indigo-300 font-mono">
                        {req.book_isbn}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px]">
                        {req.request_type}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-semibold ${
                          req.urgency === "HIGH"
                            ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                            : req.urgency === "MEDIUM"
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                            : "bg-blue-500/10 text-blue-400 border-blue-500/30"
                        }`}
                      >
                        {req.urgency} Urgency
                      </Badge>
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                          req.status === "APPROVED"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                            : req.status === "REJECTED"
                            ? "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                            : "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                        }`}
                      >
                        {req.status}
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground">{req.justification}</p>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground pt-1">
                      <span>
                        Requested by: <strong className="text-slate-200">{req.requested_by_name}</strong> ({req.requested_by_role})
                      </span>
                      <span>Date: {new Date(req.created_at).toLocaleDateString()}</span>
                      {req.reviewed_by_name && (
                        <span>
                          Reviewed by: <strong className="text-slate-200">{req.reviewed_by_name}</strong>
                          {req.review_remarks ? ` — "${req.review_remarks}"` : ""}
                        </span>
                      )}
                    </div>
                  </div>

                  {isLibraryStaff && req.status === "PENDING" && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => {
                          setReviewReqModal({ req, action: "APPROVED" });
                          setReviewRemarks("");
                        }}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-sm flex items-center gap-1"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                      </button>
                      <button
                        onClick={() => {
                          setReviewReqModal({ req, action: "REJECTED" });
                          setReviewRemarks("");
                        }}
                        className="px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 rounded-lg text-xs font-semibold shadow-sm flex items-center gap-1"
                      >
                        <AlertCircle className="h-3.5 w-3.5" /> Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Book Modal */}
      {showAddBookModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border/80 rounded-2xl w-full max-w-lg p-6 shadow-2xl animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-foreground mb-1">Add Book to Catalog</h2>
            <p className="text-xs text-muted-foreground mb-4">
              Enter book publication metadata, shelf location, and inventory copies.
            </p>

            <form onSubmit={handleAddBook} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold block mb-1">Book Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Distributed Operating Systems"
                  value={bookForm.title}
                  onChange={(e) => setBookForm({ ...bookForm, title: e.target.value })}
                  className="w-full bg-secondary/50 border border-border/80 rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Primary Author(s) *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Andrew S. Tanenbaum"
                    value={bookForm.author}
                    onChange={(e) => setBookForm({ ...bookForm, author: e.target.value })}
                    className="w-full bg-secondary/50 border border-border/80 rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">ISBN Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 978-0133806106"
                    value={bookForm.isbn}
                    onChange={(e) => setBookForm({ ...bookForm, isbn: e.target.value })}
                    className="w-full bg-secondary/50 border border-border/80 rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Category / Discipline</label>
                  <select
                    value={bookForm.category}
                    onChange={(e) => setBookForm({ ...bookForm, category: e.target.value })}
                    className="w-full bg-secondary/50 border border-border/80 rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="COMPUTER_SCIENCE">Computer Science & AI</option>
                    <option value="MATHEMATICS">Mathematics</option>
                    <option value="ELECTRONICS">Electronics</option>
                    <option value="MECHANICAL">Mechanical</option>
                    <option value="PHYSICS">Physics</option>
                    <option value="MANAGEMENT">Management</option>
                    <option value="HUMANITIES">Humanities</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold block mb-1">Shelf / Rack Location *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rack CS-08, Shelf B"
                    value={bookForm.shelf_location}
                    onChange={(e) => setBookForm({ ...bookForm, shelf_location: e.target.value })}
                    className="w-full bg-secondary/50 border border-border/80 rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Total Copies *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={bookForm.total_copies}
                    onChange={(e) => {
                      const v = parseInt(e.target.value) || 1;
                      setBookForm({ ...bookForm, total_copies: v, available_copies: v });
                    }}
                    className="w-full bg-secondary/50 border border-border/80 rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Publisher</label>
                  <input
                    type="text"
                    placeholder="e.g. Pearson / MIT Press"
                    value={bookForm.publisher}
                    onChange={(e) => setBookForm({ ...bookForm, publisher: e.target.value })}
                    className="w-full bg-secondary/50 border border-border/80 rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold block mb-1">Description / Summary</label>
                <textarea
                  rows={3}
                  placeholder="Summary of topics covered..."
                  value={bookForm.description}
                  onChange={(e) => setBookForm({ ...bookForm, description: e.target.value })}
                  className="w-full bg-secondary/50 border border-border/80 rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => setShowAddBookModal(false)}
                  className="px-4 py-2 border border-border/80 rounded-lg hover:bg-secondary/60 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg shadow-md transition-colors disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Add to Catalog"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Return Book Modal */}
      {returnModal.issue && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border/80 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <h2 className="text-lg font-bold text-foreground mb-1">Process Book Return</h2>
            <p className="text-xs text-muted-foreground mb-4">
              Return book to available shelf inventory and settle overdue fines.
            </p>

            <div className="space-y-4 text-xs">
              <div className="bg-secondary/30 p-3 rounded-lg border border-border/40 space-y-1">
                <p className="font-bold text-foreground text-sm">{returnModal.issue.book_title}</p>
                <p className="text-muted-foreground">Borrower: {returnModal.issue.user_name}</p>
                <p className="text-muted-foreground font-mono">
                  Due: {returnModal.issue.due_date}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="finePaidCheck"
                  checked={finePaid}
                  onChange={(e) => setFinePaid(e.target.checked)}
                  className="rounded border-border"
                />
                <label htmlFor="finePaidCheck" className="cursor-pointer font-medium">
                  Collect and mark overdue fines as settled
                </label>
              </div>

              <div>
                <label className="font-semibold block mb-1">Condition / Return Remarks</label>
                <input
                  type="text"
                  placeholder="e.g. Returned in good condition"
                  value={returnRemarks}
                  onChange={(e) => setReturnRemarks(e.target.value)}
                  className="w-full bg-secondary/50 border border-border/80 rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => setReturnModal({ issue: null })}
                  className="px-4 py-2 border border-border/80 rounded-lg hover:bg-secondary/60 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReturnBook}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg shadow-md transition-colors disabled:opacity-50"
                >
                  {actionLoading ? "Processing..." : "Confirm Return"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mentor Book Request Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border/80 rounded-2xl w-full max-w-lg p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <h2 className="text-lg font-bold text-foreground mb-1">Mentor Library Request</h2>
            <p className="text-xs text-muted-foreground mb-4">
              Submit a book reservation, acquisition proposal, or reference hold to the Library Staff.
            </p>

            <form onSubmit={handleCreateRequest} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold block mb-1">Target Book *</label>
                <select
                  required
                  value={requestForm.book}
                  onChange={(e) => {
                    const selBook = books.find((b) => b.id === e.target.value);
                    setRequestForm({
                      ...requestForm,
                      book: e.target.value,
                      book_title: selBook?.title || "",
                    });
                  }}
                  className="w-full bg-secondary/50 border border-border/80 rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">Select a title from the catalog...</option>
                  {books.map((b) => (
                    <option key={b.id} value={b.id} className="bg-slate-900 text-foreground">
                      {b.title} — {b.author} ({b.available_copies} free)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Request Type</label>
                  <select
                    value={requestForm.request_type}
                    onChange={(e) => setRequestForm({ ...requestForm, request_type: e.target.value })}
                    className="w-full bg-secondary/50 border border-border/80 rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="RESERVATION">Reservation for Cohort</option>
                    <option value="ACQUISITION">New Edition / Additional Copies</option>
                    <option value="HOLD">Academic Reference Hold</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold block mb-1">Urgency</label>
                  <select
                    value={requestForm.urgency}
                    onChange={(e) => setRequestForm({ ...requestForm, urgency: e.target.value })}
                    className="w-full bg-secondary/50 border border-border/80 rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="LOW">Low (Upcoming Semester)</option>
                    <option value="MEDIUM">Medium (Current Coursework)</option>
                    <option value="HIGH">High (Immediate Exam Prep)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold block mb-1">Justification / Cohort Notes *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. 15 mentee students require this reference text for upcoming mid-term algorithm assignments..."
                  value={requestForm.justification}
                  onChange={(e) => setRequestForm({ ...requestForm, justification: e.target.value })}
                  className="w-full bg-secondary/50 border border-border/80 rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => setShowRequestModal(false)}
                  className="px-4 py-2 border border-border/80 rounded-lg hover:bg-secondary/60 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white font-semibold rounded-lg shadow-md transition-colors disabled:opacity-50"
                >
                  {submitting ? "Submitting..." : "Submit to Library Staff"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Library Staff Request Review Modal */}
      {reviewReqModal.req && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border/80 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <h2 className="text-lg font-bold text-foreground mb-1">
              {reviewReqModal.action === "APPROVED" ? "Approve Mentor Request" : "Reject Mentor Request"}
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              {reviewReqModal.req.book_title} — Requested by {reviewReqModal.req.requested_by_name}
            </p>

            <div className="space-y-4 text-xs">
              <div className="bg-secondary/30 p-3 rounded-lg border border-border/40 space-y-1">
                <p><strong>Justification:</strong> {reviewReqModal.req.justification}</p>
                <p><strong>Type:</strong> {reviewReqModal.req.request_type} • <strong>Urgency:</strong> {reviewReqModal.req.urgency}</p>
              </div>

              <div>
                <label className="font-semibold block mb-1">Staff Remarks</label>
                <input
                  type="text"
                  placeholder={
                    reviewReqModal.action === "APPROVED"
                      ? "e.g. Copies held at Issue Desk 2 for 48 hours."
                      : "e.g. Currently unavailable; reprint on order."
                  }
                  value={reviewRemarks}
                  onChange={(e) => setReviewRemarks(e.target.value)}
                  className="w-full bg-secondary/50 border border-border/80 rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => setReviewReqModal({ req: null, action: "APPROVED" })}
                  className="px-4 py-2 border border-border/80 rounded-lg hover:bg-secondary/60 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReviewRequest}
                  disabled={actionLoading}
                  className={`px-4 py-2 font-semibold rounded-lg shadow-md transition-colors disabled:opacity-50 text-white ${
                    reviewReqModal.action === "APPROVED"
                      ? "bg-emerald-600 hover:bg-emerald-500"
                      : "bg-rose-600 hover:bg-rose-500"
                  }`}
                >
                  {actionLoading
                    ? "Processing..."
                    : reviewReqModal.action === "APPROVED"
                    ? "Confirm Approval"
                    : "Confirm Rejection"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
