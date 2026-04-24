import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PlayersList } from "./PlayersList";
import { getAdminUserIds } from "@/lib/permissions";
import type { Profile } from "@/lib/types";
import Link from "next/link";

export const metadata: Metadata = {
    title: "Jugadores — Pachanga",
    description: "Explora todos los jugadores de la comunidad.",
};

const PAGE_SIZE = 20;

export default async function PlayersPage({
    searchParams,
}: {
    searchParams: Promise<{ page?: string }>;
}) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/login");

    const { page: pageParam } = await searchParams;
    const page = Math.max(1, parseInt(pageParam ?? "1", 10));
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const [{ data: profiles, count }, adminUserIds] = await Promise.all([
        supabase
            .from("profiles")
            .select("*", { count: "exact" })
            .order("matches_played", { ascending: false })
            .range(from, to),
        getAdminUserIds(),
    ]);

    const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE);

    return (
        <div className="mx-auto max-w-5xl px-4 py-8">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-foreground">Jugadores</h1>
                <p className="text-muted">Explora todos los jugadores registrados</p>
            </div>
            <PlayersList
                profiles={(profiles as Profile[]) || []}
                currentUserId={user.id}
                adminUserIds={adminUserIds}
            />
            {totalPages > 1 && (
                <div className="mt-8 flex items-center justify-center gap-2">
                    {page > 1 && (
                        <Link
                            href={`/players?page=${page - 1}`}
                            className="rounded-lg border border-border px-4 py-2 text-sm text-muted transition-colors hover:border-accent/30 hover:text-foreground"
                        >
                            ← Anterior
                        </Link>
                    )}
                    <span className="text-sm text-muted">{page} / {totalPages}</span>
                    {page < totalPages && (
                        <Link
                            href={`/players?page=${page + 1}`}
                            className="rounded-lg border border-border px-4 py-2 text-sm text-muted transition-colors hover:border-accent/30 hover:text-foreground"
                        >
                            Siguiente →
                        </Link>
                    )}
                </div>
            )}
        </div>
    );
}
