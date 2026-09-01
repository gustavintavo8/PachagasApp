import { createClient, SupabaseClient } from "@supabase/supabase-js";

function getAdminClient(): SupabaseClient {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
        throw new Error("[E2E ABORT] Faltan variables de Supabase local para los helpers de DB.");
    }
    if (!url.includes("127.0.0.1") && !url.includes("localhost")) {
        throw new Error(`[E2E ABORT] db helper: URL no es local: "${url}". Abortando para proteger producción.`);
    }

    return createClient(url, key, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
}

export async function getTestUserId(): Promise<string> {
    const db = getAdminClient();
    const email = process.env.E2E_TEST_EMAIL!;
    const { data, error } = await db.auth.admin.listUsers();
    if (error) throw new Error(`No se pudieron listar los usuarios E2E: ${error.message}`);
    const user = data?.users.find((u) => u.email === email);
    if (!user) throw new Error(`Usuario de test no encontrado: ${email}`);
    return user.id;
}

export async function getGatedTestUserId(): Promise<string> {
    const db = getAdminClient();
    const email = process.env.E2E_GATED_TEST_EMAIL!;
    const { data, error } = await db.auth.admin.listUsers();
    if (error) throw new Error(`No se pudieron listar los usuarios E2E: ${error.message}`);
    const user = data?.users.find((candidate) => candidate.email === email);
    if (!user) throw new Error(`Usuario gated de test no encontrado: ${email}`);
    return user.id;
}

export async function deleteCommunityGrant(userId: string): Promise<void> {
    const admin = getAdminClient();
    const { error } = await admin.from("community_access_grants").delete().eq("user_id", userId);
    if (error) throw new Error("No se pudo limpiar el grant: " + error.message);
}

export async function createTestMatch(params: {
    createdBy: string;
    location?: string;
    maxPlayers?: number;
}): Promise<string> {
    const db = getAdminClient();
    const date = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const { data: season, error: seasonError } = await db
        .from("seasons")
        .select("id")
        .eq("status", "active")
        .single();
    if (seasonError || !season) {
        throw new Error(`createTestMatch season: ${seasonError?.message ?? "Temporada activa no encontrada"}`);
    }
    const { data, error } = await db
        .from("matches")
        .insert({
            date,
            location: params.location ?? "Campo E2E Test",
            max_players: params.maxPlayers ?? 10,
            status: "open",
            created_by: params.createdBy,
            season_id: season.id,
        })
        .select("id")
        .single();
    if (error) throw new Error(`createTestMatch: ${error.message}`);
    return data.id;
}

export async function seedParticipants(
    matchId: string,
    participants: { userId: string; team?: "A" | "B" | null }[]
) {
    const db = getAdminClient();
    const rows = participants.map(({ userId, team = null }) => ({
        match_id: matchId,
        user_id: userId,
        team,
        goals: 0,
        is_mvp: false,
    }));
    const { error } = await db.from("match_participants").insert(rows);
    if (error) throw new Error(`seedParticipants: ${error.message}`);
}

export async function createDummyUsers(count: number): Promise<string[]> {
    const db = getAdminClient();
    const ids: string[] = [];
    for (let i = 0; i < count; i++) {
        const email = `dummy-${Date.now()}-${i}@pachanga.local`;
        const { data, error } = await db.auth.admin.createUser({
            email,
            password: "dummy-password-123",
            email_confirm: true,
        });
        if (error) throw new Error(`createDummyUsers: ${error.message}`);
        const uid = data.user.id;
        const { error: profileError } = await db.from("profiles").insert({
            id: uid,
            username: `dummy-${i}`,
            position: "MID",
            elo_rating: 1000,
            matches_played: 0,
        });
        if (profileError) throw new Error(`createDummyUsers profile: ${profileError.message}`);
        ids.push(uid);
    }
    return ids;
}

export async function deleteMatch(matchId: string) {
    const db = getAdminClient();
    const { error: votesError } = await db.from("mvp_votes").delete().eq("match_id", matchId);
    if (votesError) throw new Error(`deleteMatch mvp_votes: ${votesError.message}`);
    const { error: commentsError } = await db.from("match_comments").delete().eq("match_id", matchId);
    if (commentsError) throw new Error(`deleteMatch match_comments: ${commentsError.message}`);
    const { error: participantsError } = await db.from("match_participants").delete().eq("match_id", matchId);
    if (participantsError) throw new Error(`deleteMatch match_participants: ${participantsError.message}`);
    const { error: matchError } = await db.from("matches").delete().eq("id", matchId);
    if (matchError) throw new Error(`deleteMatch matches: ${matchError.message}`);
}

export async function deleteDummyUsers(userIds: string[]) {
    const db = getAdminClient();
    for (const uid of userIds) {
        const { error: profileError } = await db.from("profiles").delete().eq("id", uid);
        if (profileError) throw new Error(`deleteDummyUsers profile: ${profileError.message}`);
        const { error: authError } = await db.auth.admin.deleteUser(uid);
        if (authError) throw new Error(`deleteDummyUsers auth: ${authError.message}`);
    }
}
