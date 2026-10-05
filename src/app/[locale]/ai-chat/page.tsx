"use client";

import { useState, useRef, useEffect } from "react";
import { Send, FileCode, Bot, User, Loader2 } from "lucide-react";
import MarkdownPreview from "@uiw/react-markdown-preview";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function AIChatPage() {
  const { accessToken } = useSimpleAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Yeni mesaj geldiğinde ekranı otomatik aşağı kaydırır
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (textToSend?: string) => {
    const messageContent = textToSend || input;
    if (!messageContent.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: messageContent };
    setMessages((prev) => [...prev, userMessage]);
    if (!textToSend) setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          messages: messages,
          currentMessage: messageContent,
        }),
      });

      const data = await response.json();

      if (data.reply) {
        setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      } else if (data.error) {
        setMessages((prev) => [...prev, { role: "assistant", content: `❌ Hata: ${data.error}` }]);
      }
    } catch (error) {
      setMessages((prev) => [...prev, { role: "assistant", content: "❌ Sunucu ile bağlantı kurulamadı." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-slate-100">
      {/* Üst Bar */}
      <div className="flex items-center justify-between px-6 py-4 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <Bot className="w-6 h-6 text-emerald-400" />
          <h1 className="text-xl font-bold tracking-wide">Bilet Ekosistemi AI Asistanı</h1>
        </div>
        <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded border border-emerald-500/30 font-mono">Qwen 3.8 Online</span>
      </div>

      {/* Mesaj Alanı */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 max-w-md mx-auto text-center space-y-4">
            <Bot className="w-12 h-12 text-slate-600 animate-pulse" />
            <p className="text-sm">Projenizle ilgili her şeyi sorabilirsiniz. Dosyaları inceletmek için özel komutu kullanabilirsiniz:</p>
            <button 
              onClick={() => handleSend("oku: scripts/dev.js")}
              className="flex items-center gap-2 text-xs bg-slate-800 hover:bg-slate-700 text-emerald-400 px-3 py-2 rounded-lg border border-slate-700 transition"
            >
              <FileCode className="w-4 h-4" />
              Örnek: oku: scripts/dev.js
            </button>
          </div>
        )}

        {messages.map((msg, index) => (
          <div key={index} className={`flex gap-4 max-w-3xl mx-auto ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center shrink-0 shadow-md">
                <Bot className="w-5 h-5 text-white" />
              </div>
            )}
            
            {msg.role === "user" ? (
              // Kullanıcı mesajları düz metin olarak sağda kalmaya devam ediyor
              <div className="px-4 py-3 rounded-xl text-sm leading-relaxed shadow-md bg-emerald-600 text-white rounded-tr-none whitespace-pre-wrap">
                {msg.content}
              </div>
            ) : (
              // Yapay zeka yanıtları Markdown şıklığıyla kod renklendirmeli gösteriliyor
              <div 
                className="px-4 py-3 rounded-xl text-sm leading-relaxed shadow-md bg-slate-800 text-slate-100 rounded-tl-none border border-slate-700 overflow-x-auto w-full"
                data-color-mode="dark" // Karanlık mod stilini zorunlu kılıyoruz
              >
                <MarkdownPreview 
                  source={msg.content} 
                  wrapperElement={{ "data-color-mode": "dark" }}
                  style={{ backgroundColor: "transparent", color: "inherit", fontSize: "0.875rem" }}
                />
              </div>
            )}

            {msg.role === "user" && (
              <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center shrink-0 shadow-md">
                <User className="w-5 h-5 text-slate-300" />
              </div>
            )}
          </div>
        ))}
        
        {isLoading && (
          <div className="flex gap-4 max-w-3xl mx-auto justify-start">
            <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shadow-md">
              <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
            </div>
            <div className="px-4 py-3 bg-slate-800 text-slate-400 text-xs rounded-xl rounded-tl-none border border-slate-700 flex items-center gap-2">
              Groq veriyi analiz ediyor...
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Girdi Alanı */}
      <div className="p-4 bg-slate-800 border-t border-slate-700">
        <div className="max-w-3xl mx-auto flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Sorunuzu yazın veya 'oku: klasor/dosya.js' ile kod analizi başlatın..."
            className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 text-slate-100 placeholder-slate-500 transition"
          />
          <button
            onClick={() => handleSend()}
            disabled={isLoading}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white p-3 rounded-xl transition shadow-lg flex items-center justify-center"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
