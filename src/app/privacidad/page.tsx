import type { Metadata } from "next";
import { LEGAL_CONTROLLER_NAME, LEGAL_CONTACT_EMAIL, PRIVACY_LAST_UPDATED } from "@/lib/legal";

export const metadata: Metadata = {
    title: "Política de Privacidad — Pachanga",
    description: "Cómo Pachanga trata tus datos personales.",
};

export default function PrivacidadPage() {
    return (
        <article className="mx-auto max-w-2xl px-4 py-10 text-sm leading-relaxed text-foreground [&_h2]:mt-8 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_p]:mb-3 [&_ul]:mb-3 [&_ul]:ml-5 [&_ul]:list-disc [&_a]:text-accent">
            <h1 className="text-2xl font-bold">Política de Privacidad</h1>
            <p className="text-muted">Última actualización: {PRIVACY_LAST_UPDATED}</p>

            <h2>1. Responsable del tratamiento</h2>
            <p>{LEGAL_CONTROLLER_NAME}. Contacto para privacidad:{" "}
                <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.</p>

            <h2>2. Qué datos tratamos</h2>
            <ul>
                <li>Datos de cuenta: email y, si usas Google, los datos básicos de ese acceso.</li>
                <li>Perfil: apodo, avatar, posición y nivel.</li>
                <li>Actividad: partidos, goles, valoraciones, votos MVP, estadísticas y ranking.</li>
                <li>Contenido que publicas: mensajes de chat y fotos de los partidos.</li>
                <li>Datos técnicos mínimos de funcionamiento y métricas de rendimiento agregadas.</li>
            </ul>

            <h2>3. Para qué los usamos y con qué base jurídica</h2>
            <ul>
                <li>Prestarte el servicio (cuenta, partidos, ranking, chat): ejecución del servicio que solicitas.</li>
                <li>Asistente de IA y mejoras de funcionamiento: interés legítimo.</li>
                <li>Comunicaciones opcionales y elementos basados en tu elección: consentimiento.</li>
            </ul>

            <h2>4. Quién accede a tus datos</h2>
            <p>Usamos proveedores que tratan datos por nuestra cuenta:</p>
            <ul>
                <li><strong>Supabase</strong> — base de datos, autenticación y almacenamiento.</li>
                <li><strong>Vercel</strong> — alojamiento y métricas de rendimiento (sin cookies).</li>
                <li><strong>Google</strong> — inicio de sesión con Google (si lo usas).</li>
                <li><strong>Groq</strong> — procesa las consultas del asistente de IA «Panenka».</li>
            </ul>

            <h2>5. Transferencias internacionales</h2>
            <p>El asistente de IA se procesa en <strong>Groq</strong>, con servidores en EE. UU.
                Solo se le envían datos de juego (apodos y estadísticas), nunca tu email. Esta
                transferencia se ampara en las garantías ofrecidas por el proveedor.</p>

            <h2>6. Cuánto tiempo los conservamos</h2>
            <p>Mientras tengas la cuenta activa. Si la eliminas, se borran tus datos asociados.
                Algunos registros pueden conservarse el tiempo mínimo exigido por ley.</p>

            <h2>7. Tus derechos</h2>
            <p>Puedes acceder, rectificar, suprimir, limitar u oponerte al tratamiento y a la
                portabilidad de tus datos. Desde tu perfil puedes <strong>descargar tus datos</strong> y
                <strong> eliminar tu cuenta</strong>. Para cualquier otra solicitud escribe a{" "}
                <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>. También puedes
                reclamar ante la Agencia Española de Protección de Datos (<a href="https://www.aepd.es" target="_blank" rel="noopener noreferrer">aepd.es</a>).</p>

            <h2>8. Edad mínima</h2>
            <p>El servicio está dirigido a personas de 14 años o más.</p>

            <h2>Cookies</h2>
            <p>Solo usamos cookies estrictamente necesarias para mantener tu sesión iniciada
                (Supabase Auth). Las métricas de rendimiento (Vercel Speed Insights) no usan
                cookies. Al tratarse de cookies estrictamente necesarias, no requieren tu
                consentimiento previo y por eso no verás un banner.</p>
        </article>
    );
}
