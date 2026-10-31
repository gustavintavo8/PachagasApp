"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowUp, TriangleAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/ui/Avatar";
import { Button, buttonClasses } from "@/components/ui/Button";
import { PanenkaDice } from "@/components/PanenkaDice";
import { getAvatarUrl, timeAgo } from "@/lib/utils";
import { elegirPlural, fraseVacio } from "@/lib/titulares";

interface Comment {
    id: string;
    match_id: string;
    user_id: string;
    content: string;
    created_at: string;
    profiles: {
        username: string | null;
        avatar_url: string | null;
    };
    /** Solo las filas propias que aún no están en el servidor */
    envio?: "enviando" | "fallido";
}

interface MatchChatProps {
    matchId: string;
    currentUserId: string;
    currentUserProfile: {
        username: string | null;
        avatar_url: string | null;
    };
}

const CONSULTA = "*, profiles(username, avatar_url)";

// A sangre aunque el contenedor traiga márgenes: el ancho de la pantalla o el de la columna
const A_SANGRE = "w-[min(100vw,640px)] ml-[calc(50%-min(50vw,320px))]";

// Mensajes seguidos de la misma persona se agrupan si no pasan más de cinco minutos
const VENTANA_GRUPO_MS = 5 * 60 * 1000;
const MARGEN_FONDO_PX = 80;

/** Una sola fila por mensaje, llegue antes la respuesta del insert o la del canal. */
function conMensajeReal(prev: Comment[], real: Comment, idProvisional?: string): Comment[] {
    const provisional = idProvisional
        ? prev.find((c) => c.id === idProvisional)
        : prev.find((c) => c.envio === "enviando" && c.user_id === real.user_id && c.content === real.content);

    if (prev.some((c) => c.id === real.id)) {
        return prev.filter((c) => c !== provisional).map((c) => (c.id === real.id ? real : c));
    }
    if (provisional) return prev.map((c) => (c === provisional ? real : c));
    return [...prev, real];
}

function empiezaGrupo(mensaje: Comment, anterior: Comment | undefined) {
    if (!anterior || anterior.user_id !== mensaje.user_id) return true;
    return new Date(mensaje.created_at).getTime() - new Date(anterior.created_at).getTime() > VENTANA_GRUPO_MS;
}

