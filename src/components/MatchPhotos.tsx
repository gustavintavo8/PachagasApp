"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Image from "next/image";
import imageCompression from "browser-image-compression";
import { ChevronLeft, ChevronRight, Plus, TriangleAlert, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/Toast";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { PanenkaDice } from "@/components/PanenkaDice";
import { getAvatarUrl } from "@/lib/utils";
import { fechaCorta, fraseVacio, plural } from "@/lib/titulares";

interface Photo {
    id: string;
    match_id: string;
    user_id: string;
    photo_url: string;
    created_at: string;
    profiles?: {
        username: string | null;
        avatar_url: string | null;
    };
}

interface MatchPhotosProps {
    matchId: string;
    currentUserId: string;
}

const CONSULTA = "*, profiles(username, avatar_url)";
const POR_PAGINA = 12;
const LIMITE_COMPRESION_MS = 30_000;

// A sangre aunque el contenedor traiga márgenes: el ancho de la pantalla o el de la columna
const A_SANGRE = "w-[min(100vw,640px)] ml-[calc(50%-min(50vw,320px))]";

// next.config solo optimiza Supabase: el resto de hosts se pide tal cual
function sinOptimizar(url: string) {
    return !/^https:\/\/[^/]+\.supabase\.co\/storage\/v1\/object\/public\//.test(url);
}

function autorDe(foto: Photo) {
    return foto.profiles?.username || "Anónimo";
}

function conLimite<T>(promesa: Promise<T>, ms: number): Promise<T> {
    return new Promise((resolver, rechazar) => {
        const limite = setTimeout(() => rechazar(new Error("tiempo agotado")), ms);
        promesa.then(resolver, rechazar).finally(() => clearTimeout(limite));
    });
}

// La primera manda; el resto rellena. Con una o dos no hay jerarquía que hacer.
function rejilla(total: number) {
    if (total === 1) return { columnas: 1, destacada: false };
    if (total === 2) return { columnas: 2, destacada: false };
    return { columnas: 3, destacada: true };
}

export function MatchPhotos({ matchId, currentUserId }: MatchPhotosProps) {
    const [supabase] = useState(createClient);
    const { toast } = useToast();
    const [photos, setPhotos] = useState<Photo[]>([]);
    const [total, setTotal] = useState(0);
    const [carga, setCarga] = useState<"cargando" | "lista" | "error">("cargando");
    const [intento, setIntento] = useState(0);
    const [cargandoMas, setCargandoMas] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [abierta, setAbierta] = useState<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        let vigente = true;
        supabase
            .from("match_photos")
            .select(CONSULTA, { count: "exact" })
            .eq("match_id", matchId)
            .order("created_at", { ascending: false })
            .range(0, POR_PAGINA - 1)
            .then(({ data, count, error }) => {
                if (!vigente) return;
                if (error) {
                    setCarga("error");
                    return;
                }
                setPhotos((data as unknown as Photo[]) ?? []);
                setTotal(count ?? data?.length ?? 0);
                setCarga("lista");
            });
        return () => {
            vigente = false;
        };
    }, [supabase, matchId, intento]);

    async function cargarMas() {
        if (cargandoMas || photos.length >= total) return;
        setCargandoMas(true);
        const { data, error } = await supabase
            .from("match_photos")
            .select(CONSULTA)
            .eq("match_id", matchId)
            .order("created_at", { ascending: false })
            .range(photos.length, photos.length + POR_PAGINA - 1);

        if (error) {
            toast("No se han podido cargar más fotos", "error");
        } else {
            const nuevas = (data as unknown as Photo[]) ?? [];
            setPhotos((prev) => [...prev, ...nuevas.filter((n) => !prev.some((p) => p.id === n.id))]);
        }
        setCargandoMas(false);
    }

    async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        // Se vacía ya: elegir otra vez la misma foto tiene que volver a disparar el cambio
        e.target.value = "";
        if (!file) return;

        if (!file.type.startsWith("image/")) {
            toast("Solo se permiten imágenes", "error");
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            toast("La imagen no puede superar 5MB", "error");
            return;
        }

        setUploading(true);
        try {
            let comprimida: File;
            try {
                comprimida = await conLimite(
                    imageCompression(file, { maxSizeMB: 0.5, maxWidthOrHeight: 1280, useWebWorker: true }),
                    LIMITE_COMPRESION_MS
                );
            } catch {
                toast("Esa foto no se ha podido leer. Prueba con otra.", "error");
                return;
            }

            const ext = comprimida.name.split(".").pop() || "jpg";
            const fileName = `${matchId}/${currentUserId}-${Date.now()}.${ext}`;

            const { error: uploadError } = await supabase.storage
                .from("match_photos")
                .upload(fileName, comprimida, { upsert: false });
            if (uploadError) throw uploadError;

            const { data: urlData } = supabase.storage.from("match_photos").getPublicUrl(fileName);

            const { data, error: dbError } = await supabase
                .from("match_photos")
                .insert({ match_id: matchId, user_id: currentUserId, photo_url: urlData.publicUrl })
                .select(CONSULTA)
                .single();
            if (dbError) throw dbError;

            setPhotos((prev) => [data as unknown as Photo, ...prev]);
            setTotal((n) => n + 1);
            toast("Foto subida", "success");
        } catch {
            toast("Error al subir la foto", "error");
        } finally {
            setUploading(false);
        }
    }

    const { columnas, destacada } = rejilla(carga === "lista" ? photos.length : POR_PAGINA);

    return (
        <section aria-label="Fotos del partido" className={A_SANGRE}>
            <div className="flex items-baseline justify-between gap-4 px-4 pb-3 pt-4">
                <h2 className="t-seccion">Fotos</h2>
                {carga === "lista" && total > 0 && (
                    <p className="t-meta text-muted tabular-nums">{plural(total, "foto")}</p>
                )}
            </div>

            {carga === "error" ? (
                <div className="flex items-center gap-3 px-4 py-6">
                    <TriangleAlert size={18} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-tarjeta" />
                    <p className="min-w-0 flex-1">No se han podido leer las fotos.</p>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            setCarga("cargando");
                            setIntento((n) => n + 1);
                        }}
                    >
                        Reintentar
                    </Button>
                </div>
            ) : carga === "lista" && photos.length === 0 ? (
                <PanenkaDice size={72} className="px-4 py-6">
                    {fraseVacio("fotos", matchId)}
                </PanenkaDice>
            ) : (
                <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${columnas}, minmax(0, 1fr))` }}>
                    {carga === "cargando"
                        ? Array.from({ length: 6 }, (_, i) => (
                              <div
                                  key={i}
                                  aria-hidden="true"
                                  className={`skeleton aspect-square ${i === 0 ? "col-span-2 row-span-2" : ""}`}
                              />
                          ))
                        : photos.map((photo, i) => (
                              <button
                                  key={photo.id}
                                  type="button"
                                  onClick={() => setAbierta(i)}
                                  aria-label={`Abrir la foto de ${autorDe(photo)}`}
                                  className={`pulsable relative block overflow-hidden bg-surface ${
                                      photos.length === 1 ? "aspect-[4/3]" : "aspect-square"
                                  } ${destacada && i === 0 ? "col-span-2 row-span-2" : ""}`}
                              >
                                  <Image
                                      src={photo.photo_url}
                                      alt="Foto del partido"
                                      fill
                                      unoptimized={sinOptimizar(photo.photo_url)}
                                      className="object-cover"
                                      sizes={destacada && i === 0 ? "(max-width: 640px) 67vw, 430px" : "(max-width: 640px) 33vw, 215px"}
                                  />
                              </button>
                          ))}
                </div>
            )}

            {carga === "lista" && photos.length < total && (
                <div className="px-4 pt-2">
                    <Button
                        type="button"
                        variant="ghost"
                        size="md"
                        className="w-full"
                        loading={cargandoMas}
                        onClick={cargarMas}
                    >
                        Ver más fotos
                    </Button>
                </div>
            )}

            <div className="sticky bottom-[var(--barra-inferior)] z-10 mt-2 bg-background px-4 py-2">
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleUpload}
                    className="hidden"
                />
                <Button
                    type="button"
                    size="lg"
                    className="w-full"
                    loading={uploading}
                    onClick={() => fileInputRef.current?.click()}
                >
                    {!uploading && <Plus size={18} strokeWidth={1.75} aria-hidden="true" />}
                    {uploading ? "Subiendo…" : "Subir foto"}
                </Button>
            </div>
            <p className="t-meta px-4 pb-4 text-muted">
                Sube solo fotos sobre las que tengas derechos y con permiso de quienes aparecen.
            </p>

            {abierta !== null && (
                <Visor
                    fotos={photos}
                    total={total}
                    inicial={abierta}
                    onCerrar={() => setAbierta(null)}
                    onFinal={cargarMas}
                />
            )}
        </section>
    );
}

function Visor({
    fotos,
    total,
    inicial,
    onCerrar,
    onFinal,
}: {
    fotos: Photo[];
    total: number;
    inicial: number;
    onCerrar: () => void;
    onFinal: () => void;
}) {
    const dialogoRef = useRef<HTMLDialogElement>(null);
    const pistaRef = useRef<HTMLDivElement>(null);
    const [actual, setActual] = useState(inicial);
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const foto = fotos[actual] ?? fotos[fotos.length - 1];

    // <dialog> nativo: atrapa el foco, cierra con Escape y lo devuelve a la foto al cerrar
    useLayoutEffect(() => {
        const dialogo = dialogoRef.current;
        const pista = pistaRef.current;
        if (!dialogo || !pista) return;
        dialogo.showModal();
        pista.scrollLeft = inicial * pista.clientWidth;

        const { style } = document.documentElement;
        const desbordeAnterior = style.overflow;
        style.overflow = "hidden";
        return () => {
            style.overflow = desbordeAnterior;
        };
    }, [inicial]);

    // Antes de llegar a la última ya se ha pedido la siguiente tanda
    useEffect(() => {
        if (actual >= fotos.length - 2 && fotos.length < total) onFinal();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [actual, fotos.length, total]);

    function irA(indice: number) {
        const pista = pistaRef.current;
        if (!pista || indice < 0 || indice >= fotos.length) return;
        const reducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        pista.scrollTo({ left: indice * pista.clientWidth, behavior: reducido ? "auto" : "smooth" });
    }

    function cerrar() {
        dialogoRef.current?.close();
    }

    return (
        <dialog
            ref={dialogoRef}
            aria-label="Foto del partido"
            onClose={onCerrar}
            onKeyDown={(e) => {
                if (e.key === "ArrowRight") irA(actual + 1);
                if (e.key === "ArrowLeft") irA(actual - 1);
            }}
            className="m-0 h-dvh max-h-none w-full max-w-none bg-background p-0 text-foreground transition-opacity duration-150 ease-out backdrop:bg-background starting:open:opacity-0"
        >
            <div className="flex h-full flex-col">
                <div className="flex flex-none items-center gap-3 pl-4 pr-1.5 pt-[env(safe-area-inset-top,0px)]">
                    <div className="flex min-h-14 min-w-0 flex-1 items-center gap-2.5">
                        <Avatar
                            src={getAvatarUrl(supabaseUrl, foto.profiles?.avatar_url ?? null)}
                            fallback={autorDe(foto)}
                            size="sm"
                        />
                        <div className="min-w-0">
                            <p className="t-meta truncate font-bold">{autorDe(foto)}</p>
                            <time dateTime={foto.created_at} className="t-meta block truncate text-muted tabular-nums">
                                {fechaCorta(foto.created_at)}
                            </time>
                        </div>
                    </div>
                    <button
                        type="button"
                        aria-label="Cerrar foto"
                        onClick={cerrar}
                        className="pulsable flex h-11 w-11 flex-none items-center justify-center active:bg-surface"
                    >
                        <X size={18} strokeWidth={1.75} aria-hidden="true" />
                    </button>
                </div>

                {/* Deslizar es el scroll del navegador: su física, su zoom con dos dedos */}
                <div
                    ref={pistaRef}
                    onScroll={(e) => {
                        const pista = e.currentTarget;
                        if (pista.clientWidth > 0) setActual(Math.round(pista.scrollLeft / pista.clientWidth));
                    }}
                    className="flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none]"
                >
                    {fotos.map((slide, i) => (
                        <div
                            key={slide.id}
                            onClick={(e) => {
                                if (e.target === e.currentTarget) cerrar();
                            }}
                            className="flex h-full w-full flex-none snap-center snap-always items-center justify-center"
                        >
                            {Math.abs(i - actual) <= 1 && (
                                <Image
                                    src={slide.photo_url}
                                    alt={`Foto de ${autorDe(slide)}`}
                                    width={1280}
                                    height={960}
                                    unoptimized={sinOptimizar(slide.photo_url)}
                                    sizes="(max-width: 640px) 100vw, 1280px"
                                    className="h-auto max-h-full w-auto max-w-full object-contain"
                                />
                            )}
                        </div>
                    ))}
                </div>

                <div className="flex flex-none items-center justify-between px-1.5 pb-[env(safe-area-inset-bottom,0px)]">
                    <button
                        type="button"
                        aria-label="Foto anterior"
                        disabled={actual <= 0}
                        onClick={() => irA(actual - 1)}
                        className="pulsable flex h-14 w-14 items-center justify-center active:bg-surface disabled:opacity-30"
                    >
                        <ChevronLeft size={18} strokeWidth={1.75} aria-hidden="true" />
                    </button>
                    <p aria-live="polite" className="t-cifra text-[22px]">
                        {actual + 1} de {total}
                    </p>
                    <button
                        type="button"
                        aria-label="Foto siguiente"
                        disabled={actual >= fotos.length - 1}
                        onClick={() => irA(actual + 1)}
                        className="pulsable flex h-14 w-14 items-center justify-center active:bg-surface disabled:opacity-30"
                    >
                        <ChevronRight size={18} strokeWidth={1.75} aria-hidden="true" />
                    </button>
                </div>
            </div>
        </dialog>
    );
}
