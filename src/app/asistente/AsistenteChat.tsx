"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useRef, useEffect, useState, type CSSProperties } from "react";
import { Send } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { AvisoError } from "@/components/AvisoError";
import { Fila, Filas } from "@/components/Filas";
import { Panenka } from "@/components/Panenka";
import { Button } from "@/components/ui/Button";
import { frasePensando, fraseVacio } from "@/lib/titulares";

const MD_PLUGINS = [remarkGfm];
const MD_COMPONENTS: Components = {
    p: ({ children }) => <p className="mb-3 whitespace-pre-wrap break-words last:mb-0">{children}</p>,
    strong: ({ children }) => <strong className="font-bold">{children}</strong>,
    // Sin cursivas: el énfasis va por peso
    em: ({ children }) => <em className="font-medium not-italic">{children}</em>,
    h1: ({ children }) => <h2 className="t-seccion mb-2 mt-5 first:mt-0">{children}</h2>,
    h2: ({ children }) => <h2 className="t-seccion mb-2 mt-5 first:mt-0">{children}</h2>,
    h3: ({ children }) => <h3 className="mb-1 mt-4 font-bold first:mt-0">{children}</h3>,
    ul: ({ children }) => <ul className="mb-3 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>,
    ol: ({ children }) => <ol className="mb-3 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>,
    li: ({ children }) => <li>{children}</li>,
    a: ({ children, href }) => (
        <a href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
            {children}
        </a>
    ),
    blockquote: ({ children }) => <blockquote className="mb-3 border-l-2 border-border-hover pl-3 text-muted">{children}</blockquote>,
    hr: () => <hr className="my-4 border-border" />,
    pre: ({ children }) => <pre className="mb-3 overflow-x-auto bg-surface p-3 font-sans text-[14px]">{children}</pre>,
    code: ({ children }) => <code className="bg-surface px-1 py-0.5 font-sans text-[15px]">{children}</code>,
    // A sangre: la tabla tiene todo el ancho del móvil y solo se desplaza si de verdad no cabe
    table: ({ children }) => (
        <div className="-mx-4 mb-3 overflow-x-auto px-4 last:mb-0">
            <table className="w-full border-collapse text-[14px] leading-[1.3] tabular-nums">{children}</table>
        </div>
    ),
    thead: ({ children }) => <thead>{children}</thead>,
    th: ({ children }) => (
        <th className="border-b border-border-hover py-2 pr-3 text-left font-medium text-muted last:pr-0">{children}</th>
    ),
    td: ({ children }) => (
        <td className="border-b border-border py-2 pr-3 align-top [overflow-wrap:anywhere] last:pr-0">{children}</td>
    ),
};

const SUGERENCIAS = [
    "¿Quién lidera el ranking?",
    "¿Cuáles son mis estadísticas?",
    "¿Quién ha marcado más goles?",
    "¿Cuándo es el próximo partido?",
];

const transport = new DefaultChatTransport({ api: "/api/asistente" });

// A esta distancia del final se considera que sigues abajo
const MARGEN_PEGADO = 96;

function textoDe(partes: { type: string; text?: string }[]) {
    return partes
        .filter((p) => p.type === "text")
        .map((p) => p.text ?? "")
        .join("");
}

function fraseDeError(error: Error) {
    // El 429 de la ruta trae su propia frase, con un emoji que aquí no va
    if (error.message.includes("descanso")) return "Panenka necesita un descanso, espera un momento.";
    return "Panenka no está disponible ahora mismo. Inténtalo en un momento.";
}

