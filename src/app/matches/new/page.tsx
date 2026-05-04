"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createMatch } from "../actions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { CalendarDays, MapPin, Users } from "lucide-react";

export default function NewMatchPage() {
    return (
        <Suspense fallback={<NewMatchSkeleton />}>
            <NewMatchForm />
        </Suspense>
    );
}

function NewMatchSkeleton() {
    return (
        <div className="mx-auto max-w-lg px-4 py-8">
            <div className="skeleton mb-2 h-8 w-48 rounded-lg" />
            <div className="skeleton mb-8 h-5 w-64 rounded-lg" />
            <div className="skeleton h-96 rounded-2xl" />
        </div>
    );
}

function NewMatchForm() {
    const searchParams = useSearchParams();
    const prefillLocation = searchParams.get("location") ?? "";
    const prefillMaxPlayers = searchParams.get("max_players") ?? "10";

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const formData = new FormData(e.currentTarget);

        // Convert the local datetime string into a proper UTC ISO string
        const localDate = formData.get("date") as string;
        if (localDate) {
            formData.set("date", new Date(localDate).toISOString());
        }

        const result = await createMatch(formData);

        if (!result.success) {
            setError(result.error);
            setLoading(false);
        }
    }

    return (
        <div className="mx-auto max-w-lg px-4 py-8">
            <h1 className="mb-2 text-2xl font-bold text-foreground">
                Crear Partido
            </h1>
            <p className="mb-8 text-muted">Organiza la próxima pachanga</p>

            <Card>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <label
                            htmlFor="date"
                            className="flex items-center gap-2 text-sm font-medium text-zinc-300"
                        >
                            <CalendarDays size={16} />
                            Fecha y Hora
                        </label>
                        <input
                            id="date"
                            name="date"
                            type="datetime-local"
                            required
                            className="block w-full min-w-0 appearance-none rounded-xl border border-border bg-zinc-800 px-2 py-3 sm:px-4 text-base text-foreground transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent [color-scheme:dark]"
                        />
                    </div>

                    <div className="space-y-2">
                        <label
                            htmlFor="location"
                            className="flex items-center gap-2 text-sm font-medium text-zinc-300"
                        >
                            <MapPin size={16} />
                            Ubicación
                        </label>
                        <Input
                            id="location"
                            name="location"
                            placeholder="ej. Campo Municipal, Pista 3"
                            defaultValue={prefillLocation}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <label
                            htmlFor="max_players"
                            className="flex items-center gap-2 text-sm font-medium text-zinc-300"
                        >
                            <Users size={16} />
                            Máximo de Jugadores
                        </label>
                        <Input
                            id="max_players"
                            name="max_players"
                            type="number"
                            min="4"
                            max="30"
                            defaultValue={prefillMaxPlayers}
                            required
                        />
                    </div>

                    {error && (
                        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                            {error}
                        </div>
                    )}

                    <Button type="submit" loading={loading} size="lg" className="w-full">
                        Crear Partido
                    </Button>
                </form>
            </Card>
        </div>
    );
}
