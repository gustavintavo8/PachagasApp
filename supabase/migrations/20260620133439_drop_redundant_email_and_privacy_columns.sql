-- Bloque 0: minimización — el email vive en auth.users; quitar duplicado público.
-- Bloque 3 (prep): columnas de evidencia de consentimiento.

-- 1) Columnas de consentimiento (usadas por Tasks 7/8)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS accepted_privacy_version text,
  ADD COLUMN IF NOT EXISTS accepted_privacy_at timestamptz;

-- 2) Recrear el trigger de alta SIN insertar email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
begin
  insert into public.profiles (id, username, position, accepted_privacy_version, accepted_privacy_at)
  values (
    new.id,
    COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    'MID',
    new.raw_user_meta_data->>'accepted_privacy_version',
    case
      when new.raw_user_meta_data->>'accepted_privacy_version' is not null then now()
      else null
    end
  );
  return new;
end;
$$;

-- 3) Eliminar la columna redundante (el email sigue en auth.users)
ALTER TABLE public.profiles DROP COLUMN IF EXISTS email;
