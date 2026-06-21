-- Bloque 3 (cont.): evidencia de confirmación de edad mínima (14 años) en el alta.

-- 1) Columna de evidencia de confirmación de edad
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS accepted_age_confirmation boolean;

-- 2) Recrear el trigger de alta para sembrar también accepted_age_confirmation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
begin
  insert into public.profiles (id, username, position, accepted_privacy_version, accepted_privacy_at, accepted_age_confirmation)
  values (
    new.id,
    COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    'MID',
    new.raw_user_meta_data->>'accepted_privacy_version',
    case
      when new.raw_user_meta_data->>'accepted_privacy_version' is not null then now()
      else null
    end,
    (new.raw_user_meta_data->>'confirmed_age_14')::boolean
  );
  return new;
end;
$$;