export function MatchChat({
    matchId,
    currentUserId,
    currentUserProfile,
}: MatchChatProps) {
    const [supabase] = useState(createClient);
    const [comments, setComments] = useState<Comment[]>([]);
    const [carga, setCarga] = useState<"cargando" | "lista" | "error">("cargando");
    const [intento, setIntento] = useState(0);
    const [message, setMessage] = useState("");
    const raizRef = useRef<HTMLDivElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const pegadoAlFondo = useRef(true);
    const contadorProvisional = useRef(0);
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

    function bajarAlFondo() {
        const lista = scrollRef.current;
        if (lista) lista.scrollTop = lista.scrollHeight;
    }

    // Lo que hay por encima del chat (barra, pestañas) y lo que ocupa el teclado.
    // En iOS el teclado no cambia dvh, así que se mide con visualViewport.
    useLayoutEffect(() => {
        const raiz = raizRef.current;
        if (!raiz) return;
        const viewport = window.visualViewport;

        const medir = () => {
            // La pestaña oculta no mide nada, y menos aún mueve la página
            if (raiz.getClientRects().length === 0) return;
            raiz.style.setProperty("--chat-arriba", `${raiz.getBoundingClientRect().top + window.scrollY}px`);
            if (viewport) {
                const hayZoom = viewport.scale > 1.01;
                const teclado = hayZoom ? 0 : Math.max(0, window.innerHeight - viewport.height);
                raiz.style.setProperty("--chat-teclado", `${teclado}px`);
                // iOS desplaza la página para enseñar el input; con el chat ya encogido sobra
                if (teclado > 0 && window.scrollY > 0) window.scrollTo(0, 0);
            }
        };

        medir();
        // También salta al volver a la pestaña: el chat sigue montado mientras está oculto
        const observador = new ResizeObserver(medir);
        observador.observe(raiz);
        window.addEventListener("resize", medir);
        viewport?.addEventListener("resize", medir);
        return () => {
            observador.disconnect();
            window.removeEventListener("resize", medir);
            viewport?.removeEventListener("resize", medir);
        };
    }, []);

    useEffect(() => {
        let vigente = true;
        supabase
            .from("match_comments")
            .select(CONSULTA)
            .eq("match_id", matchId)
            .order("created_at", { ascending: true })
            .then(({ data, error }) => {
                if (!vigente) return;
                if (error) {
                    setCarga("error");
                    return;
                }
                const leidos = (data as unknown as Comment[]) ?? [];
                // Lo que ya está en pantalla y aún no ha vuelto del servidor se queda
                setComments((prev) => [...leidos, ...prev.filter((c) => !leidos.some((l) => l.id === c.id))]);
                setCarga("lista");
            });
        return () => {
            vigente = false;
        };
    }, [supabase, matchId, intento]);

    useEffect(() => {
        const channel = supabase
            .channel(`chat-${matchId}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "match_comments",
                    filter: `match_id=eq.${matchId}`,
                },
                async (payload) => {
                    const { data } = await supabase
                        .from("match_comments")
                        .select(CONSULTA)
                        .eq("id", payload.new.id)
                        .single();
                    if (data) setComments((prev) => conMensajeReal(prev, data as unknown as Comment));
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase, matchId]);

    // Solo baja si ya estabas abajo: leer lo de antes no te lo quita nadie
    useLayoutEffect(() => {
        if (pegadoAlFondo.current) bajarAlFondo();
    }, [comments, carga]);

    // Al abrirse el teclado la lista encoge: el último mensaje tiene que seguir a la vista
    useEffect(() => {
        const lista = scrollRef.current;
        if (!lista) return;
        const observador = new ResizeObserver(() => {
            if (pegadoAlFondo.current) bajarAlFondo();
        });
        observador.observe(lista);
        return () => observador.disconnect();
    }, []);

    async function enviar(content: string, idProvisional: string) {
        const { data, error } = await supabase
            .from("match_comments")
            .insert({ match_id: matchId, user_id: currentUserId, content })
            .select(CONSULTA)
            .single();

        if (error || !data) {
            // El mensaje se queda en su sitio: el texto no se pierde y se puede reintentar
            setComments((prev) => prev.map((c) => (c.id === idProvisional ? { ...c, envio: "fallido" } : c)));
            return;
        }
        setComments((prev) => conMensajeReal(prev, data as unknown as Comment, idProvisional));
    }

    function handleSend(e: React.FormEvent) {
        e.preventDefault();
        const content = message.trim();
        if (!content) return;

        contadorProvisional.current += 1;
        const idProvisional = `optimistic-${contadorProvisional.current}`;
        setMessage("");
        pegadoAlFondo.current = true;
        setComments((prev) => [
            ...prev,
            {
                id: idProvisional,
                match_id: matchId,
                user_id: currentUserId,
                content,
                created_at: new Date().toISOString(),
                profiles: currentUserProfile,
                envio: "enviando",
            },
        ]);
        void enviar(content, idProvisional);
    }

    function reintentar(mensaje: Comment) {
        setComments((prev) => prev.map((c) => (c.id === mensaje.id ? { ...c, envio: "enviando" } : c)));
        void enviar(mensaje.content, mensaje.id);
    }

    function editar(mensaje: Comment) {
        setComments((prev) => prev.filter((c) => c.id !== mensaje.id));
        setMessage(message ? `${message} ${mensaje.content}` : mensaje.content);
        inputRef.current?.focus();
    }

    const enServidor = comments.filter((c) => !c.envio).length;

    return (
        <div
            ref={raizRef}
            className={`${A_SANGRE} flex min-h-64 flex-col`}
            style={{
                height: "calc(100dvh - var(--chat-arriba, 96px) - max(var(--barra-inferior), var(--chat-teclado, 0px)))",
            }}
        >
            <div
                ref={scrollRef}
                role="log"
                aria-label="Mensajes del partido"
                tabIndex={0}
                onScroll={(e) => {
                    const lista = e.currentTarget;
                    pegadoAlFondo.current =
                        lista.scrollHeight - lista.scrollTop - lista.clientHeight < MARGEN_FONDO_PX;
                }}
                className="scroll-interno min-h-0 flex-1 px-4 focus-visible:outline-none"
            >
                {carga === "cargando" ? (
                    <div aria-hidden="true" className="flex min-h-full flex-col justify-end gap-4 py-3">
                        {[160, 240, 112].map((ancho) => (
                            <div key={ancho} className="flex gap-2.5">
                                <div className="skeleton h-8 w-8 shrink-0" />
                                <div className="flex-1 space-y-1.5">
                                    <div className="skeleton h-3.5 w-20" />
                                    <div className="skeleton h-5" style={{ width: ancho }} />
                                </div>
                            </div>
                        ))}
                        <div className="skeleton ml-auto h-10 w-44" />
                    </div>
                ) : carga === "error" ? (
                    <div className="flex min-h-full items-center justify-center gap-3 py-6">
                        <TriangleAlert size={18} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-tarjeta" />
                        <p className="min-w-0">No se han podido leer los mensajes.</p>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                setCarga("cargando");
                                setIntento((n) => n + 1);
                            }}
                        >
                            Reintentar
                        </Button>
                    </div>
                ) : comments.length === 0 ? (
                    <div className="flex min-h-full items-end pb-4">
                        <PanenkaDice size={72}>{fraseVacio("chat", matchId)}</PanenkaDice>
                    </div>
                ) : (
                    <div className="flex min-h-full flex-col justify-end pb-3 pt-3">
                        <p className="t-meta mb-2 text-center text-muted tabular-nums">
                            {enServidor} {elegirPlural(enServidor, "mensaje")}
                        </p>
                        {comments.map((comment, i) => (
                            <Mensaje
                                key={comment.id}
                                comment={comment}
                                propio={comment.user_id === currentUserId}
                                primero={empiezaGrupo(comment, comments[i - 1])}
                                avatarUrl={getAvatarUrl(supabaseUrl, comment.profiles?.avatar_url ?? null)}
                                onReintentar={() => reintentar(comment)}
                                onEditar={() => editar(comment)}
                            />
                        ))}
                    </div>
                )}
            </div>

            <form onSubmit={handleSend} className="flex flex-none items-center gap-2 border-t border-border bg-background px-4 py-2">
                <input
                    ref={inputRef}
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Escribe un mensaje…"
                    aria-label="Escribe un mensaje"
                    maxLength={500}
                    enterKeyHint="send"
                    autoCapitalize="sentences"
                    autoComplete="off"
                    className="h-12 min-w-0 flex-1 border border-border-hover bg-surface px-3 text-base text-foreground placeholder:text-muted focus:border-foreground focus:outline-none"
                />
                <button
                    type="submit"
                    aria-label="Enviar mensaje"
                    disabled={!message.trim()}
                    // Sin esto, tocar el botón le quita el foco al input y se cierra el teclado
                    onPointerDown={(e) => e.preventDefault()}
                    className={buttonClasses("primary", "md", "w-12 shrink-0 px-0")}
                >
                    <ArrowUp size={18} strokeWidth={1.75} aria-hidden="true" />
                </button>
            </form>
        </div>
    );
}

function Mensaje({
    comment,
    propio,
    primero,
    avatarUrl,
    onReintentar,
    onEditar,
}: {
    comment: Comment;
    propio: boolean;
    primero: boolean;
    avatarUrl: string | null;
    onReintentar: () => void;
    onEditar: () => void;
}) {
    const nombre = comment.profiles?.username || "Anónimo";
    const texto = (
        <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{comment.content}</p>
    );

    if (propio) {
        return (
            <div className={`${primero ? "mt-4" : "mt-1"} flex flex-col items-end`}>
                <div className={`max-w-[85%] bg-surface px-3 py-2 ${comment.envio === "enviando" ? "opacity-60" : ""}`}>
                    {texto}
                </div>
                {comment.envio === "fallido" ? (
                    <div className="mt-0.5 flex items-center gap-1">
                        <TriangleAlert size={18} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-tarjeta" />
                        <span className="t-meta mr-1">No se ha enviado.</span>
                        <Button type="button" variant="ghost" size="sm" className="px-2" onClick={onReintentar}>
                            Reintentar
                        </Button>
                        <Button type="button" variant="ghost" size="sm" className="px-2" onClick={onEditar}>
                            Editar
                        </Button>
                    </div>
                ) : (
                    primero &&
                    !comment.envio && (
                        <time dateTime={comment.created_at} className="t-meta mt-0.5 text-muted tabular-nums">
                            {timeAgo(comment.created_at)}
                        </time>
                    )
                )}
            </div>
        );
    }

    return (
        <div className={`${primero ? "mt-4" : "mt-1"} flex gap-2.5`}>
            {primero ? (
                <Avatar src={avatarUrl} fallback={nombre} size="sm" className="mt-0.5" />
            ) : (
                <div aria-hidden="true" className="w-8 shrink-0" />
            )}
            <div className="min-w-0 flex-1">
                {primero && (
                    <p className="flex items-baseline gap-2">
                        <span className="t-meta truncate font-bold">{nombre}</span>
                        <time dateTime={comment.created_at} className="t-meta shrink-0 text-muted tabular-nums">
                            {timeAgo(comment.created_at)}
                        </time>
                    </p>
                )}
                {texto}
            </div>
        </div>
    );
}
