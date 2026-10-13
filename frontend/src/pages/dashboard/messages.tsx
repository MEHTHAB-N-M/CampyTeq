"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  MessageSquare,
  Send,
  Plus,
  User,
  Users,
  Search,
  Clock,
  CheckCheck,
  Shield,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/api";
import { Badge } from "@/components/ui/badge";

interface Participant {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
}

interface MessageItem {
  id: string;
  sender: string;
  sender_name: string;
  sender_role?: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

interface ConversationItem {
  id: string;
  subject: string;
  participants: Participant[];
  last_message?: MessageItem;
  last_message_at: string;
  messages: MessageItem[];
}

export default function MessagesPage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [inputMessage, setInputMessage] = useState("");
  const [sending, setSending] = useState(false);

  // New Chat Modal
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [contacts, setContacts] = useState<Participant[]>([]);
  const [selectedContactId, setSelectedContactId] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [initialMessage, setInitialMessage] = useState("");
  const [creatingChat, setCreatingChat] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchConversations = async () => {
    try {
      setLoading(true);
      const res = await apiRequest<any>("/communication/conversations/");
      const items: ConversationItem[] = res?.results || (Array.isArray(res) ? res : []);
      setConversations(items);
      if (items.length > 0 && !activeConvId) {
        setActiveConvId(items[0].id);
      }
    } catch (err) {
      console.error("Failed to load conversations", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchContacts = async () => {
    try {
      const res = await apiRequest<Participant[]>("/communication/contacts/");
      setContacts(res || []);
    } catch (err) {
      console.error("Failed to load contacts", err);
    }
  };

  useEffect(() => {
    fetchConversations();
    fetchContacts();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversations, activeConvId]);

  const activeConv = conversations.find((c) => c.id === activeConvId);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !activeConvId || sending) return;

    try {
      setSending(true);
      const resMsg = await apiRequest<MessageItem>(
        `/communication/conversations/${activeConvId}/send_message/`,
        {
          method: "POST",
          body: JSON.stringify({ content: inputMessage.trim() }),
        }
      );

      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === activeConvId) {
            return {
              ...c,
              last_message_at: new Date().toISOString(),
              messages: [...(c.messages || []), resMsg],
            };
          }
          return c;
        })
      );
      setInputMessage("");
    } catch (err) {
      console.error("Failed to send message", err);
      alert("Failed to send message.");
    } finally {
      setSending(false);
    }
  };

  const handleCreateChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContactId) return;

    try {
      setCreatingChat(true);
      // 1. Create conversation with participant
      const convRes = await apiRequest<ConversationItem>("/communication/conversations/", {
        method: "POST",
        body: JSON.stringify({
          subject: newSubject || "Direct Mentorship & Query",
          participants: [selectedContactId],
        }),
      });

      // 2. If initial message provided, send it
      if (initialMessage.trim()) {
        await apiRequest(`/communication/conversations/${convRes.id}/send_message/`, {
          method: "POST",
          body: JSON.stringify({ content: initialMessage.trim() }),
        });
      }

      setShowNewChatModal(false);
      setSelectedContactId("");
      setNewSubject("");
      setInitialMessage("");
      await fetchConversations();
      setActiveConvId(convRes.id);
    } catch (err) {
      console.error("Failed to start chat", err);
      alert("Failed to create conversation.");
    } finally {
      setCreatingChat(false);
    }
  };

  const otherParticipants = (conv: ConversationItem) =>
    conv.participants.filter((p) => p.email !== user?.email);

  return (
    <div className="space-y-4 h-[calc(100vh-8.5rem)] flex flex-col">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <MessageSquare className="h-6 w-6 text-indigo-400" />
            Internal Messaging & Mentorship Threads
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Secure, role-authorized messaging between students, faculty mentors, and administrators.
          </p>
        </div>

        <button
          onClick={() => setShowNewChatModal(true)}
          className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow-md shadow-indigo-600/20 flex items-center gap-2 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Thread
        </button>
      </div>

      {/* Main Split Chat Layout */}
      <div className="flex-1 flex gap-4 min-h-0 bg-card/60 rounded-2xl border border-border/60 overflow-hidden shadow-lg">
        {/* Left: Conversation List */}
        <div className="w-80 sm:w-96 border-r border-border/60 flex flex-col bg-card/30">
          <div className="p-3 border-b border-border/60 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Conversations ({conversations.length})
            </span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-border/30">
            {loading ? (
              <div className="p-8 text-center text-xs text-muted-foreground">Loading chats...</div>
            ) : conversations.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                No conversations yet. Start a new thread!
              </div>
            ) : (
              conversations.map((c) => {
                const others = otherParticipants(c);
                const title =
                  c.subject ||
                  others.map((o) => `${o.first_name} ${o.last_name}`).join(", ") ||
                  "Direct Message";

                return (
                  <div
                    key={c.id}
                    onClick={() => setActiveConvId(c.id)}
                    className={`p-3.5 cursor-pointer transition-all ${
                      activeConvId === c.id
                        ? "bg-indigo-500/15 border-l-4 border-l-indigo-500"
                        : "hover:bg-secondary/30"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1 mb-1">
                      <p className="font-semibold text-xs text-foreground truncate">{title}</p>
                      <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                        {new Date(c.last_message_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 mb-1.5">
                      {others.map((p) => (
                        <Badge
                          key={p.id}
                          variant="secondary"
                          className="text-[9px] px-1.5 py-0 bg-secondary/80 text-muted-foreground"
                        >
                          {p.role}
                        </Badge>
                      ))}
                    </div>

                    <p className="text-[11px] text-muted-foreground truncate">
                      {c.messages && c.messages.length > 0
                        ? c.messages[c.messages.length - 1].content
                        : "No messages yet"}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Active Chat View */}
        <div className="flex-1 flex flex-col bg-background/50">
          {activeConv ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-border/60 flex items-center justify-between bg-card/40">
                <div>
                  <h3 className="font-bold text-sm text-foreground">
                    {activeConv.subject || "Direct Conversation"}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                    <Users className="h-3.5 w-3.5 text-indigo-400" />
                    <span>
                      {activeConv.participants
                        .map((p) => `${p.first_name} ${p.last_name} (${p.role})`)
                        .join(", ")}
                    </span>
                  </div>
                </div>
              </div>

              {/* Message Feed */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3">
                {activeConv.messages && activeConv.messages.length > 0 ? (
                  activeConv.messages.map((msg) => {
                    const isMe = msg.sender === user?.id || msg.sender_name === user?.full_name;
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                      >
                        <div className="flex items-center gap-1.5 mb-1 text-[10px] text-muted-foreground font-mono">
                          <span>{isMe ? "You" : msg.sender_name}</span>
                          <span>•</span>
                          <span>
                            {new Date(msg.created_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <div
                          className={`max-w-md rounded-2xl px-4 py-2.5 text-xs shadow-sm ${
                            isMe
                              ? "bg-indigo-600 text-white rounded-tr-none"
                              : "bg-secondary/70 border border-border/60 text-foreground rounded-tl-none"
                          }`}
                        >
                          <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-16 text-center text-xs text-muted-foreground">
                    No messages yet in this discussion. Say hello!
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input Box */}
              <form
                onSubmit={handleSendMessage}
                className="p-3 border-t border-border/60 bg-card/40 flex items-center gap-2"
              >
                <input
                  type="text"
                  placeholder="Type an authorized internal message..."
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  className="flex-1 bg-secondary/50 border border-border/80 rounded-xl px-4 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  type="submit"
                  disabled={!inputMessage.trim() || sending}
                  className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-md transition-colors disabled:opacity-40"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8">
              <MessageSquare className="h-10 w-10 opacity-30 mb-3" />
              <p className="text-sm font-semibold text-foreground">Select a Conversation</p>
              <p className="text-xs text-muted-foreground mt-1">
                Choose a mentorship thread from the left or start a new discussion.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* New Chat Modal */}
      {showNewChatModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border/80 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <h2 className="text-lg font-bold text-foreground mb-1">Start New Conversation</h2>
            <p className="text-xs text-muted-foreground mb-4">
              Select a faculty mentor, student, or staff member from your college directory.
            </p>

            <form onSubmit={handleCreateChat} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold block mb-1">Select Contact *</label>
                <select
                  required
                  value={selectedContactId}
                  onChange={(e) => setSelectedContactId(e.target.value)}
                  className="w-full bg-secondary/50 border border-border/80 rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">-- Choose recipient --</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.first_name} {c.last_name} ({c.role} — {c.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold block mb-1">Thread Subject / Topic</label>
                <input
                  type="text"
                  placeholder="e.g. Lab Project Guidance or Attendance Clarification"
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  className="w-full bg-secondary/50 border border-border/80 rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">Initial Message</label>
                <textarea
                  rows={3}
                  placeholder="Draft your opening message..."
                  value={initialMessage}
                  onChange={(e) => setInitialMessage(e.target.value)}
                  className="w-full bg-secondary/50 border border-border/80 rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => setShowNewChatModal(false)}
                  className="px-4 py-2 border border-border/80 rounded-lg hover:bg-secondary/60 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedContactId || creatingChat}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg shadow-md transition-colors disabled:opacity-50"
                >
                  {creatingChat ? "Creating..." : "Start Thread"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
