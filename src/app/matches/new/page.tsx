import { createClient } from "@/lib/supabase/server";
import { requireCommunityAccess } from "@/lib/access";
import { redirect } from "next/navigation";
import { NewMatchForm } from "./NewMatchForm";

export default async function NewMatchPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/login");

    const access = await requireCommunityAccess(user);
    if (!access.success) redirect("/access");

    return <NewMatchForm />;
}
