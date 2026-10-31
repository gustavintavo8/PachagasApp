"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Check, Loader2 } from "lucide-react";
import { login, signup } from "./actions";
import { ERROR_CONEXION, ERROR_GENERICO, errorEnEspanol, esRedireccion, puertaDeError } from "./errores";
import { Portero } from "./Portero";
import { AvisoError } from "@/components/AvisoError";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { COOKIE_DESTINO, rutaInterna } from "@/lib/destino";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { frasePuerta } from "@/lib/titulares";
import { cn } from "@/lib/utils";

// Se lee al enviar: esta pantalla se reutiliza oculta y el destino de antes ya no vale
function destinoPedido() {
    return rutaInterna(new URLSearchParams(window.location.search).get("next"));
}

export default function LoginPage() {
    const [isSignUp, setIsSignUp] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [oauthLoading, setOauthLoading] = useState<string | null>(null);
    const [consent, setConsent] = useState(false);
    const [ageOk, setAgeOk] = useState(false);
    const formRef = useRef<HTMLFormElement>(null);

    const signupBlocked = isSignUp && (!consent || !ageOk);

    // cacheComponents guarda esta pantalla oculta tras entrar y la devuelve al cerrar
    // sesión: la limpieza corre al ocultarse, y con ella se va la contraseña del DOM.
    // El formulario se apunta antes porque React suelta la ref al ocultar.
    useEffect(() => {
        const form = formRef.current;
        return () => {
            form?.reset();
            setLoading(false);
            setOauthLoading(null);
            setError(null);
            setSuccessMessage(null);
            setIsSignUp(false);
            setConsent(false);
            setAgeOk(false);
        };
    }, []);

    function cambiarModo(registro: boolean) {
        setIsSignUp(registro);
        setError(null);
        setSuccessMessage(null);
        setConsent(false);
        setAgeOk(false);
    }

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError(null);
        setSuccessMessage(null);
        setLoading(true);

        const formData = new FormData(e.currentTarget);
        formData.set("next", destinoPedido() ?? "");
        const action = isSignUp ? signup : login;
        // Si la action redirige, el botón sigue ocupado hasta que cambie la página
        let saliendo = false;

        try {
            const result = await action(formData);
            if (!result) {
                saliendo = true;
            } else if (!result.success) {
                setError(errorEnEspanol(result.error));
            } else if (result.data) {
                setSuccessMessage(result.data);
                setIsSignUp(false);
                setConsent(false);
                setAgeOk(false);
            }
        } catch (fallo) {
            if (esRedireccion(fallo)) saliendo = true;
            else setError(ERROR_CONEXION);
        } finally {
            if (!saliendo) setLoading(false);
        }
    }

    async function handleOAuth(provider: "google" | "apple") {
        setError(null);
        setSuccessMessage(null);
        setOauthLoading(provider);

        try {
            // Google vuelve a /auth/callback, y esa URL no admite parámetros: el destino espera en una cookie
            const destino = destinoPedido();
            if (destino) {
                document.cookie = `${COOKIE_DESTINO}=${encodeURIComponent(destino)}; Path=/; Max-Age=600; SameSite=Lax`;
            }

            const supabase = createBrowserClient();
            const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
                provider,
                options: {
                    redirectTo: `${window.location.origin}/auth/callback`,
                    // Keep the PKCE verifier in the browser before navigating
                    // to Supabase, so the server callback can exchange the code.
                    skipBrowserRedirect: true,
                },
            });

            if (oauthError) {
                setError(errorEnEspanol(oauthError.message));
                setOauthLoading(null);
                return;
            }

            if (data.url) {
                window.location.href = data.url;
                return;
            }

            setError(ERROR_GENERICO);
            setOauthLoading(null);
        } catch {
            setError(ERROR_CONEXION);
            setOauthLoading(null);
        }
    }

    const frase = frasePuerta(error ? puertaDeError(error) : isSignUp ? "registro" : "login");

    return (
        <div className="pt-[calc(env(safe-area-inset-top,0px)+20px)]">
            <h1 className="t-cartel px-4" style={{ "--chars": 7.4 } as CSSProperties}>
                Pachanga
            </h1>

            <div className="mt-5">
                <Portero frase={frase} />
            </div>

            <div className="md:max-w-[440px]">
                {/* Mismo lenguaje que la barra inferior: blanco con regla arriba */}
                <div className="flex gap-6 px-4">
                    <Modo activo={!isSignUp} onClick={() => cambiarModo(false)}>
                        Iniciar sesión
                    </Modo>
                    <Modo activo={isSignUp} onClick={() => cambiarModo(true)}>
                        Registrarse
                    </Modo>
                </div>

                <div className="px-4 pb-8 pt-3">
                    {successMessage && (
                        <p role="status" className="-mx-4 mb-5 bg-foreground px-4 py-3 font-medium text-background">
                            {successMessage}
                        </p>
                    )}

                    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
                        {isSignUp && (
                            <Input
                                id="username"
                                name="username"
                                label="Apodo"
                                required
                                minLength={2}
                                maxLength={30}
                                placeholder="Como te llaman en el campo"
                                autoComplete="nickname"
                                enterKeyHint="next"
                            />
                        )}

                        <Input
                            id="email"
                            name="email"
                            type="email"
                            label="Email"
                            required
                            placeholder="jugador@ejemplo.com"
                            autoComplete="email"
                            autoCapitalize="none"
                            autoCorrect="off"
                            spellCheck={false}
                            inputMode="email"
                            enterKeyHint="next"
                        />

                        <div className="space-y-1.5">
                            <Input
                                id="password"
                                name="password"
                                type="password"
                                label="Contraseña"
                                required
                                minLength={6}
                                placeholder="••••••••"
                                autoComplete={isSignUp ? "new-password" : "current-password"}
                                enterKeyHint={isSignUp ? "next" : "go"}
                                aria-describedby={isSignUp ? "password-pista" : undefined}
                            />
                            {isSignUp && (
                                <p id="password-pista" className="t-meta text-muted">
                                    Mínimo 6 caracteres
                                </p>
                            )}
                        </div>

                        {isSignUp && (
                            <div>
                                <Casilla name="accept_terms" checked={consent} onChange={setConsent}>
                                    He leído y acepto la Política de Privacidad y los Términos.
                                </Casilla>
                                {/* Fuera de la frase: dentro de la etiqueta, un toque bajo marca la casilla */}
                                <div className="flex gap-6 pl-9">
                                    <a href="/privacidad" target="_blank" className="t-meta inline-flex min-h-11 items-center underline underline-offset-2">
                                        Leer la política
                                    </a>
                                    <a href="/terminos" target="_blank" className="t-meta inline-flex min-h-11 items-center underline underline-offset-2">
                                        Leer los términos
                                    </a>
                                </div>
                                <Casilla name="confirm_age" checked={ageOk} onChange={setAgeOk}>
                                    Confirmo que tengo 14 años o más.
                                </Casilla>
                            </div>
                        )}

                        {error && <AvisoError>{error}</AvisoError>}

                        <Button
                            type="submit"
                            size="lg"
                            className="w-full"
                            loading={loading}
                            disabled={signupBlocked}
                        >
                            {isSignUp ? "Crear cuenta" : "Iniciar sesión"}
                        </Button>
                    </form>

                    <button
                        type="button"
                        onClick={() => void handleOAuth("google")}
                        disabled={!!oauthLoading || signupBlocked}
                        aria-busy={!!oauthLoading || undefined}
                        className={buttonClasses("outline", "lg", "mt-3 w-full")}
                    >
                        {oauthLoading === "google" ? (
                            <Loader2 size={18} strokeWidth={1.75} aria-hidden="true" className="animate-spin" />
                        ) : (
                            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                            </svg>
                        )}
                        {isSignUp ? "Registrarse con Google" : "Continuar con Google"}
                    </button>

                    {/* Sin enlaces: en esta ruta el pie es el único que enlaza las legales */}
                    {!isSignUp && (
                        <p className="t-meta mt-3 text-muted">
                            Si es tu primera vez con Google, al continuar aceptas la Política de Privacidad y los
                            Términos, y confirmas que tienes 14 años o más.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}

function Modo({
    activo,
    onClick,
    children,
}: {
    activo: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={activo}
            className={cn(
                "relative min-h-12 font-display text-[23px] font-semibold",
                activo
                    ? "text-foreground before:absolute before:inset-x-0 before:-top-px before:h-0.5 before:bg-foreground"
                    : "text-muted active:text-foreground"
            )}
        >
            {children}
        </button>
    );
}

function Casilla({
    name,
    checked,
    onChange,
    children,
}: {
    name: string;
    checked: boolean;
    onChange: (marcada: boolean) => void;
    children: React.ReactNode;
}) {
    return (
        <label className="flex min-h-11 cursor-pointer items-start gap-3 py-2.5">
            <span className="relative mt-px h-6 w-6 shrink-0">
                <input
                    type="checkbox"
                    name={name}
                    checked={checked}
                    onChange={(e) => onChange(e.target.checked)}
                    className="peer absolute inset-0 m-0 h-6 w-6 cursor-pointer appearance-none border-2 border-foreground checked:bg-foreground"
                />
                <Check
                    size={18}
                    strokeWidth={2.5}
                    aria-hidden="true"
                    className="pointer-events-none absolute left-[3px] top-[3px] text-background opacity-0 peer-checked:opacity-100"
                />
            </span>
            <span>{children}</span>
        </label>
    );
}
