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
        budget: 100_000_000,
    });

    if (error) return { success: false, error: error.message };

    revalidatePath("/fantasy");
    return { success: true };
}

export async function buyPlayer(
    teamId: string,
    playerId: string,
    price: number
): Promise<ActionResult> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "No autenticado" };

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

    const { error: insertError } = await supabase
        .from("fantasy_rosters")
        .insert({ team_id: teamId, player_id: playerId, is_captain: false });

    if (insertError) return { success: false, error: insertError.message };

    const { error: updateError } = await supabase
        .from("fantasy_teams")
        .update({ budget: team.budget - price })
        .eq("id", teamId);

    if (updateError) return { success: false, error: updateError.message };

    revalidatePath("/fantasy");
    revalidatePath("/fantasy/mercado");
    return { success: true };
}

export async function sellPlayer(
    teamId: string,
    playerId: string,
    price: number
): Promise<ActionResult> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "No autenticado" };

    const { data: team } = await supabase
        .from("fantasy_teams")
        .select("id, budget")
        .eq("id", teamId)
        .eq("user_id", user.id)
        .single();

    if (!team) return { success: false, error: "Equipo no encontrado" };

    const { error: deleteError } = await supabase
        .from("fantasy_rosters")
        .delete()
        .eq("team_id", teamId)
        .eq("player_id", playerId);

    if (deleteError) return { success: false, error: deleteError.message };

    const { error: updateError } = await supabase
        .from("fantasy_teams")
        .update({ budget: team.budget + price })
        .eq("id", teamId);

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
