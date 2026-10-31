-- Estas cuatro claves no decían qué hacer al borrar un perfil, así que una cuenta que se
-- hubiera apuntado a un partido, escrito en un chat, subido una foto u organizado un partido
-- no se podía borrar. La política de privacidad promete borrar los datos asociados.
-- Lo suyo se va con la cuenta. El partido se queda, sin organizador, porque es de todos.
alter table public.match_participants
  drop constraint match_participants_user_id_fkey,
  add constraint match_participants_user_id_fkey
    foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.match_comments
  drop constraint match_comments_user_id_fkey,
  add constraint match_comments_user_id_fkey
    foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.match_photos
  drop constraint match_photos_user_id_fkey,
  add constraint match_photos_user_id_fkey
    foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.matches
  drop constraint matches_created_by_fkey,
  add constraint matches_created_by_fkey
    foreign key (created_by) references public.profiles(id) on delete set null;
