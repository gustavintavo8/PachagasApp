import type { Metadata } from "next";
import { ChevronRight } from "lucide-react";
import { AvisoError } from "@/components/AvisoError";
import { Fila, Filas } from "@/components/Filas";
import { PanenkaDice } from "@/components/PanenkaDice";
import { requireCommunityAccess } from "@/lib/access";
import { PROVISIONAL_THRESHOLD } from "@/lib/elo";
import { getActiveSeason } from "@/lib/seasons";
import { createClient } from "@/lib/supabase/server";
import { cuerpoCifras, elegirPlural, frasePanenkaRanking, titularRanking } from "@/lib/titulares";
import { redirect } from "next/navigation";
import { ProfileForm } from "./ProfileForm";
import { AccountDataPanel } from "./AccountDataPanel";
import { Reintentar } from "./Reintentar";

export const metadata: Metadata = {
    title: "Perfil — Pachanga",
    description: "Configura tu perfil de jugador.",
};

type Supabase = Awaited<ReturnType<typeof createClient>>;

type Temporada =
    | { estado: "sin-temporada" }
    | { estado: "error" }
    | {
          estado: "ok";
          nombre: string;
          rp: number;
          partidos: number;
          goles: number;
          mvps: number;
          victorias: number;
          empates: number;
          derrotas: number;
          titular: string;
          frase: string;
      };

// Perfil no puede caerse por esto: desde aquí se borra la cuenta.
async function leerTemporada(supabase: Supabase, userId: string): Promise<Temporada> {
    let season;
    try {
        season = await getActiveSeason();
    } catch {
        return { estado: "sin-temporada" };
    }

    const { data, error } = await supabase
        .from("season_player_stats")
        .select("user_id, elo_rating, matches_played, goals_scored, wins, draws, losses, mvps, profiles(username)")
        .eq("season_id", season.id)
        .order("elo_rating", { ascending: false })
        .order("matches_played", { ascending: false });

    if (error || !data) return { estado: "error" };

    const yo = data.find((fila) => fila.user_id === userId);
    const partidos = yo?.matches_played ?? 0;
    const rp = Math.round(yo?.elo_rating ?? 1000);

    // La tabla del Ranking: quien tiene partidos suficientes para contar
    const tabla = data.filter((fila) => fila.matches_played >= PROVISIONAL_THRESHOLD);
    const indice = tabla.findIndex((fila) => fila.user_id === userId);
    const rival = (fila: (typeof tabla)[number] | undefined) =>
        fila && {
            nombre: (fila.profiles as unknown as { username: string | null } | null)?.username ?? null,
            distancia: fila.elo_rating - (yo?.elo_rating ?? 1000),
        };

    const posicion = indice === -1 ? null : indice + 1;

    return {
        estado: "ok",
        nombre: season.name,
        rp,
        partidos,
        goles: yo?.goals_scored ?? 0,
        mvps: yo?.mvps ?? 0,
        victorias: yo?.wins ?? 0,
        empates: yo?.draws ?? 0,
        derrotas: yo?.losses ?? 0,
        titular: titularRanking({
            posicion,
            totalEnTabla: tabla.length,
            partidos,
            anterior: rival(tabla[indice - 1]),
            siguiente: rival(tabla[indice + 1]),
        }),
        frase: frasePanenkaRanking({
            id: `${userId}:${season.id}:${partidos}`,
            posicion,
            totalEnTabla: tabla.length,
            partidos,
        }),
    };
}

function Cifra({ valor, nombre, cuerpo }: { valor: string | number; nombre: string; cuerpo: string }) {
    return (
        // dt va antes que dd en el HTML; la cifra se ve arriba
        <div className="flex flex-col-reverse">
            <dt className="t-meta mt-1 text-muted">{nombre}</dt>
            {/* 10-12-11 no parte por el guion: a 320px también cabe entero */}
            <dd className="t-cifra whitespace-nowrap" style={{ fontSize: cuerpo }}>
                {valor}
            </dd>
        </div>
    );
}

export default async function ProfilePage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/login");

    const access = await requireCommunityAccess(user);
    if (!access.success) redirect("/access");

    const [{ data: profile }, temporada] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        leerTemporada(supabase, user.id),
    ]);

    const balance =
        temporada.estado === "ok" ? `${temporada.victorias}-${temporada.empates}-${temporada.derrotas}` : "";
    const cuerpoFila =
        temporada.estado === "ok" ? cuerpoCifras([temporada.goles, temporada.mvps, balance], "13vw") : "";

    const lateral = temporada.estado === "ok" && (
        <>
            <p
                className={`t-cifra leading-[0.9] ${
                    String(temporada.rp).length > 4 ? "text-[min(64px,16vw)]" : "text-[min(84px,21vw)]"
                }`}
            >
                {temporada.rp}
            </p>
            <p className="t-seccion mt-1">RP</p>
            <p className="t-meta mt-3 text-muted">
                {temporada.partidos} {elegirPlural(temporada.partidos, "partido")}
                <br />
                {temporada.nombre}
            </p>
        </>
    );

    return (
        <div>
            {/* La key: otra cuenta en la misma pestaña no hereda lo que había oculto */}
            <ProfileForm
                key={user.id}
                userId={user.id}
                profile={profile}
                titular={temporada.estado === "ok" ? temporada.titular : undefined}
                lateral={lateral}
            >
                {temporada.estado === "ok" && (
                    <div className="mt-6 px-4">
                        <dl className="flex items-start justify-between gap-4 border-t border-border pt-5">
                            <Cifra
                                valor={temporada.goles}
                                nombre={elegirPlural(temporada.goles, "Gol", "Goles")}
                                cuerpo={cuerpoFila}
                            />
                            <Cifra
                                valor={temporada.mvps}
                                nombre={elegirPlural(temporada.mvps, "MVP", "MVPs")}
                                cuerpo={cuerpoFila}
                            />
                            <Cifra valor={balance} nombre="V-E-D" cuerpo={cuerpoFila} />
                        </dl>
                        <PanenkaDice className="mt-6">{temporada.frase}</PanenkaDice>
                    </div>
                )}

                {temporada.estado === "sin-temporada" && (
                    <p className="mt-6 px-4 text-muted">No hay temporada en marcha. Tus cifras volverán con ella.</p>
                )}

                {temporada.estado === "error" && (
                    <AvisoError className="mt-6 px-4" accion={<Reintentar />}>
                        No se han podido cargar tus cifras.
                    </AvisoError>
                )}

                <Filas aria-label="Tus partidos" className="mt-6">
                    <Fila
                        href="/history"
                        nombre="Historial"
                        detalle="Todos tus partidos"
                        cifra={<ChevronRight size={18} strokeWidth={1.75} aria-hidden="true" />}
                    />
                    <Fila
                        href={`/players/${user.id}`}
                        nombre="Tu ficha"
                        detalle="Lo que ven los demás"
                        cifra={<ChevronRight size={18} strokeWidth={1.75} aria-hidden="true" />}
                    />
                </Filas>
            </ProfileForm>

            <AccountDataPanel key={`datos-${user.id}`} />
        </div>
    );
}
