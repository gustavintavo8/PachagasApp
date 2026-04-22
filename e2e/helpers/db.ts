import { createClient, SupabaseClient } from "@supabase/supabase-js";

function getLocalAdminClient(): SupabaseClient {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!url.includes("127.0.0.1") && !url.includes("localhost")) {
        throw new Error(`[E2E ABORT] db helper: URL no es local: "${url}". Abortando para proteger producción.`);
    }

    return createClient(url, key, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
}

export async function getTestUserId(): Promise<string> {
    const db = getLocalAdminClient();
    const email = process.env.E2E_TEST_EMAIL!;
    const { data } = await db.auth.admin.listUsers();
    const user = data?.users.find((u) => u.email === email);
    if (!user) throw new Error(`Usuario de test no encontrado: ${email}`);
    return user.id;
}

export async function createTestMatch(params: {
    createdBy: string;
    location?: string;
    maxPlayers?: number;
}): Promise<string> {
    const db = getLocalAdminClient();
    const date = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await db
        .from("matches")
        .insert({
            date,
            location: params.location ?? "Campo E2E Test",
            max_players: params.maxPlayers ?? 10,
            status: "open",
            created_by: params.createdBy,
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
    const db = getLocalAdminClient();
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
    const db = getLocalAdminClient();
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
        await db.from("profiles").insert({
            id: uid,
            username: `dummy-${i}`,
            position: "MID",
            elo_rating: 1000,
            matches_played: 0,
        });
        ids.push(uid);
    }
    return ids;
}

export async function deleteMatch(matchId: string) {
    const db = getLocalAdminClient();
    await db.from("mvp_votes").delete().eq("match_id", matchId);
    await db.from("match_comments").delete().eq("match_id", matchId);
    await db.from("match_participants").delete().eq("match_id", matchId);
    await db.from("matches").delete().eq("id", matchId);
}

export async function deleteDummyUsers(userIds: string[]) {
    const db = getLocalAdminClient();
    for (const uid of userIds) {
        await db.from("profiles").delete().eq("id", uid);
        await db.auth.admin.deleteUser(uid);
    }
}
