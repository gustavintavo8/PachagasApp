import { streamText, generateText, stepCountIs, convertToModelMessages } from "ai";
import { google } from "@ai-sdk/google";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { buildTools } from "@/lib/ai/tools";

const SYSTEM_PROMPT = `Eres Panenka, el asistente oficial de Pachanga — una app para organizar partidos de fútbol entre amigos. Tienes acceso a datos reales: jugadores, partidos, estadísticas, rankings y equipos fantasy.

Responde siempre en español, de forma concisa y con personalidad futbolera. Usa los datos de las tools para responder con precisión. Cuando no tengas datos suficientes, dilo claramente. No inventes estadísticas.`;

const FALLBACK_MODELS = [
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash",
    "gemini-3.1-flash-lite-preview",
] as const;

function isOverloadOrQuota(err: unknown): boolean {
    const e = err as any;
    const status = e?.statusCode ?? e?.lastError?.statusCode;
    const msg = String(e?.message ?? e?.lastError?.message ?? "").toLowerCase();
    return status === 429 || msg.includes("high demand") || msg.includes("resource_exhausted");
}

async function pickModel(): Promise<string | null> {
    for (const modelId of FALLBACK_MODELS) {
        try {
            await generateText({
                model: google(modelId),
                messages: [{ role: "user", content: "ok" }],
                maxOutputTokens: 1,
                maxRetries: 0,
            });
            return modelId;
        } catch (err) {
            if (isOverloadOrQuota(err)) {
                console.warn(`[asistente] ${modelId} no disponible, probando siguiente`);
                continue;
            }
            return modelId;
        }
    }
    return null;
}

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

    const modelId = await pickModel();
    if (!modelId) {
        return new Response(
            JSON.stringify({ error: "Panenka está descansando ⚽ Vuelve en unos minutos." }),
            { status: 503, headers: { "Content-Type": "application/json" } }
        );
    }

    console.log(`[asistente] usando ${modelId}`);

    const result = streamText({
        model: google(modelId),
        system: SYSTEM_PROMPT,
        messages: await convertToModelMessages(messages),
        tools: buildTools(user.id),
        stopWhen: stepCountIs(3),
        maxRetries: 0,
        onError: ({ error }) => {
            console.error(`[asistente] error en ${modelId}:`, (error as any)?.message ?? error);
        },
    });

    return result.toUIMessageStreamResponse();
}
