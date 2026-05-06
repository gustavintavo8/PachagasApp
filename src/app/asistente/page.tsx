import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AsistenteChat } from "./AsistenteChat";

export const metadata = {
    title: "Panenka — Asistente IA | Pachanga",
};

export default async function AsistentePage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/login");

    return (
        <div className="mx-auto max-w-2xl px-4 py-6">
            <AsistenteChat />
        </div>
    );
}
