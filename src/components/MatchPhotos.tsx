"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { getAvatarUrl, timeAgo } from "@/lib/utils";
import { Camera, Plus, X, ImageIcon, Loader2 } from "lucide-react";
import Image from "next/image";
import imageCompression from "browser-image-compression";

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
    isGuest?: boolean;
}

export function MatchPhotos({ matchId, currentUserId, isGuest = false }: MatchPhotosProps) {
    const [photos, setPhotos] = useState<Photo[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const supabase = createClient();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const { toast } = useToast();

    // Fetch photos
    useEffect(() => {
        async function fetchPhotos() {
            const { data } = await supabase
                .from("match_photos")
                .select("*, profiles(username, avatar_url)")
                .eq("match_id", matchId)
                .order("created_at", { ascending: false })
                .limit(12);
            setPhotos((data as unknown as Photo[]) || []);
            setLoading(false);
        }
        fetchPhotos();
    }, [matchId]);

    async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file
        if (!file.type.startsWith("image/")) {
            toast("Solo se permiten imágenes", "error");
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            toast("La imagen no puede superar 5MB", "error");
            return;
        }

        setUploading(true);

        const options = { maxSizeMB: 0.5, maxWidthOrHeight: 1280, useWebWorker: true };
        const compressedFile = await imageCompression(file, options);

        const ext = compressedFile.name.split(".").pop() || "jpg";
        const fileName = `${matchId}/${currentUserId}-${Date.now()}.${ext}`;

        let publicUrl: string;
        let photoRow: unknown;
        try {
            const { error: uploadError } = await supabase.storage
                .from("match_photos")
                .upload(fileName, compressedFile, { upsert: false });

            if (uploadError) throw uploadError;

            const { data: urlData } = supabase.storage
                .from("match_photos")
                .getPublicUrl(fileName);

            publicUrl = urlData.publicUrl;

            const { data, error: dbError } = await supabase
                .from("match_photos")
                .insert({
                    match_id: matchId,
                    user_id: currentUserId,
                    photo_url: publicUrl,
                })
                .select("*, profiles(username, avatar_url)")
                .single();

            if (dbError) throw dbError;
            photoRow = data;
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Error al subir la foto";
            toast(message, "error");
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
            return;
        }

        setPhotos((prev) => [photoRow as Photo, ...prev]);
        toast("¡Foto subida!", "success");
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
    }

    return (
        <div className="rounded-2xl border border-border bg-surface">
            {/* Header */}
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                <Camera size={18} className="text-accent" />
                <h3 className="text-sm font-semibold text-foreground">
                    Fotos del Partido
                </h3>
                <span className="ml-auto text-xs text-muted">
                    {photos.length} foto{photos.length !== 1 ? "s" : ""}
                </span>
            </div>

            {/* Upload Button */}
            {!isGuest && (
                <div className="border-b border-border px-4 py-3">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleUpload}
                        className="hidden"
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-4 text-sm font-medium text-muted transition-all hover:border-accent hover:bg-accent/5 hover:text-accent disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {uploading ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                Subiendo...
                            </>
                        ) : (
                            <>
                                <Plus size={18} />
                                Subir Foto
                            </>
                        )}
                    </button>
                </div>
            )}

            {/* Photos Grid */}
            <div className="p-4">
                {loading ? (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {Array.from({ length: 3 }, (_, i) => (
                            <div key={`photo-skeleton-${i}`} className="skeleton aspect-square rounded-xl" />
                        ))}
                    </div>
                ) : photos.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                        <ImageIcon size={32} className="mb-2 text-muted/30" />
                        <p className="text-sm text-muted">
                            Aún no hay fotos. ¡Sube la primera!
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {photos.map((photo) => {
                            const avatarUrl = getAvatarUrl(
                                supabaseUrl,
                                photo.profiles?.avatar_url ?? null
                            );

                            return (
                                <div
                                    key={photo.id}
                                    role="button"
                                    tabIndex={0}
                                    className="group relative cursor-pointer overflow-hidden rounded-xl border border-border bg-zinc-800 transition-all hover:border-accent/50 hover:shadow-lg hover:shadow-accent/5"
                                    onClick={() => setLightboxUrl(photo.photo_url)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" || e.key === " ") {
                                            e.preventDefault();
                                            setLightboxUrl(photo.photo_url);
                                        }
                                    }}
                                >
                                    <div className="aspect-square relative">
                                        <Image
                                            src={photo.photo_url}
                                            alt="Foto del partido"
                                            fill
                                            className="object-cover transition-transform duration-300 group-hover:scale-105"
                                            sizes="(max-width: 640px) 50vw, 33vw"
                                        />
                                    </div>
                                    {/* Overlay */}
                                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2.5 pb-2 pt-8 opacity-0 transition-opacity group-hover:opacity-100">
                                        <div className="flex items-center gap-1.5">
                                            <Avatar
                                                src={avatarUrl}
                                                fallback={photo.profiles?.username || "?"}
                                                size="sm"
                                            />
                                            <div className="min-w-0">
                                                <p className="truncate text-xs font-medium text-white">
                                                    {photo.profiles?.username || "Anónimo"}
                                                </p>
                                                <p className="text-[10px] text-zinc-400">
                                                    {timeAgo(photo.created_at)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Lightbox */}
            {
                lightboxUrl && (
                    <div
                        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
                        role="button"
                        tabIndex={0}
                        onClick={() => setLightboxUrl(null)}
                        onKeyDown={(e) => {
                            if (e.key === "Escape" || e.key === "Enter") {
                                setLightboxUrl(null);
                            }
                        }}
                    >
                        <button
                            onClick={() => setLightboxUrl(null)}
                            className="absolute right-4 top-4 rounded-full bg-zinc-800/80 p-2 text-white transition-colors hover:bg-zinc-700"
                        >
                            <X size={24} />
                        </button>
                        <Image
                            src={lightboxUrl!}
                            alt="Tamaño completo"
                            width={1200}
                            height={900}
                            className="max-h-[90vh] max-w-full rounded-xl object-contain"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                )
            }
        </div >
    );
}
