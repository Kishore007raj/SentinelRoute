"use client";

import { useEffect, useState, useRef } from "react";
import { MessageSquare, Send, Paperclip, Check, CheckCheck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useCompany } from "@/lib/company-context";
import { useSocket } from "@/hooks/use-socket";
import type { ShipmentMessage } from "@/lib/types";

export function ShipmentCommunication({ shipmentId }: { shipmentId: string }) {
  const { userRecord } = useCompany();
  const [messages, setMessages] = useState<ShipmentMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);

  const isSuperAdmin = userRecord?.role === "super_admin";
  const isCrossCompany = isSuperAdmin && typeof window !== "undefined" && new URLSearchParams(window.location.search).has("companyId");
  const targetCompanyId = isCrossCompany && typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("companyId") : null;

  useSocket({
    on: {
      "message:new": (msg: unknown) => {
        const m = msg as ShipmentMessage;
        if (m.shipmentId === shipmentId) {
          setMessages(prev => {
            if (prev.some(existing => existing.messageId === m.messageId)) return prev;
            return [...prev, m];
          });
          // Auto-mark as read if we received it
          if (m.senderType !== "Dispatcher" && m.senderType !== "Operations Manager") {
             // In a real app we'd emit message:read back
          }
        }
      },
      "message:read": (data: unknown) => {
        const { messageIds } = data as { messageIds: string[] };
        setMessages(prev => prev.map(m => messageIds.includes(m.messageId) ? { ...m, readStatus: true } : m));
      }
    }
  });

  useEffect(() => {
    async function fetchMessages() {
      try {
        const query = targetCompanyId ? `?companyId=${targetCompanyId}` : "";
        const res = await fetch(`/api/intelligence/shipments/${shipmentId}/messages${query}`);
        if (res.ok) {
          const data = await res.json();
          setMessages(data.messages || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    
    fetchMessages();
  }, [shipmentId, targetCompanyId]);

  const handleSend = async (e?: React.FormEvent, isAttachment = false) => {
    if (e) e.preventDefault();
    if (isCrossCompany || (!newMessage.trim() && !isAttachment)) return;

    setSending(true);
    try {
      const payload = {
        message: isAttachment ? "Sent an attachment" : newMessage,
        messageType: isAttachment ? "image" : "text",
        fileUrl: isAttachment ? "https://images.unsplash.com/photo-1580674285054-bed31e145f59?q=80&w=2070&auto=format&fit=crop" : undefined
      };
      
      const res = await fetch(`/api/intelligence/shipments/${shipmentId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, data.message]);
        if (!isAttachment) setNewMessage("");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="panel bg-card border border-border rounded-xl flex flex-col h-[400px]">
      <div className="p-4 border-b border-border flex items-center gap-2">
        <MessageSquare className="w-4 h-4 text-primary" />
        <h3 className="font-semibold">Direct Communication</h3>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading && messages.length === 0 ? (
          <div className="text-sm text-center text-muted-foreground animate-pulse mt-10">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="text-sm text-center text-muted-foreground mt-10">No messages yet.</div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map(msg => {
              const isMe = msg.senderType === "Dispatcher" || msg.senderType === "Operations Manager";
              return (
                <motion.div 
                  key={msg.messageId} 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                >
                  <span className="text-[10px] text-muted-foreground mb-1 ml-1">{msg.senderName} ({msg.senderType})</span>
                  <div className={`px-4 py-2 rounded-2xl max-w-[85%] text-sm ${
                    isMe ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-muted text-foreground rounded-tl-sm"
                  }`}>
                    {msg.messageType === "image" && msg.fileUrl ? (
                      <div className="flex flex-col gap-2">
                        <img src={msg.fileUrl} alt="attachment" className="rounded-md max-w-full h-auto max-h-[150px] object-cover" />
                        <span className="text-xs opacity-90">{msg.message}</span>
                      </div>
                    ) : (
                      msg.message
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-1 mr-1">
                    <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    {isMe && (
                      msg.readStatus ? <CheckCheck className="w-3 h-3 text-blue-500" /> : <Check className="w-3 h-3" />
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      <div className="p-3 border-t border-border bg-muted/10">
        <form onSubmit={handleSend} className="flex items-center gap-2">
          <button 
            type="button" 
            onClick={() => handleSend(undefined, true)}
            disabled={sending || isCrossCompany}
            className="p-2 text-muted-foreground hover:bg-muted rounded-full transition-colors disabled:opacity-50"
            title="Attach Mock File"
          >
            <Paperclip className="w-4 h-4" />
          </button>
          <input 
            type="text" 
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={isCrossCompany ? "Read-only mode (Super Admin)" : "Type message to driver..."}
            className="flex-1 bg-background border border-input rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            disabled={sending || isCrossCompany}
          />
          <button 
            type="submit" 
            disabled={sending || isCrossCompany || !newMessage.trim()}
            className="p-2 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
