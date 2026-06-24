"use client";

import { useEffect, useState } from "react";
import { MessageSquare, Send } from "lucide-react";
import { useCompany } from "@/lib/company-context";

export function ShipmentCommunication({ shipmentId }: { shipmentId: string }) {
  const { userRecord } = useCompany();
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);

  const isSuperAdmin = userRecord?.role === "super_admin";
  const isCrossCompany = isSuperAdmin && typeof window !== "undefined" && new URLSearchParams(window.location.search).has("companyId");
  const targetCompanyId = isCrossCompany && typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("companyId") : null;

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
    const interval = setInterval(fetchMessages, 10000); // Simple polling
    return () => clearInterval(interval);
  }, [shipmentId, targetCompanyId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCrossCompany || !newMessage.trim()) return;

    setSending(true);
    try {
      const res = await fetch(`/api/intelligence/shipments/${shipmentId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: newMessage })
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, data.message]);
        setNewMessage("");
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
          messages.map(msg => {
            const isMe = msg.senderType === "Dispatcher" || msg.senderType === "Operations Manager";
            return (
              <div key={msg.messageId} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                <span className="text-[10px] text-muted-foreground mb-1 ml-1">{msg.senderName} ({msg.senderType})</span>
                <div className={`px-4 py-2 rounded-2xl max-w-[85%] text-sm ${
                  isMe ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-muted text-foreground rounded-tl-sm"
                }`}>
                  {msg.message}
                </div>
                <span className="text-[10px] text-muted-foreground mt-1 mr-1">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            );
          })
        )}
      </div>

      <div className="p-3 border-t border-border bg-muted/10">
        <form onSubmit={handleSend} className="flex items-center gap-2">
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
