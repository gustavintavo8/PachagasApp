"use client";

import { useState } from "react";
import { createMatch } from "../actions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { CalendarDays, MapPin, Users } from "lucide-react";

export default function NewMatchPage() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const formData = new FormData(e.currentTarget);
        const result = await createMatch(formData);

        if (result?.error) {
            setError(result.error);
            setLoading(false);
        }
    }

    return (
        <div className="mx-auto max-w-lg px-4 py-8">
            <h1 className="mb-2 text-2xl font-bold text-foreground">
                ⚽ Create a Match
            </h1>
            <p className="mb-8 text-muted">Set up the next pachanga</p>

            <Card>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <label
                            htmlFor="date"
                            className="flex items-center gap-2 text-sm font-medium text-zinc-300"
                        >
                            <CalendarDays size={16} />
                            Date & Time
                        </label>
                        <input
                            id="date"
                            name="date"
                            type="datetime-local"
                            required
                            className="w-full rounded-xl border border-border bg-zinc-800 px-4 py-3 text-foreground transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent [color-scheme:dark]"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-zinc-300">
                            <MapPin size={16} />
                            Location
                        </label>
                        <Input
                            id="location"
                            name="location"
                            placeholder="e.g. Central Park Field 3"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-zinc-300">
                            <Users size={16} />
                            Max Players
                        </label>
                        <Input
                            id="max_players"
                            name="max_players"
                            type="number"
                            min="4"
                            max="30"
                            defaultValue="10"
                            required
                        />
                    </div>

                    {error && (
                        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                            {error}
                        </div>
                    )}

                    <Button type="submit" loading={loading} size="lg" className="w-full">
                        Create Match
                    </Button>
                </form>
            </Card>
        </div>
    );
}
