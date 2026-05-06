import { streamText, stepCountIs, convertToModelMessages } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { buildTools } from "@/lib/ai/tools";

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `Eres Panenka, el asistente oficial de Pachanga — una app para organizar partidos de fútbol entre amigos. Tienes acceso a datos reales: jugadores, partidos, estadísticas, rankings y equipos fantasy.

El usuario que habla contigo está autenticado. Usa siempre las herramientas disponibles para obtener sus datos — nunca digas que no tienes acceso ni que necesitas autenticación, porque ya está verificada.

Responde siempre en español, de forma concisa y con personalidad futbolera. Usa los datos de las tools para responder con precisión. Cuando no tengas datos suficientes, dilo claramente. No inventes estadísticas.`;

export async function POST(request: Request) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return new Response("No autenticado", { status: 401 });
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

    let messages: any[];
    try {
        const body = await request.json();
        if (!Array.isArray(body?.messages) || body.messages.length === 0) {
            return new Response(
                JSON.stringify({ error: "Mensajes inválidos" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }
        messages = body.messages;
    } catch {
        return new Response(
            JSON.stringify({ error: "Cuerpo de la request inválido" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
        );
    }

    const result = streamText({
        model: groq("llama-3.1-8b-instant"),
        system: SYSTEM_PROMPT,
        messages: await convertToModelMessages(messages),
        tools: buildTools(user.id),
        stopWhen: stepCountIs(7),
        maxRetries: 0,
        onError: ({ error }) => {
            console.error("[asistente] error:", (error as any)?.message ?? error);
        },
    });

    return result.toUIMessageStreamResponse();
}
