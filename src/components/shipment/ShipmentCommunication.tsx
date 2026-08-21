"use client";

import { useEffect, useState, useRef } from "react";
import { MessageSquare, Send, Paperclip, Check, CheckCheck, FileText, Download, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useCompany } from "@/lib/company-context";
import { useUser } from "@/lib/auth-context";
import { useSocket } from "@/hooks/use-socket";
import type { ShipmentMessage, MessageType } from "@/lib/types";
import { toast } from "sonner";

interface TypingUser {
  userId: string;
  senderName: string;
  senderType: string;
}

export function ShipmentCommunication({ shipmentId, status }: { shipmentId: string; status?: string }) {
  const { userRecord } = useCompany();
  const { user } = useUser();
  const [messages, setMessages] = useState<ShipmentMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [sendError, setSendError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isSuperAdmin = userRecord?.role === "super_admin";
  const isCrossCompany = isSuperAdmin && typeof window !== "undefined" && new URLSearchParams(window.location.search).has("companyId");
  const targetCompanyId = isCrossCompany && typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("companyId") : null;
  const isCompleted = status === "completed" || status === "cancelled";
  const isLocked = isCrossCompany || isCompleted;

  const { emit } = useSocket({
    on: {
      "message:new": (msg: unknown) => {
        const m = msg as ShipmentMessage;
        if (m.shipmentId === shipmentId) {
          setMessages(prev => {
            if (prev.some(existing => existing.messageId === m.messageId)) return prev;
            return [...prev, m];
          });
          // Remove typing indicator when message arrives from that user
          setTypingUsers(prev => prev.filter(u => u.userId !== m.senderId));
        }
      },
      "message:read": (data: unknown) => {
        const { readAt } = data as { readAt: string };
        setMessages(prev => prev.map(m => (!m.readStatus ? { ...m, readStatus: true, readAt } : m)));
      },
      "typing:started": (data: unknown) => {
        const { shipmentId: sid, userId, senderName, senderType } = data as { shipmentId: string; userId: string; senderName: string; senderType: string };
        if (sid === shipmentId && userId !== userRecord?.userId) {
          setTypingUsers(prev => {
            if (prev.some(u => u.userId === userId)) return prev;
            return [...prev, { userId, senderName, senderType }];
          });
        }
      },
      "typing:stopped": (data: unknown) => {
        const { shipmentId: sid, userId } = data as { shipmentId: string; userId: string };
        if (sid === shipmentId) {
          setTypingUsers(prev => prev.filter(u => u.userId !== userId));
        }
      }
    }
  });

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUsers]);

  // Fetch messages and mark as read
  useEffect(() => {
    async function fetchMessages() {
      if (!user) return;
      try {
        const token = await user.getIdToken();
        const query = targetCompanyId ? `?companyId=${targetCompanyId}` : "";
        const res = await fetch(`/api/intelligence/shipments/${shipmentId}/messages${query}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setMessages(data.messages || []);

          // Trigger read receipt for any unread messages
          if (!isCrossCompany) {
            fetch(`/api/intelligence/shipments/${shipmentId}/messages/read`, { method: "POST" }).catch(() => {});
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    
    fetchMessages();
  }, [shipmentId, targetCompanyId, isCrossCompany]);

  // Handle typing indicator trigger
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    
    if (isCrossCompany) return;

    // Emit typing:start
    emit("typing:start", {
      shipmentId,
      senderName: userRecord?.name || "Dispatcher",
      senderType: userRecord?.role || "Dispatcher"
    });

    // Reset auto-timeout
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      emit("typing:stop", { shipmentId });
    }, 3000);
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isCrossCompany || !newMessage.trim()) return;

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    emit("typing:stop", { shipmentId });

    setSending(true);
    try {
      const payload = {
        message: newMessage.trim(),
        messageType: "text" as MessageType
      };
      
      const res = await fetch(`/api/intelligence/shipments/${shipmentId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, data.message]);
        setNewMessage("");
        setSendError(null);
      } else {
        const body = await res.json().catch(() => ({})) as { error?: string };
        setSendError(body.error ?? `Failed to send (${res.status})`);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  // Real Firebase Storage upload for chat attachments
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || isCrossCompany) return;

    // Validate size (max 15MB)
    if (file.size > 15 * 1024 * 1024) {
      toast.error("File size exceeds 15MB limit");
      return;
    }

    setUploading(true);
    try {
      const { storage } = await import("@/lib/firebase");
      const { ref, uploadBytes, getDownloadURL } = await import("firebase/storage");
      
      const fileExt = file.name.split(".").pop() || "";
      const storagePath = `attachments/${shipmentId}/${Date.now()}_${file.name}`;
      const fileRef = ref(storage, storagePath);
      
      const snapshot = await uploadBytes(fileRef, file);
      const downloadUrl = await getDownloadURL(snapshot.ref);

      let messageType: MessageType = "document";
      if (file.type.startsWith("image/")) {
        messageType = "image";
      } else if (file.type === "application/pdf" || fileExt === "pdf") {
        messageType = "pdf";
      }

      const payload = {
        message: file.name,
        messageType,
        fileUrl: downloadUrl,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type || `application/${fileExt}`
      };

      const res = await fetch(`/api/intelligence/shipments/${shipmentId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, data.message]);
        toast.success("Attachment uploaded");
      } else {
        throw new Error("Failed to save attachment message");
      }
    } catch (err) {
      console.error("Upload failed", err);
      toast.error("Attachment upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="panel bg-card border border-border rounded-xl flex flex-col h-[480px]">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">Direct Communication</h3>
        </div>
        <span className="text-xs text-muted-foreground">
          {messages.length} message{messages.length === 1 ? "" : "s"}
        </span>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading && messages.length === 0 ? (
          <div className="text-sm text-center text-muted-foreground animate-pulse mt-10">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="text-sm text-center text-muted-foreground mt-10">No messages yet. Start the conversation.</div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map(msg => {
              const isMe = msg.senderId === userRecord?.userId || msg.senderType === "Dispatcher" || msg.senderType === "Operations Manager";
              return (
                <motion.div 
                  key={msg.messageId} 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                >
                  <span className="text-[10px] text-muted-foreground mb-1 ml-1 font-medium">{msg.senderName} ({msg.senderType})</span>
                  <div className={`px-4 py-2.5 rounded-2xl max-w-[85%] text-sm shadow-sm ${
                    isMe ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-muted text-foreground rounded-tl-sm border border-border/50"
                  }`}>
                    {msg.messageType === "image" && msg.fileUrl ? (
                      <div className="flex flex-col gap-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img 
                          src={msg.fileUrl} 
                          alt={msg.fileName || "attachment"} 
                          className="rounded-lg max-w-full h-auto max-h-[180px] object-cover cursor-pointer hover:opacity-95 transition-opacity" 
                          onClick={() => window.open(msg.fileUrl, "_blank")}
                        />
                        {msg.message && msg.message !== msg.fileName && (
                          <span className="text-xs opacity-90">{msg.message}</span>
                        )}
                      </div>
                    ) : (msg.messageType === "pdf" || msg.messageType === "document") && msg.fileUrl ? (
                      <div className="flex items-center gap-3 py-1">
                        <div className="p-2 rounded-lg bg-background/20 backdrop-blur-sm">
                          <FileText className="w-6 h-6" />
                        </div>
                        <div className="flex flex-col min-w-0 pr-2">
                          <span className="font-semibold text-xs truncate max-w-[180px]">{msg.fileName || msg.message}</span>
                          <span className="text-[10px] opacity-75">{formatFileSize(msg.fileSize)}</span>
                        </div>
                        <a 
                          href={msg.fileUrl} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          download 
                          className="p-1.5 rounded-full hover:bg-background/20 transition-colors"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap break-words">{msg.message}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-1 mr-1">
                    <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    {isMe && (
                      msg.readStatus ? <CheckCheck className="w-3.5 h-3.5 text-blue-500" /> : <Check className="w-3.5 h-3.5" />
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}

        {/* Live typing indicator bubble */}
        {typingUsers.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 px-3 py-1.5 rounded-full w-fit border border-border/40"
          >
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
            <span>{typingUsers.map(u => u.senderName).join(", ")} is typing...</span>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 border-t border-border bg-muted/10">
        {sendError && (
          <p className="text-xs text-red-400 px-2 pb-2">{sendError}</p>
        )}
        {isCompleted && (
          <p className="text-xs text-muted-foreground px-2 pb-2 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
            {status === "cancelled" ? "Cancelled shipment — communication locked." : "Completed shipment — communication locked."}
          </p>
        )}
        <form onSubmit={handleSend} className="flex items-center gap-2">
          <input 
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf,.doc,.docx,.txt,.csv"
            className="hidden"
            onChange={handleFileUpload}
            disabled={uploading || sending || isCrossCompany}
          />
          <button 
            type="button" 
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || sending || isCrossCompany}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors disabled:opacity-50 relative"
            title="Attach file (image, PDF, doc)"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <Paperclip className="w-4 h-4" />}
          </button>

          <input 
            type="text" 
            value={newMessage}
            onChange={handleInputChange}
            placeholder={isCrossCompany ? "Read-only mode (Super Admin)" : "Type message..."}
            className="flex-1 bg-background border border-input rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={sending || uploading || isLocked}
          />
          <button 
            type="submit" 
            disabled={sending || uploading || isLocked || !newMessage.trim()}
            className="p-2 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
