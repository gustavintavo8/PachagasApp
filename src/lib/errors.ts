import type { PostgrestError } from "@supabase/supabase-js";

const PG_ERROR_MAP: Record<string, string> = {
    "23505": "Ya existe un registro con esos datos",
    "23503": "El recurso relacionado no existe",
    "23514": "Los datos no cumplen las restricciones requeridas",
    "42501": "No tienes permiso para realizar esta acción",
    "PGRST116": "Registro no encontrado",
};

export function mapSupabaseError(error: PostgrestError): string {
    console.error("[DB Error]", error.code, error.message, error.details);
    return PG_ERROR_MAP[error.code] ?? "Ha ocurrido un error inesperado";
}
