/**
 * Script de retroactivo — Recalcular ELO desde el historial completo
 * Incluye bonus de portero (clean sheet, defensa sólida, goleada en contra)
 *
 * Uso (PowerShell):
 *   npx tsx --env-file=.env.local src/scripts/recalculate-elo.ts
 */

import { createClient } from "@supabase/supabase-js";

// ── ELO lógica inline (evita issues de resolución de módulos) ──
const ELO_BASE = 1000;
const K_FACTOR = 30;
const K_FACTOR_NEW = 60;
const NEW_PLAYER_THRESHOLD = 5;
const BLOWOUT_THRESHOLD = 4;
const MAX_CHANGE_PER_MATCH = 50;
const MIN_RATING = 100;

// GK bonuses
const GK_CLEAN_SHEET_BONUS = 8;
const GK_SOLID_DEFENSE_BONUS = 4;
const GK_HEAVY_CONCEDE_PENALTY = -3;

function calcExpected(ownAvg: number, oppAvg: number): number {
    return 1 / (1 + Math.pow(10, (oppAvg - ownAvg) / 400));
}

function matchResult(myScore: number, oppScore: number): number {
    if (myScore > oppScore) return 1;
    if (myScore === oppScore) return 0.5;
    return 0;
}

interface EloInput {
    userId: string;
    currentRating: number;
    matchesPlayed: number;
    team: "A" | "B";
    position: "GK" | "DEF" | "MID" | "FWD";
    goalsScored: number;
    isMvp: boolean;
}

interface EloOutput {
    userId: string;
    oldRating: number;
    newRating: number;
    delta: number;
}

function computeMatchEloUpdates(
    participants: EloInput[],
    teamAScore: number,
    teamBScore: number
): EloOutput[] {
    const teamA = participants.filter((p) => p.team === "A");
    const teamB = participants.filter((p) => p.team === "B");

    const avgRatingA =
        teamA.length > 0
            ? teamA.reduce((s, p) => s + p.currentRating, 0) / teamA.length
            : ELO_BASE;

    const avgRatingB =
        teamB.length > 0
            ? teamB.reduce((s, p) => s + p.currentRating, 0) / teamB.length
            : ELO_BASE;

    const goalDiff = Math.abs(teamAScore - teamBScore);
    const isBlowout = goalDiff >= BLOWOUT_THRESHOLD;

    const results: EloOutput[] = [];

    for (const p of participants) {
        const isTeamA = p.team === "A";
        const myTeamScore = isTeamA ? teamAScore : teamBScore;
        const oppTeamScore = isTeamA ? teamBScore : teamAScore;

        const ownAvg = isTeamA ? avgRatingA : avgRatingB;
        const oppAvg = isTeamA ? avgRatingB : avgRatingA;

        const K = p.matchesPlayed < NEW_PLAYER_THRESHOLD ? K_FACTOR_NEW : K_FACTOR;

        const expected = calcExpected(ownAvg, oppAvg);
        const actual = matchResult(myTeamScore, oppTeamScore);
        let delta = Math.round(K * (actual - expected));

        // Bonus goles
        delta += p.goalsScored * 3;

        // Bonus MVP
        if (p.isMvp) delta += 10;

        // Bonus portero
        if (p.position === "GK") {
            if (oppTeamScore === 0) {
                delta += GK_CLEAN_SHEET_BONUS;
            } else if (oppTeamScore === 1) {
                delta += GK_SOLID_DEFENSE_BONUS;
            }
            if (oppTeamScore >= 5) {
                delta += GK_HEAVY_CONCEDE_PENALTY;
            }
        }

        // Bonus/Penalización por goleada
        if (isBlowout) {
            if (myTeamScore > oppTeamScore) delta += 5;
            else if (myTeamScore < oppTeamScore) delta -= 5;
        }

        delta = Math.max(-MAX_CHANGE_PER_MATCH, Math.min(MAX_CHANGE_PER_MATCH, delta));
        const newRating = Math.max(MIN_RATING, p.currentRating + delta);

        results.push({
            userId: p.userId,
            oldRating: p.currentRating,
            newRating,
            delta: newRating - p.currentRating,
        });
    }

    return results;
}

