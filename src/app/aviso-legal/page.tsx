import type { Metadata } from "next";
import { LEGAL_CONTROLLER_NAME, LEGAL_CONTACT_EMAIL } from "@/lib/legal";

export const metadata: Metadata = {
    title: "Aviso Legal — Pachanga",
    description: "Información legal del prestador del servicio.",
};

export default function AvisoLegalPage() {
    return (
        <article className="mx-auto max-w-2xl px-4 py-10 text-sm leading-relaxed text-foreground [&_h2]:mt-8 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_p]:mb-3 [&_a]:text-accent">
            <h1 className="text-2xl font-bold">Aviso Legal</h1>

            <h2>Titular del servicio</h2>
            <p>{LEGAL_CONTROLLER_NAME}.</p>
            <p>Contacto: <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.</p>

            <h2>Objeto</h2>
            <p>Pachanga es una aplicación para organizar partidos de fútbol entre amigos,
                ofrecida sin ánimo de lucro como proyecto personal.</p>

            <h2>Responsabilidad</h2>
            <p>El contenido publicado por los usuarios (mensajes y fotos) es responsabilidad de
                quien lo publica. Para retirar contenido que te afecte, escribe al contacto indicado.</p>

            <h2>Propiedad intelectual</h2>
            <p>El código y la marca del proyecto pertenecen a su autor. El contenido subido por
                cada usuario sigue siendo de quien lo aporta.</p>
        </article>
    );
}
