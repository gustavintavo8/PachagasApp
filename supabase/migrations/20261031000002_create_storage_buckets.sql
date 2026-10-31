-- Las políticas de estos buckets ya estaban en el esquema, pero los buckets no se creaban
-- y en una instalación limpia subir una foto fallaba con «Bucket not found».
-- Sin tocar los que ya existen.
insert into storage.buckets (id, name, public)
values
  ('avatars', 'avatars', true),
  ('match_photos', 'match_photos', true)
on conflict (id) do nothing;
