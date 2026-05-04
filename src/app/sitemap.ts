import type { MetadataRoute } from "next";
import { createAdminClient } from "@/lib/supabase/admin";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://pachanga.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const admin = createAdminClient();

    const { data: matches } = await admin
        .from("matches")
        .select("id, date")
        .in("status", ["open", "finished"])
        .order("date", { ascending: false })
        .limit(50);

    const matchUrls: MetadataRoute.Sitemap = (matches ?? []).map((m) => ({
        url: `${BASE_URL}/matches/${m.id}`,
        lastModified: new Date(m.date),
        changeFrequency: "weekly" as const,
        priority: 0.6,
    }));

    const { data: players } = await admin
        .from("profiles")
        .select("id")
        .not("username", "is", null)
        .limit(200);

    const playerUrls: MetadataRoute.Sitemap = (players ?? []).map((p) => ({
        url: `${BASE_URL}/players/${p.id}`,
        changeFrequency: "weekly" as const,
        priority: 0.5,
    }));

    return [
        {
            url: BASE_URL,
            changeFrequency: "daily",
            priority: 1.0,
        },
        {
            url: `${BASE_URL}/leaderboard`,
            changeFrequency: "daily",
            priority: 0.9,
        },
        {
            url: `${BASE_URL}/players`,
            changeFrequency: "daily",
            priority: 0.8,
        },
        {
            url: `${BASE_URL}/matches`,
            changeFrequency: "hourly",
            priority: 0.8,
        },
        ...matchUrls,
        ...playerUrls,
    ];
}
