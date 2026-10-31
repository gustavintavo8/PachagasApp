// src/components/Navbar.tsx
import { cache, Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "./BottomNav";
import { EnlacesBarra, NavbarClient } from "./NavbarClient";
import { NotificationBell } from "./NotificationBell";

// La barra de arriba y la de abajo piden el usuario en la misma petición
const usuarioActual = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
});

async function EnlacesSesion() {
  const user = await usuarioActual();
  return <EnlacesBarra sesion={!!user} />;
}

// Una sola campana a cualquier ancho: dos instancias se pisan el canal de realtime
async function AccionesSesion() {
  const user = await usuarioActual();
  if (!user) return null;

  // Cerrar sesión vive en Perfil, a cualquier ancho
  return <NotificationBell userId={user.id} />;
}

export async function BottomNavSesion() {
  const user = await usuarioActual();
  return <BottomNav sesion={!!user} />;
}

export function Navbar() {
  return (
    <NavbarClient
      enlaces={
        <Suspense fallback={<EnlacesBarra />}>
          <EnlacesSesion />
        </Suspense>
      }
      acciones={
        <Suspense fallback={<div className="h-11 w-11" />}>
          <AccionesSesion />
        </Suspense>
      }
    />
  );
}
