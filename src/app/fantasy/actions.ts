"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

type ActionResult = { success: boolean; error?: string };

const nameSchema = z
    .string()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(30, "Máximo 30 caracteres");

export async function createFantasyTeam(name: string): Promise<ActionResult> {
    const parsed = nameSchema.safeParse(name);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "No autenticado" };

    const { data: existing } = await supabase
        .from("fantasy_teams")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

    if (existing) return { success: false, error: "Ya tienes un equipo fantasy" };

    const { error } = await supabase.from("fantasy_teams").insert({
        user_id: user.id,
        name: parsed.data,
        budget: 115_000_000,
    });

    if (error) return { success: false, error: error.message };

    revalidatePath("/fantasy");
    return { success: true };
}

export async function buyPlayer(teamId: string, playerId: string): Promise<ActionResult> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "No autenticado" };

    // Fetch price from DB — never trust the client
    const { data: playerData } = await supabase
        .from("profiles")
        .select("market_value")
        .eq("id", playerId)
        .single();

    if (!playerData) return { success: false, error: "Jugador no encontrado" };
    if (playerData.market_value === null)
        return { success: false, error: "Este jugador no tiene valor de mercado" };
    const price = playerData.market_value;

    const { data: team } = await supabase
        .from("fantasy_teams")
        .select("id, budget")
        .eq("id", teamId)
        .eq("user_id", user.id)
        .single();

    if (!team) return { success: false, error: "Equipo no encontrado" };
    if (team.budget < price) return { success: false, error: "Presupuesto insuficiente" };

    const { data: existing } = await supabase
        .from("fantasy_rosters")
        .select("player_id")
        .eq("team_id", teamId)
        .eq("player_id", playerId)
        .maybeSingle();

    if (existing) return { success: false, error: "El jugador ya está en tu plantilla" };

    const { count: rosterCount } = await supabase
        .from("fantasy_rosters")
        .select("*", { count: "exact", head: true })
        .eq("team_id", teamId);

    if ((rosterCount ?? 0) >= 11)
        return { success: false, error: "Tu plantilla ya está llena (Máximo 11 jugadores). Vende a alguien primero." };

    // Regla 2: límites por posición en la plantilla completa
    const SQUAD_POS_LIMITS: Record<string, number> = { GK: 2, DEF: 4, MID: 4, FWD: 3 };
    const playerPos = (await supabase.from("profiles").select("position").eq("id", playerId).single()).data?.position ?? "MID";
    const posLimit = SQUAD_POS_LIMITS[playerPos] ?? 4;
    const { count: posCount } = await supabase
        .from("fantasy_rosters")
        .select("profiles!inner(position)", { count: "exact", head: true })
        .eq("team_id", teamId)
        .eq("profiles.position", playerPos);
    if ((posCount ?? 0) >= posLimit)
        return { success: false, error: `Ya tienes el máximo de ${posLimit} jugadores en esa posición (${playerPos})` };

    // Atomic budget claim: only deducts if budget is still sufficient (guards race conditions)
    const { data: claimed, error: claimError } = await supabase
        .from("fantasy_teams")
        .update({ budget: team.budget - price })
        .eq("id", teamId)
        .gte("budget", price)
        .select("id");

    if (claimError) return { success: false, error: claimError.message };
    if (!claimed || claimed.length === 0)
        return { success: false, error: "Presupuesto insuficiente" };

    const { error: insertError } = await supabase
        .from("fantasy_rosters")
        .insert({ team_id: teamId, player_id: playerId, is_captain: false });

    if (insertError) {
        // Refund only if budget is still at the decremented value (avoids overwriting a concurrent change)
        await supabase
            .from("fantasy_teams")
            .update({ budget: team.budget })
            .eq("id", teamId)
            .eq("budget", team.budget - price);
        return { success: false, error: insertError.message };
    }

    revalidatePath("/fantasy");
    revalidatePath("/fantasy/mercado");
    return { success: true };
}

export async function sellPlayer(teamId: string, playerId: string): Promise<ActionResult> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "No autenticado" };

    // Fetch price from DB — never trust the client
    const { data: playerData } = await supabase
        .from("profiles")
        .select("market_value")
        .eq("id", playerId)
        .single();

    if (!playerData) return { success: false, error: "Jugador no encontrado" };
    if (playerData.market_value === null)
        return { success: false, error: "Este jugador no tiene valor de mercado" };
    const price = playerData.market_value;

    const { data: team } = await supabase
        .from("fantasy_teams")
        .select("id, budget")
        .eq("id", teamId)
        .eq("user_id", user.id)
        .single();

    if (!team) return { success: false, error: "Equipo no encontrado" };

    const { error: deleteError, count: deleted } = await supabase
        .from("fantasy_rosters")
        .delete({ count: "exact" })
        .eq("team_id", teamId)
        .eq("player_id", playerId);

    if (deleteError) return { success: false, error: deleteError.message };
    if (!deleted || deleted === 0) return { success: false, error: "Jugador no encontrado en tu plantilla" };

    // Re-read budget after delete to get the freshest value before crediting
    const { data: freshTeam } = await supabase
        .from("fantasy_teams")
        .select("budget")
        .eq("id", teamId)
        .single();

    const currentBudget = freshTeam?.budget ?? team.budget;

    const { error: updateError } = await supabase
        .from("fantasy_teams")
        .update({ budget: currentBudget + price })
        .eq("id", teamId)
        .eq("budget", currentBudget);

    if (updateError) return { success: false, error: updateError.message };

    revalidatePath("/fantasy");
    revalidatePath("/fantasy/mercado");
    return { success: true };
}

