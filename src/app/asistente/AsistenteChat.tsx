"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useRef, useEffect, useState } from "react";
import { Send } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const SUGERENCIAS = [
    "¿Quién lidera el ranking?",
    "¿Cuáles son mis estadísticas?",
    "¿Quién ha marcado más goles?",
    "¿Cuándo es el próximo partido?",
];

export function AsistenteChat() {
    const { messages, sendMessage, status, error } = useChat({
        transport: new DefaultChatTransport({ api: "/api/asistente" }),
    });
    const [input, setInput] = useState("");
    const scrollRef = useRef<HTMLDivElement>(null);

    const isLoading = status === "submitted" || status === "streaming";

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isLoading]);

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        const text = input.trim();
        if (!text || isLoading) return;
        setInput("");
        sendMessage({ text });
    }

    return (
        <div
            className="flex flex-col rounded-2xl border border-border bg-surface"
            style={{ minHeight: "calc(100vh - 10rem)" }}
        >
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
                <Avatar src="/panenka.png" fallback="⚽" size="sm" />
                <div>
                    <h1 className="text-sm font-bold text-foreground">Panenka</h1>
                    <p className="text-[10px] text-muted">Tu asistente futbolero</p>
                </div>
                <span className="ml-auto flex items-center gap-1.5">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
                    <span className="text-[10px] font-medium text-accent">En línea</span>
                </span>
            </div>

            {/* Messages */}
            <div
                ref={scrollRef}
                className="flex-1 space-y-4 overflow-y-auto px-4 py-4"
            >
                {messages.length === 0 && (
                    <div className="flex flex-col items-center gap-6 py-8 text-center">
                        <Avatar src="/panenka.png" fallback="⚽" size="lg" />
                        <div>
                            <p className="font-semibold text-foreground">
                                ¡Hola! Soy Panenka
                            </p>
                            <p className="mt-1 text-sm text-muted">
                                Pregúntame lo que quieras sobre los datos de Pachanga
                            </p>
                        </div>
                        <div className="grid w-full grid-cols-2 gap-2">
                            {SUGERENCIAS.map((s) => (
                                <button
                                    key={s}
                                    onClick={() => setInput(s)}
                                    className="rounded-xl border border-border bg-surface-hover px-3 py-2.5 text-left text-xs text-muted transition-colors hover:border-accent/40 hover:text-foreground"
                                >
                                    ⚽ {s}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {messages.map((m) => {
                    const isUser = m.role === "user";
                    // Extraer texto de los parts del mensaje (API v6)
                    const text = m.parts
                        .filter((p) => p.type === "text")
                        .map((p) => (p as { type: "text"; text: string }).text)
                        .join("");
                    if (!text) return null;

                    return (
                        <div
                            key={m.id}
                            className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}
                        >
                            {!isUser && (
                                <Avatar
                                    src="/panenka.png"
                                    fallback="⚽"
                                    size="sm"
                                    className="mt-0.5 shrink-0"
                                />
                            )}
                            <div
                                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                                    isUser
                                        ? "rounded-tr-sm bg-accent/10 text-foreground"
                                        : "rounded-tl-sm bg-surface-hover text-foreground"
                                }`}
                            >
                                {isUser ? (
                                    <p className="whitespace-pre-wrap break-words">{text}</p>
                                ) : (
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm]}
                                        components={{
                                            p: ({ children }) => <p className="mb-1 last:mb-0 whitespace-pre-wrap break-words">{children}</p>,
                                            strong: ({ children }) => <strong className="font-bold text-accent">{children}</strong>,
                                            em: ({ children }) => <em className="italic">{children}</em>,
                                            ul: ({ children }) => <ul className="ml-4 mt-1 list-disc space-y-0.5">{children}</ul>,
                                            ol: ({ children }) => <ol className="ml-4 mt-1 list-decimal space-y-0.5">{children}</ol>,
                                            li: ({ children }) => <li>{children}</li>,
                                            code: ({ children }) => <code className="rounded bg-zinc-700 px-1 py-0.5 font-mono text-xs">{children}</code>,
                                            table: ({ children }) => (
                                                <div className="my-2 overflow-x-auto">
                                                    <table className="w-full text-xs" style={{ borderCollapse: "collapse" }}>{children}</table>
                                                </div>
                                            ),
                                            thead: ({ children }) => <thead>{children}</thead>,
                                            th: ({ children }) => <th className="px-3 py-2 text-left font-semibold text-accent bg-zinc-800" style={{ border: "1px solid #3f3f46" }}>{children}</th>,
                                            td: ({ children }) => <td className="px-3 py-1.5" style={{ border: "1px solid #3f3f46" }}>{children}</td>,
                                        }}
                                    >
                                        {text}
                                    </ReactMarkdown>
                                )}
                            </div>
                        </div>
                    );
                })}

                {isLoading && (
                    <div className="flex gap-2.5">
                        <Avatar
                            src="/panenka.png"
                            fallback="⚽"
                            size="sm"
                            className="mt-0.5 shrink-0"
                        />
                        <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm bg-surface-hover px-4 py-3">
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted [animation-delay:0ms]" />
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted [animation-delay:150ms]" />
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted [animation-delay:300ms]" />
                        </div>
                    </div>
                )}

                {error && (
                    <p className="text-center text-xs text-red-400">
                        Panenka no está disponible ahora mismo, intenta en un momento
                    </p>
                )}
            </div>

            {/* Input */}
            <form
                onSubmit={handleSubmit}
                className="flex items-center gap-2 border-t border-border px-4 py-3"
            >
                <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Pregunta a Panenka..."
                    disabled={isLoading}
                    className="flex-1 rounded-xl border border-border bg-zinc-800 px-4 py-2.5 text-sm text-foreground placeholder:text-muted/60 transition-colors focus:border-accent focus:outline-none disabled:opacity-50"
                />
                <button
                    type="submit"
                    disabled={!input.trim() || isLoading}
                    aria-label="Enviar mensaje"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-zinc-950 transition-all hover:bg-accent-hover active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                >
                    <Send size={16} />
                </button>
            </form>
        </div>
    );
}
