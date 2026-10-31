// Supabase contesta en inglés. Lo que llega de las actions ya viene en español.
const TRADUCCIONES: [RegExp, string][] = [
    [/invalid login credentials/i, "Email o contraseña incorrectos."],
    [/email not confirmed/i, "Debes confirmar tu email antes de iniciar sesión. Revisa tu bandeja de entrada."],
    [/already (been )?registered|already exists/i, "Este email ya está registrado. Inicia sesión."],
    [/rate limit|too many/i, "Demasiados intentos. Espera un minuto."],
    [/password should|at least \d+ characters/i, "La contraseña debe tener al menos 6 caracteres"],
    [/valid email|invalid format/i, "Ese email no es válido."],
    [/signups? not allowed|signups? (is |are )?disabled/i, "Ahora mismo no se pueden crear cuentas."],
    [/provider is not enabled/i, "Ese acceso no está disponible ahora mismo."],
];

const ESPANOL = /[áéíóúñ]|^Demasiados/i;

export const ERROR_GENERICO = "Algo salió mal. Inténtalo de nuevo.";
export const ERROR_CONEXION = "No hemos podido conectar. Inténtalo de nuevo.";

export function errorEnEspanol(mensaje: string | null | undefined): string {
    if (!mensaje) return ERROR_GENERICO;
    const traduccion = TRADUCCIONES.find(([patron]) => patron.test(mensaje));
    if (traduccion) return traduccion[1];
    return ESPANOL.test(mensaje) ? mensaje : ERROR_GENERICO;
}

/** redirect() en una action llega al cliente como un error con este digest. */
export function esRedireccion(error: unknown): boolean {
    return (
        typeof error === "object" &&
        error !== null &&
        "digest" in error &&
        String(error.digest).startsWith("NEXT_REDIRECT")
    );
}