// ── Main ──

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceKey) {
    console.error("❌ Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function main() {
    console.log("🔄 Iniciando recálculo retroactivo de ELO (con bonus GK)...\n");

    // 0. Cargar posiciones de todos los jugadores
    const { data: allProfiles } = await supabase
        .from("profiles")
        .select("id, position");
    const positionMap: Record<string, string> = {};
    for (const p of allProfiles ?? []) {
        positionMap[p.id] = p.position ?? "MID";
    }

    // 1. Resetear todos los ratings a 1000
    const { error: resetError } = await supabase
        .from("profiles")
        .update({ elo_rating: ELO_BASE })
        .gte("elo_rating", 0);

    if (resetError) {
        console.error("❌ Error reseteando ratings:", resetError.message);
        process.exit(1);
    }
    console.log("✅ Todos los jugadores reseteados a", ELO_BASE, "RP");

    // 2. Obtener partidos finalizados en orden cronológico
    const { data: matches, error: matchError } = await supabase
        .from("matches")
        .select("id, date, team_a_score, team_b_score")
        .eq("status", "finished")
        .not("team_a_score", "is", null)
        .not("team_b_score", "is", null)
        .order("date", { ascending: true });

    if (matchError) {
        console.error("❌ Error obteniendo partidos:", matchError.message);
        process.exit(1);
    }

    console.log(`📅 Procesando ${matches?.length ?? 0} partidos...\n`);

    const ratingMap: Record<string, number> = {};
    const matchesPlayedMap: Record<string, number> = {};

    for (const match of matches ?? []) {
        const { data: participants, error: pError } = await supabase
            .from("match_participants")
            .select("user_id, team, goals, is_mvp")
            .eq("match_id", match.id)
            .in("team", ["A", "B"]);

        if (pError || !participants || participants.length === 0) continue;

        const eloInputs = participants.map((p) => ({
            userId: p.user_id,
            currentRating: ratingMap[p.user_id] ?? ELO_BASE,
            matchesPlayed: matchesPlayedMap[p.user_id] ?? 0,
            team: p.team as "A" | "B",
            position: (positionMap[p.user_id] ?? "MID") as "GK" | "DEF" | "MID" | "FWD",
            goalsScored: p.goals ?? 0,
            isMvp: p.is_mvp ?? false,
        }));

        const updates = computeMatchEloUpdates(
            eloInputs,
            match.team_a_score!,
            match.team_b_score!
        );

        // Log GK bonuses
        for (const u of updates) {
            const input = eloInputs.find((i) => i.userId === u.userId);
            if (input?.position === "GK") {
                const oppScore = input.team === "A" ? match.team_b_score! : match.team_a_score!;
                let gkBonus = "";
                if (oppScore === 0) gkBonus = " 🧤 Clean Sheet +8";
                else if (oppScore === 1) gkBonus = " 🛡️ Sólida +4";
                if (oppScore >= 5) gkBonus += " 💀 Goleada -3";
                if (gkBonus) console.log(`    GK bonus: ${u.delta > 0 ? "+" : ""}${u.delta}${gkBonus}`);
            }
        }

        for (const u of updates) {
            ratingMap[u.userId] = u.newRating;
            matchesPlayedMap[u.userId] = (matchesPlayedMap[u.userId] ?? 0) + 1;
        }

        console.log(
            `  ⚽ ${match.date.split("T")[0]} | ${match.team_a_score}-${match.team_b_score} | ${participants.length} jugadores`
        );
    }

    // 3. Guardar ratings finales
    console.log("\n💾 Guardando ratings finales...");
    let saved = 0;
    for (const [userId, rating] of Object.entries(ratingMap)) {
        const { error } = await supabase
            .from("profiles")
            .update({ elo_rating: rating })
            .eq("id", userId);
        if (error) {
            console.error(`  ❌ Error guardando ${userId}:`, error.message);
        } else {
            saved++;
        }
    }

    console.log(`\n✅ Listo. ${saved} jugadores actualizados.`);

    // Mostrar resultados con posición
    const { data: finalProfiles } = await supabase
        .from("profiles")
        .select("username, elo_rating, position, matches_played")
        .order("elo_rating", { ascending: false });

    if (finalProfiles && finalProfiles.length > 0) {
        const posEmoji: Record<string, string> = { GK: "🧤", DEF: "🛡️", MID: "🎯", FWD: "⚡" };
        console.log("\n📊 Rankings finales:");
        for (const p of finalProfiles) {
            const prov = (p.matches_played ?? 0) < 3 ? " ⏳ Provisional" : "";
            const pos = posEmoji[p.position ?? "MID"] || "🎯";
            console.log(`  ${pos} ${(p.username || "???").padEnd(25)} ${String(p.elo_rating).padStart(4)} RP  (${p.matches_played ?? 0} partidos)${prov}`);
        }
    }
}

main().catch(console.error);
