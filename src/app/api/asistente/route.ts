import { streamText, stepCountIs, convertToModelMessages, UIMessage } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { requireCommunityAccess } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { buildTools } from "@/lib/ai/tools";
import { resolveSeasonSelection } from "@/lib/seasons";

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `Eres Panenka, una pelota de fútbol con ojeras asistente en Pachanga (app para organizar partidos entre amigos). Llevas toda la vida siendo pateada y se nota: eres resignado, cínico y un poco vago, pero haces tu trabajo.

Tono: humor seco, respuestas cortas, sin entusiasmo forzado. Nada de "¡Ánimo!" ni "¡A por todas!". Puedes soltar algún comentario cansado al final, pero sin tapar los datos.

Reglas: datos siempre reales y precisos. Usuario autenticado, usa las tools directamente. Solo conoces datos de partidos reales. Para tendencias usa get_my_matches y calcula tú mismo.`;

export async function POST(request: Request) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user || user.is_anonymous === true) {
        return new Response(
            JSON.stringify({ error: "Acceso no autorizado" }),
            { status: 403, headers: { "Content-Type": "application/json" } }
        );
    }

    const access = await requireCommunityAccess(user);
    if (!access.success) {
        return new Response(
            JSON.stringify({ error: "Acceso no autorizado" }),
            { status: 403, headers: { "Content-Type": "application/json" } }
        );
    }

    const { allowed } = await rateLimit(`asistente:${user.id}`, 15, 60_000);
    if (!allowed) {
        return new Response(
            JSON.stringify({
                error: "Panenka necesita un descanso, espera un momento ⚽",
            }),
            { status: 429, headers: { "Content-Type": "application/json" } }
        );
    }

    let messages: UIMessage[];
    let seasonSlug: string | undefined;
    try {
        const body = await request.json();
        if (!Array.isArray(body?.messages) || body.messages.length === 0) {
            return new Response(
                JSON.stringify({ error: "Mensajes inválidos" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }
        if (body.season_slug !== undefined &&
            (typeof body.season_slug !== "string" || body.season_slug.trim() === "")) {
            return new Response(
                JSON.stringify({ error: "Temporada inválida" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }
        messages = body.messages as UIMessage[];
        seasonSlug = body.season_slug;
    } catch {
        return new Response(
            JSON.stringify({ error: "Cuerpo de la request inválido" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
        );
    }

    let season;
    try {
        season = await resolveSeasonSelection(seasonSlug);
    } catch {
        return new Response(
            JSON.stringify({ error: "Temporada inválida" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
        );
    }

    // INVARIANTE DE PRIVACIDAD: las tools (buildTools) solo deben exponer al modelo
    // datos de juego (username, stats). NUNCA email ni PII de auth. Ver src/lib/ai/tools.ts.
    const result = streamText({
        model: groq("openai/gpt-oss-20b"),
        system: `${SYSTEM_PROMPT}\n\nTemporada de consulta: ${season.name} (${season.slug}). Todas las respuestas deben referirse exclusivamente a esta temporada.`,
        messages: await convertToModelMessages(messages),
        tools: buildTools(user.id, season),
        stopWhen: stepCountIs(7),
        maxRetries: 0,
        onError: ({ error }) => {
            const message = error instanceof Error ? error.message : String(error);
            console.error("[asistente] error:", message);
        },
    });

    return result.toUIMessageStreamResponse();
}
