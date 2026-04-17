import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { FantasyTabs } from "./FantasyTabs";
import { Trophy } from "lucide-react";

export default async function FantasyLayout({ children }: { children: React.ReactNode }) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    return (
        <main className="mx-auto max-w-5xl px-4 py-8">
            <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10">
                    <Trophy className="text-accent" size={22} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Fantasy</h1>
                    <p className="text-sm text-muted">Arma tu equipo y compite con todos</p>
                </div>
            </div>
            <FantasyTabs />
            {children}
        </main>
    );
}
