import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { requireCommunityAccess } from "@/lib/access";
import { redirect } from "next/navigation";
import { fechaRepetida } from "@/lib/titulares";
import { NewMatchForm } from "./NewMatchForm";

export const metadata: Metadata = {
    title: "Nuevo partido — Pachanga",
    description: "Monta la próxima pachanga.",
};

const PLAZAS_POR_DEFECTO = 10;
const MAX_SITIOS = 3;

function plazasValidas(valor: unknown): number | null {
    const n = Number(valor);
    return Number.isInteger(n) && n >= 4 && n <= 30 ? n : null;
}

export default async function NewMatchPage({
    searchParams,
}: {
    searchParams: Promise<{ location?: string; max_players?: string; date?: string }>;
}) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/login");

    const access = await requireCommunityAccess(user);
    if (!access.success) redirect("/access");

    const params = await searchParams;
    const ahora = new Date();

    // Los sitios y las plazas de siempre, para no escribirlos cada semana
    const { data: recientes } = await supabase
        .from("matches")
        .select("location, max_players")
        .neq("status", "cancelled")
        .order("date", { ascending: false })
        .limit(20);

    const veces = new Map<string, number>();
    for (const { location } of recientes ?? []) {
        const sitio = location.trim();
        if (sitio) veces.set(sitio, (veces.get(sitio) ?? 0) + 1);
    }
    const sitios = [...veces.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, MAX_SITIOS)
        .map(([sitio]) => sitio);

    let fecha = "";
    if (params.date && !Number.isNaN(new Date(params.date).getTime())) {
        fecha = fechaRepetida(params.date, ahora);
    }

    return (
        <NewMatchForm
            ahora={ahora.toISOString()}
            sitios={sitios}
            fechaInicial={fecha}
            lugarInicial={params.location ?? ""}
            plazasIniciales={
                plazasValidas(params.max_players) ?? plazasValidas(recientes?.[0]?.max_players) ?? PLAZAS_POR_DEFECTO
            }
        />
    );
}
