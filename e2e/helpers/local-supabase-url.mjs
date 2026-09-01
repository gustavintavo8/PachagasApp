const LOCAL_SUPABASE_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

function normalizedHostname(url) {
    return url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
}

export function isLocalSupabaseUrl(rawUrl) {
    if (typeof rawUrl !== "string" || rawUrl.trim() === "") {
        return false;
    }

    let parsedUrl;
    try {
        parsedUrl = new URL(rawUrl);
    } catch {
        return false;
    }

    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
        return false;
    }

    return LOCAL_SUPABASE_HOSTS.has(normalizedHostname(parsedUrl));
}

export function assertLocalSupabaseUrl(rawUrl) {
    if (!isLocalSupabaseUrl(rawUrl)) {
        throw new Error(
            `[E2E ABORT] NEXT_PUBLIC_SUPABASE_URL no apunta a un host local permitido: "${rawUrl}".`
        );
    }
}