export async function setCaptain(teamId: string, playerId: string): Promise<ActionResult> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "No autenticado" };

    const { data: team } = await supabase
        .from("fantasy_teams")
        .select("id")
        .eq("id", teamId)
        .eq("user_id", user.id)
        .single();

    if (!team) return { success: false, error: "Equipo no encontrado" };

    const { data: closedMatch } = await supabase
        .from("matches")
        .select("id")
        .eq("status", "closed")
        .limit(1)
        .maybeSingle();

    if (closedMatch) {
        return {
            success: false,
            error: "No puedes cambiar el capitán: hay un partido en curso",
        };
    }

    const { data: nextMatch } = await supabase
        .from("matches")
        .select("date")
        .eq("status", "open")
        .order("date", { ascending: true })
        .limit(1)
        .maybeSingle();

    if (nextMatch) {
        const hoursUntil = (new Date(nextMatch.date).getTime() - Date.now()) / 3_600_000;
        if (hoursUntil < 4) {
            return {
                success: false,
                error: "No puedes cambiar el capitán: faltan menos de 4 horas para el próximo partido",
            };
        }
    }

    const { error: resetError } = await supabase
        .from("fantasy_rosters")
        .update({ is_captain: false })
        .eq("team_id", teamId);

    if (resetError) return { success: false, error: resetError.message };

    const { error: setCaptainError } = await supabase
        .from("fantasy_rosters")
        .update({ is_captain: true })
        .eq("team_id", teamId)
        .eq("player_id", playerId);

    if (setCaptainError) return { success: false, error: setCaptainError.message };

    revalidatePath("/fantasy");
    return { success: true };
}

export async function saveLineup(teamId: string, starterIds: string[]): Promise<ActionResult> {
    if (starterIds.length !== 7)
        return { success: false, error: "Debes seleccionar exactamente 7 titulares" };

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "No autenticado" };

    // Regla 4: la alineación debe coincidir con alguna formación válida
    const VALID_FORMATIONS = [
        { label: "1-1-2-3", counts: { GK: 1, DEF: 1, MID: 2, FWD: 3 } },
        { label: "1-1-3-2", counts: { GK: 1, DEF: 1, MID: 3, FWD: 2 } },
        { label: "1-2-1-3", counts: { GK: 1, DEF: 2, MID: 1, FWD: 3 } },
        { label: "1-2-2-2", counts: { GK: 1, DEF: 2, MID: 2, FWD: 2 } },
        { label: "1-2-3-1", counts: { GK: 1, DEF: 2, MID: 3, FWD: 1 } },
        { label: "1-3-1-2", counts: { GK: 1, DEF: 3, MID: 1, FWD: 2 } },
        { label: "1-3-2-1", counts: { GK: 1, DEF: 3, MID: 2, FWD: 1 } },
    ];

    const { data: starterProfiles } = await supabase
        .from("profiles")
        .select("id, position")
        .in("id", starterIds);

    if (starterProfiles) {
        const posCounts: Record<string, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
        for (const p of starterProfiles) {
            const pos = p.position ?? "MID";
            posCounts[pos] = (posCounts[pos] ?? 0) + 1;
        }
        const isValid = VALID_FORMATIONS.some((f) =>
            Object.entries(f.counts).every(([pos, required]) => posCounts[pos] === required)
        );
        if (!isValid)
            return {
                success: false,
                error: `La alineación no corresponde a ninguna formación válida. Usa: ${VALID_FORMATIONS.map((f) => f.label).join(", ")}`,
            };
    }

    const { data: team } = await supabase
        .from("fantasy_teams")
        .select("id")
        .eq("id", teamId)
        .eq("user_id", user.id)
        .single();

    if (!team) return { success: false, error: "Equipo no encontrado" };

    const { data: closedMatch } = await supabase
        .from("matches")
        .select("id")
        .eq("status", "closed")
        .limit(1)
        .maybeSingle();

    if (closedMatch) {
        return {
            success: false,
            error: "No puedes cambiar la alineación: hay un partido en curso",
        };
    }

    const { data: nextMatch } = await supabase
        .from("matches")
        .select("date")
        .eq("status", "open")
        .order("date", { ascending: true })
        .limit(1)
        .maybeSingle();

    if (nextMatch) {
        const hoursUntil = (new Date(nextMatch.date).getTime() - Date.now()) / 3_600_000;
        if (hoursUntil < 4) {
            return {
                success: false,
                error: "No puedes cambiar la alineación: faltan menos de 4 horas para el próximo partido",
            };
        }
    }

    const { error: resetError } = await supabase
        .from("fantasy_rosters")
        .update({ is_starter: false })
        .eq("team_id", teamId);

    if (resetError) return { success: false, error: resetError.message };

    const { error: setError } = await supabase
        .from("fantasy_rosters")
        .update({ is_starter: true })
        .eq("team_id", teamId)
        .in("player_id", starterIds);

    if (setError) return { success: false, error: setError.message };

    revalidatePath("/fantasy");
    return { success: true };
}
