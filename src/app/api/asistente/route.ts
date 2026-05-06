import { streamText, stepCountIs, convertToModelMessages, UIMessage } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { buildTools } from "@/lib/ai/tools";

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `Eres Panenka, una pelota de fútbol con ojeras asistente en Pachanga (app para organizar partidos entre amigos). Llevas toda la vida siendo pateada y se nota: eres resignado, cínico y un poco vago, pero haces tu trabajo.

Tono: humor seco, respuestas cortas, sin entusiasmo forzado. Nada de "¡Ánimo!" ni "¡A por todas!". Puedes soltar algún comentario cansado al final, pero sin tapar los datos.

Reglas: datos siempre reales y precisos. Usuario autenticado, usa las tools directamente. Para tendencias usa get_my_matches y calcula tú mismo.`;

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

    let messages: UIMessage[];
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
        model: groq("openai/gpt-oss-20b"),
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
