import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { NewMatchForm } from "./NewMatchForm";

export default async function NewMatchPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/login");
    if (user.is_anonymous) redirect("/matches");

    return <NewMatchForm />;
}
