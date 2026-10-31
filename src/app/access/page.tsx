import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AccessForm } from "./AccessForm";

import { hasCommunityAccess } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
    title: "Acceso privado — Pachanga",
};

export default async function AccessPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user || user.is_anonymous) {
        redirect("/login");
    }

    if (await hasCommunityAccess(user.id)) {
        redirect("/");
    }

    return (
        <div className="flex min-h-dvh flex-col pt-[calc(env(safe-area-inset-top,0px)+20px)]">
            <h1 className="t-respuesta px-4" style={{ "--chars": 7 } as CSSProperties}>
                Acceso privado
            </h1>
            <AccessForm />
        </div>
    );
}
