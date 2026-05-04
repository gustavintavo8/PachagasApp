import { createAdminClient } from "@/lib/supabase/admin";

export async function sendNotification(
    userIds: string[],
    type: string,
    title: string,
    message: string,
    matchId?: string
): Promise<void> {
    if (userIds.length === 0) return;
    const admin = createAdminClient();
    const rows = userIds.map((uid) => ({
        user_id: uid,
        type,
        title,
        message,
        match_id: matchId ?? null,
    }));
    const { error } = await admin.from("notifications").insert(rows);
    if (error) {
        console.error("[notifications] Error al enviar notificación:", error.message);
    }
}
