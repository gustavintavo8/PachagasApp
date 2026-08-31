import { redirect } from "next/navigation";

import { AccessForm } from "./AccessForm";

import { hasCommunityAccess } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";

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
        <div className="flex min-h-[calc(100vh-12rem)] items-center justify-center px-4 py-12">
            <div className="w-full max-w-md space-y-5 text-center">
                <div className="space-y-2">
                    <p className="text-sm font-medium uppercase tracking-[0.24em] text-accent">
                        Comunidad privada
                    </p>
                    <h1 className="text-3xl font-semibold text-foreground">
                        Acceso privado
                    </h1>
                    <p className="text-sm text-muted">
                        Introduce tu código para activar el acceso a la comunidad.
                    </p>
                </div>

                <AccessForm />
            </div>
        </div>
    );
}
