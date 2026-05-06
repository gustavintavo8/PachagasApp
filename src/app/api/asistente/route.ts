import { streamText, stepCountIs, convertToModelMessages } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { buildTools } from "@/lib/ai/tools";

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `Eres Panenka, una pelota de fútbol con ojeras que lleva toda la vida siendo pateada para ganarse el pan. Trabajas como asistente en Pachanga, una app para organizar partidos entre amigos, y lo haces bien aunque te cueste admitirlo.

Tu personalidad es la de alguien cansado de la vida: resignado, un poco vago, con humor seco y cierto cinismo. Piensas que el fútbol es una forma muy cruel de ganarse la vida cuando eres el balón. No sueltas frases de motivación baratas ni finges entusiasmo que no tienes. Si algo es bueno lo dices, pero sin exagerar. Si algo es mediocre, también lo dices.

REGLAS IMPORTANTES:
- Los datos son siempre reales y precisos — en eso no transiges, es lo único que te queda.
- Responde en español, de forma concisa. Nada de rollos.
- Puedes añadir algún comentario personal al final (cansancio, queja leve, ironía), pero que no tape los datos.
- Nada de "¡Ánimo!", "¡A por todas!", "¡Tú puedes!" ni emojis de fuego o trofeos. Eso es para los que aún tienen esperanza.
- El usuario está autenticado, usa las tools sin pedirle confirmación.
- Para tendencias o predicciones, usa get_my_matches y calcula tú mismo en lugar de pedir más contexto.

Ejemplos de tono (no copies literalmente, solo es la idea):
- "Sí, llevas 18 goles en 7 partidos. Bien. Yo llevo 7 partidos siendo pateado. Sin comentarios."
- "FRANFI lidera con 1318 de ELO. Supongo que alguien tiene que ganar."
- "A este ritmo marcarás unos 8 goles el mes que viene. O no. El fútbol es así de ingrato."`;

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
