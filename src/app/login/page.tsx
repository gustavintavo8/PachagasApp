"use client";

import { useState } from "react";
import Image from "next/image";
import { login, signup, signInWithOAuth } from "./actions";

export default function LoginPage() {
    const [isSignUp, setIsSignUp] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [oauthLoading, setOauthLoading] = useState<string | null>(null);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError(null);
        setLoading(true);

        const formData = new FormData(e.currentTarget);
        const action = isSignUp ? signup : login;

        let result: { success?: boolean; error?: string } | undefined;
        try {
            result = await action(formData);
        } catch {
            // redirect() throws NEXT_REDIRECT — expected
            return;
        }
        if (result && !result.success) {
            setError(result.error ?? "Algo salió mal");
            setLoading(false);
        }
    }

    async function handleOAuth(provider: "google" | "apple") {
        setError(null);
        setOauthLoading(provider);
        let result: { error?: string; url?: string };
        try {
            result = await signInWithOAuth(provider);
        } catch {
            setError("Error al conectar con el proveedor");
            setOauthLoading(null);
            return;
        }
        if (result.error) {
            setError(result.error);
            setOauthLoading(null);
        } else if (result.url) {
            window.location.href = result.url;
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
            <div className="w-full max-w-md">
                {/* Logo / Header */}
                <div className="mb-8 text-center">
                    <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-accent/10 overflow-hidden">
                        <Image
                            src="/icon-192.png"
                            alt="Pachanga"
                            width={64}
                            height={64}
                            className="rounded-xl"
                        />
                    </div>
                    <h1 className="text-3xl font-bold text-white">Pachanga</h1>
                    <p className="mt-2 text-zinc-400">
                        {isSignUp ? "Crea tu cuenta y empieza a jugar" : "Bienvenido de vuelta, jugador"}
                    </p>
                </div>

                {/* Form Card */}
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl shadow-black/20">
                    {/* OAuth Buttons */}
                    <div className="space-y-3 mb-6">
                        <button
                            onClick={() => handleOAuth("google")}
                            disabled={!!oauthLoading}
                            className="flex w-full items-center justify-center gap-3 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm font-medium text-white transition-all hover:border-zinc-600 hover:bg-zinc-750 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]"
                        >
                            {oauthLoading === "google" ? (
                                <Spinner />
                            ) : (
                                <svg width="18" height="18" viewBox="0 0 24 24">
                                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                </svg>
                            )}
                            Continuar con Google
                        </button>


                    </div>

                    {/* Divider */}
                    <div className="relative mb-6">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-zinc-700" />
                        </div>
                        <div className="relative flex justify-center text-xs">
                            <span className="bg-zinc-900 px-3 text-zinc-500">o con email</span>
                        </div>
                    </div>

                    {/* Email/Password Form */}
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
                                placeholder="jugador@ejemplo.com"
                                className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-white placeholder-zinc-500 transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                            />
                        </div>

                        <div>
                            <label
                                htmlFor="password"
                                className="mb-2 block text-sm font-medium text-zinc-300"
                            >
                                Contraseña
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
                            {loading && <Spinner dark />}
                            {loading
                                ? "Cargando..."
                                : isSignUp
                                    ? "Crear Cuenta"
                                    : "Iniciar Sesión"}
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
                                ? "¿Ya tienes cuenta? Inicia sesión"
                                : "¿No tienes cuenta? Regístrate"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function Spinner({ dark }: { dark?: boolean }) {
    return (
        <svg
            className={`h-5 w-5 animate-spin ${dark ? "text-zinc-950" : "text-white"}`}
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
    );
}
