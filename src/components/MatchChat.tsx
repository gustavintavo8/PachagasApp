"use client";

import { useState, useEffect, useRef, useOptimistic, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/ui/Avatar";
import { getAvatarUrl, timeAgo } from "@/lib/utils";
import { Send, MessageCircle } from "lucide-react";

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
}

interface MatchChatProps {
    matchId: string;
    currentUserId: string;
    currentUserProfile: {
        username: string | null;
        avatar_url: string | null;
    };
}

export function MatchChat({
    matchId,
    currentUserId,
    currentUserProfile,
}: MatchChatProps) {
    const [comments, setComments] = useState<Comment[]>([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState("");
    const [sending, setSending] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const supabase = createClient();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

    // Fetch initial comments
    useEffect(() => {
        async function fetchComments() {
            const { data } = await supabase
                .from("match_comments")
                .select("*, profiles(username, avatar_url)")
                .eq("match_id", matchId)
                .order("created_at", { ascending: true });
            setComments((data as unknown as Comment[]) || []);
            setLoading(false);
        }
        fetchComments();
    }, [matchId]);

    // Realtime subscription
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
                    // Fetch the full comment with profile
                    const { data } = await supabase
                        .from("match_comments")
                        .select("*, profiles(username, avatar_url)")
                        .eq("id", payload.new.id)
                        .single();
                    if (data) {
                        setComments((prev) => {
                            // Avoid duplicates (from optimistic update)
                            if (prev.some((c) => c.id === data.id)) {
                                return prev.map((c) => c.id === data.id ? (data as unknown as Comment) : c);
                            }
                            return [...prev, data as unknown as Comment];
                        });
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [matchId]);

    // Auto-scroll on new messages
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [comments]);

    async function handleSend(e: React.FormEvent) {
        e.preventDefault();
        const content = message.trim();
        if (!content || sending) return;

        setSending(true);
        setMessage("");

        // Optimistic update
        const optimisticId = `optimistic-${Date.now()}`;
        const optimisticComment: Comment = {
            id: optimisticId,
            match_id: matchId,
            user_id: currentUserId,
            content,
            created_at: new Date().toISOString(),
            profiles: currentUserProfile,
        };
        setComments((prev) => [...prev, optimisticComment]);

        const { data, error } = await supabase
            .from("match_comments")
            .insert({ match_id: matchId, user_id: currentUserId, content })
            .select("*, profiles(username, avatar_url)")
            .single();

        if (error) {
            // Remove optimistic comment on error
            setComments((prev) => prev.filter((c) => c.id !== optimisticId));
        } else if (data) {
            // Replace optimistic with real
            setComments((prev) =>
                prev.map((c) => c.id === optimisticId ? (data as unknown as Comment) : c)
            );
        }

        setSending(false);
    }

    return (
        <div className="flex flex-col rounded-2xl border border-border bg-surface">
            {/* Header */}
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                <MessageCircle size={18} className="text-accent" />
                <h3 className="text-sm font-semibold text-foreground">
                    Chat del Partido
                </h3>
                <span className="ml-auto text-xs text-muted">
                    {comments.length} mensaje{comments.length !== 1 ? "s" : ""}
                </span>
            </div>

            {/* Messages */}
            <div
                ref={scrollRef}
                className="flex-1 space-y-1 overflow-y-auto px-4 py-3"
                style={{ maxHeight: "400px", minHeight: "200px" }}
            >
                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <div className="skeleton h-5 w-32" />
                    </div>
                ) : comments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                        <MessageCircle size={32} className="mb-2 text-muted/30" />
                        <p className="text-sm text-muted">
                            Aún no hay mensajes. ¡Sé el primero!
                        </p>
                    </div>
                ) : (
                    comments.map((comment) => {
                        const isMe = comment.user_id === currentUserId;
                        const avatarUrl = getAvatarUrl(
                            supabaseUrl,
                            comment.profiles?.avatar_url ?? null
                        );

                        return (
                            <div
                                key={comment.id}
                                className={`flex gap-2.5 rounded-xl px-2 py-2 transition-colors ${isMe ? "bg-accent/5" : "hover:bg-zinc-800/50"
                                    }`}
                            >
                                <Avatar
                                    src={avatarUrl}
                                    fallback={comment.profiles?.username || "?"}
                                    size="sm"
                                    className="mt-0.5 shrink-0"
                                />
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-baseline gap-2">
                                        <span className={`text-xs font-semibold ${isMe ? "text-accent" : "text-foreground"}`}>
                                            {comment.profiles?.username || "Anónimo"}
                                        </span>
                                        <span className="text-[10px] text-muted">
                                            {timeAgo(comment.created_at)}
                                        </span>
                                    </div>
                                    <p className="text-sm text-zinc-300 break-words">
                                        {comment.content}
                                    </p>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Input */}
            <form
                onSubmit={handleSend}
                className="flex items-center gap-2 border-t border-border px-4 py-3"
            >
                    <input
                        type="text"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Escribe un mensaje..."
                        maxLength={500}
                        className="flex-1 rounded-xl border border-border bg-zinc-800 px-4 py-2.5 text-sm text-foreground placeholder:text-muted/60 transition-colors focus:border-accent focus:outline-none"
                    />
                    <button
                        type="submit"
                        aria-label="Enviar mensaje"
                        disabled={!message.trim() || sending}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-zinc-950 transition-all hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                    >
                        <Send size={16} />
                    </button>
            </form>
        </div>
    );
}
