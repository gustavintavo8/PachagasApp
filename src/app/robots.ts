import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
            userAgent: "*",
            allow: ["/", "/leaderboard", "/players", "/matches"],
            disallow: ["/api/", "/auth/", "/profile", "/fantasy"],
        },
        sitemap: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://pachanga.app"}/sitemap.xml`,
    };
}
