import type { Metadata } from "next";
import { LEGAL_CONTACT_EMAIL } from "@/lib/legal";

export const metadata: Metadata = {
    title: "Términos de Uso — Pachanga",
    description: "Condiciones de uso de Pachanga.",
};

export default function TerminosPage() {
    return (
        <article className="mx-auto max-w-2xl px-4 py-10 text-sm leading-relaxed text-foreground [&_h2]:mt-8 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_p]:mb-3 [&_ul]:mb-3 [&_ul]:ml-5 [&_ul]:list-disc [&_a]:text-accent">
            <h1 className="text-2xl font-bold">Términos de Uso</h1>

            <h2>1. Uso del servicio</h2>
            <p>Debes tener al menos 14 años para usar Pachanga. Te comprometes a usar la app de
                forma respetuosa con el resto de jugadores.</p>

            <h2>2. Contenido que publicas</h2>
            <ul>
                <li>Eres responsable de los mensajes y fotos que subes.</li>
                <li>No publiques contenido ofensivo, ilegal o que vulnere derechos de terceros.</li>
            </ul>

            <h2>3. Fotos y derechos de imagen</h2>
            <p>Solo debes subir fotos sobre las que tengas derechos y con el consentimiento de las
                personas que aparezcan en ellas. Si una foto te afecta y quieres retirarla, escribe a{" "}
                <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a> y la eliminaremos.</p>

            <h2>4. Asistente de IA</h2>
            <p>«Panenka» es un asistente automático: sus respuestas pueden contener errores y no
                deben tomarse como asesoramiento. Consulta la <a href="/privacidad">Política de Privacidad</a>{" "}
                para saber cómo se procesan tus consultas.</p>

            <h2>5. Cambios</h2>
            <p>Podemos actualizar estos términos. Si el cambio es relevante, te lo indicaremos en la app.</p>
        </article>
    );
}
