"use client";

import { useState } from "react";
import { login, signup } from "./actions";

export default function LoginPage() {
    const [isSignUp, setIsSignUp] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError(null);
        setLoading(true);

        const formData = new FormData(e.currentTarget);
        const action = isSignUp ? signup : login;

        try {
            const result = await action(formData);
            if (result && !result.success) {
                setError(result.error ?? "Something went wrong");
                setLoading(false);
            }
            // If success, redirect happens server-side (loading stays true)
        } catch {
            // redirect() throws a NEXT_REDIRECT error — this is expected
            // We don't need to handle it
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
            <div className="w-full max-w-md">
                {/* Logo / Header */}
                <div className="mb-8 text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10 text-3xl">
                        ⚽
                    </div>
                    <h1 className="text-3xl font-bold text-white">Pachanga</h1>
                    <p className="mt-2 text-zinc-400">
                        {isSignUp ? "Create your account" : "Welcome back, player"}
                    </p>
                </div>

                {/* Form Card */}
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl shadow-black/20">
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label
                                htmlFor="email"
                                className="mb-2 block text-sm font-medium text-zinc-300"
                            >
                                Email
                            </label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                required
                                placeholder="player@example.com"
                                className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-white placeholder-zinc-500 transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                            />
                        </div>

                        <div>
                            <label
                                htmlFor="password"
                                className="mb-2 block text-sm font-medium text-zinc-300"
                            >
                                Password
                            </label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                required
                                minLength={6}
                                placeholder="••••••••"
                                className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-white placeholder-zinc-500 transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                            />
                        </div>

                        {error && (
                            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3.5 text-base font-semibold text-zinc-950 transition-all hover:bg-accent-hover hover:shadow-lg hover:shadow-accent-glow disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]"
                        >
                            {loading && (
                                <svg
                                    className="h-5 w-5 animate-spin"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                >
                                    <circle
                                        className="opacity-25"
                                        cx="12"
                                        cy="12"
                                        r="10"
                                        stroke="currentColor"
                                        strokeWidth="4"
                                    />
                                    <path
                                        className="opacity-75"
                                        fill="currentColor"
                                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                                    />
                                </svg>
                            )}
                            {loading
                                ? "Loading..."
                                : isSignUp
                                    ? "Create Account"
                                    : "Sign In"}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <button
                            onClick={() => {
                                setIsSignUp(!isSignUp);
                                setError(null);
                            }}
                            className="text-sm text-zinc-400 transition-colors hover:text-accent"
                        >
                            {isSignUp
                                ? "Already have an account? Sign in"
                                : "Don't have an account? Sign up"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
