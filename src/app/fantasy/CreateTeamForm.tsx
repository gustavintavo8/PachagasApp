"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createFantasyTeam } from "./actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";

export function CreateTeamForm() {
    const [name, setName] = useState("");
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();
    const router = useRouter();

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);
        const result = await createFantasyTeam(name);
        if (result.success) {
            toast("¡Equipo creado con éxito!", "success");
            router.refresh();
        } else {
            toast(result.error ?? "Error al crear el equipo", "error");
        }
        setLoading(false);
    }

    return (
        <Card className="w-full max-w-sm">
            <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                    label="Nombre del equipo"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej: Los Cracks FC"
                    required
                    minLength={2}
                    maxLength={30}
                />
                <Button type="submit" loading={loading} className="w-full">
                    Crear equipo
                </Button>
            </form>
        </Card>
    );
}
