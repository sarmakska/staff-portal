"use client"

import { useState, useRef, useEffect } from "react"
import { X, Send, Loader2 } from "lucide-react"

function JarvisIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className}>
      {/* Head */}
      <rect x="12" y="14" width="40" height="36" rx="12" fill="currentColor" opacity="0.9" />
      {/* Antenna */}
      <circle cx="32" cy="8" r="4" fill="#60a5fa">
        <animate attributeName="r" values="4;5;4" dur="2s" repeatCount="indefinite" />
      </circle>
      <line x1="32" y1="12" x2="32" y2="16" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      {/* Eyes — happy curved */}
      <circle cx="24" cy="30" r="5" fill="#60a5fa">
        <animate attributeName="opacity" values="1;0.5;1" dur="3s" repeatCount="indefinite" />
      </circle>
      <circle cx="40" cy="30" r="5" fill="#60a5fa">
        <animate attributeName="opacity" values="1;0.5;1" dur="3s" repeatCount="indefinite" delay="0.3s" />
      </circle>
      {/* Smile */}
      <path d="M24 40 Q32 47 40 40" stroke="#60a5fa" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.8" />
      {/* Ears */}
      <rect x="6" y="24" width="6" height="12" rx="3" fill="currentColor" opacity="0.7" />
      <rect x="52" y="24" width="6" height="12" rx="3" fill="currentColor" opacity="0.7" />
    </svg>
  )
}
import { useAuth } from "@/lib/providers"

interface Message {
  role: "user" | "assistant"
  text: string
}

export function ChatBubble() {
  const { profile } = useAuth()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const firstName = (profile?.display_name || profile?.full_name || "there").split(" ")[0]

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, loading])

  // Focus input when opened
  useEffect(() => {
    if (open && inputRef.current) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  // Welcome message on first open
  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{
        role: "assistant",
        text: `Hey ${firstName}! I'm Jarvis — Master Sai designed me to help you out around here. Ask me anything about your leave, attendance, schedule, or how to do stuff on Nexus 🤙`,
      }])
    }
  }, [open])

  async function handleSend() {
    const msg = input.trim()
    if (!msg || loading) return

    setInput("")
    setMessages(prev => [...prev, { role: "user", text: msg }])
    setLoading(true)

    try {
      const history = messages.map(m => ({
        role: m.role,
        content: m.text,
      }))

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, history }),
      })

      const data = await res.json()
      setMessages(prev => [...prev, { role: "assistant", text: data.reply ?? "Sorry, something went wrong." }])
    } catch {
      setMessages(prev => [...prev, { role: "assistant", text: "I'm having trouble connecting. Please try again." }])
    } finally {
      setLoading(false)
    }
  }

  if (!profile) return null

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 md:bottom-6 md:right-6 bottom-20 z-50 h-14 w-14 rounded-full bg-gradient-to-br from-violet-500 to-indigo-700 text-white shadow-lg shadow-violet-500/25 flex items-center justify-center hover:scale-110 hover:shadow-xl hover:shadow-violet-500/30 active:scale-95 transition-all duration-200"
          title="Chat with Jarvis"
        >
          <JarvisIcon className="h-8 w-8" />
          <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-400 border-2 border-background animate-pulse" />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed inset-0 sm:inset-auto sm:bottom-6 sm:right-6 z-50 sm:w-[380px] sm:h-[520px] flex flex-col bg-card border border-border/50 sm:rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-violet-600 to-indigo-700 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center text-white">
                <JarvisIcon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-white leading-tight">Jarvis</p>
                <p className="text-[10px] text-white/60">AI Assistant</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="h-7 w-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
              <X className="h-4 w-4 text-white" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "bg-muted text-foreground rounded-bl-md"
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="shrink-0 border-t border-border/50 px-3 py-2.5 bg-card">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
                placeholder="Ask Jarvis anything..."
                disabled={loading}
                className="flex-1 bg-muted/50 border border-border/40 rounded-xl px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all disabled:opacity-50"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || loading}
                className="h-10 w-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 active:scale-95 transition-all disabled:opacity-30 shrink-0"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-[9px] text-muted-foreground/50 text-center mt-1.5">Jarvis AI — your personal StaffPortal assistant</p>
          </div>
        </div>
      )}
    </>
  )
}