export function AsistenteChat() {
    const { messages, sendMessage, status, error, regenerate, clearError } = useChat({ transport });
    const [input, setInput] = useState("");
    const scrollRef = useRef<HTMLDivElement>(null);
    const pegado = useRef(true);

    const isLoading = status === "submitted" || status === "streaming";
    const vacio = messages.length === 0;

    // Panenka piensa hasta que llega texto, no mientras se escribe: nada de puntos debajo de lo que ya se lee
    const ultimo = messages[messages.length - 1];
    const escribiendo = status === "streaming" && ultimo?.role === "assistant" && ultimo.parts[ultimo.parts.length - 1]?.type === "text";
    const pensando = isLoading && !escribiendo;
    const pregunta = [...messages].reverse().find((m) => m.role === "user");

    // Vacío no se baja: en un móvil corto se comería la cara
    useEffect(() => {
        const el = scrollRef.current;
        if (el && !vacio && pegado.current) el.scrollTop = el.scrollHeight;
    }, [messages, pensando, error, vacio]);

    // Al abrir el teclado el área encoge: lo último que se leía sigue a la vista
    useEffect(() => {
        const el = scrollRef.current;
        if (!el || vacio) return;
        const observador = new ResizeObserver(() => {
            if (pegado.current) el.scrollTop = el.scrollHeight;
        });
        observador.observe(el);
        return () => observador.disconnect();
    }, [vacio]);

    function handleScroll() {
        const el = scrollRef.current;
        if (el) pegado.current = el.scrollHeight - el.scrollTop - el.clientHeight < MARGEN_PEGADO;
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        const text = input.trim();
        if (!text || isLoading) return;
        setInput("");
        pegado.current = true;
        sendMessage({ text });
    }

    function reintentar() {
        clearError();
        pegado.current = true;
        void regenerate();
    }

    return (
        <div className="flex h-[calc(100dvh-var(--barra-superior)-var(--barra-inferior))] flex-col">
            {!vacio && (
                <header className="flex h-12 flex-none items-center gap-2 border-b border-border px-4">
                    <Panenka size={32} />
                    <h1 className="font-display text-[26px] font-extrabold leading-none">Panenka</h1>
                    <p className="t-meta ml-1 truncate text-muted">Tu asistente futbolero</p>
                </header>
            )}

            <div ref={scrollRef} onScroll={handleScroll} className="scroll-interno min-h-0 flex-1">
                {vacio ? (
                    <div className="pt-1">
                        <header className="px-4">
                            <h1 className="t-cartel" style={{ "--chars": 7 } as CSSProperties}>Panenka</h1>
                            <p className="t-meta mt-1 text-muted">Tu asistente futbolero</p>
                        </header>

                        <div className="flex items-end justify-between gap-2 border-b border-border px-4">
                            <p className="t-titular min-w-0 flex-1 pb-4 text-[min(40px,10vw)]">{fraseVacio("panenka")}</p>
                            <Panenka
                                size={168}
                                animated
                                className="-mb-[12px] h-[min(168px,43vw,22dvh)] w-[min(168px,43vw,22dvh)] shrink-0"
                            />
                        </div>

                        <Filas aria-label="Sugerencias" className="border-t-0">
                            {SUGERENCIAS.map((s) => (
                                <Fila key={s} nombre={s} onClick={() => setInput(s)} />
                            ))}
                        </Filas>

                        <p className="t-meta px-4 py-4 text-muted">
                            Panenka es un asistente de IA: puede equivocarse. Tus consultas se
                            procesan en un proveedor externo (Groq) y solo se le envían datos de
                            juego, nunca tu email.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-5 py-4">
                        {messages.map((m) => {
                            // Extraer texto de los parts del mensaje (API v6)
                            const text = textoDe(m.parts);
                            if (!text) return null;

                            if (m.role === "user") {
                                return (
                                    <div key={m.id} className="flex justify-end px-4">
                                        <p className="max-w-[85%] whitespace-pre-wrap break-words bg-surface px-3 py-2">
                                            {text}
                                        </p>
                                    </div>
                                );
                            }

                            return (
                                <div key={m.id} className="px-4">
                                    <ReactMarkdown remarkPlugins={MD_PLUGINS} components={MD_COMPONENTS}>
                                        {text}
                                    </ReactMarkdown>
                                </div>
                            );
                        })}

                        {pensando && (
                            <div role="status" className="flex items-center gap-3 px-4">
                                <Panenka size={72} mood="dormido" animated className="shrink-0" />
                                <p className="text-muted">{frasePensando(pregunta?.id ?? "panenka")}</p>
                            </div>
                        )}

                        {error && (
                            <AvisoError
                                className="px-4"
                                accion={
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="-ml-3 mt-1 font-bold"
                                        onClick={reintentar}
                                    >
                                        Reintentar
                                    </Button>
                                }
                            >
                                {fraseDeError(error)}
                            </AvisoError>
                        )}
                    </div>
                )}
            </div>

            {/* El abajo de más deja sitio a la cara de Panenka, que asoma sobre la barra */}
            <form
                onSubmit={handleSubmit}
                className="flex flex-none items-center gap-2 border-t border-border bg-background px-4 pb-6 pt-3 md:pb-3"
            >
                <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Pregunta a Panenka..."
                    aria-label="Pregunta a Panenka"
                    autoComplete="off"
                    enterKeyHint="send"
                    className="min-h-12 min-w-0 flex-1 border border-border-hover bg-surface px-4 text-base text-foreground placeholder:text-muted focus:border-foreground focus:outline-none"
                />
                <Button
                    type="submit"
                    disabled={!input.trim() || isLoading}
                    aria-label="Enviar mensaje"
                    className="w-12 shrink-0 px-0"
                >
                    <Send size={18} strokeWidth={1.75} aria-hidden="true" />
                </Button>
            </form>
        </div>
    );
}
