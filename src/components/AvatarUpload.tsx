"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { updateAvatar } from "@/app/profile/actions";
import { AvisoError } from "@/components/AvisoError";
import { Avatar } from "@/components/ui/Avatar";
import { Camera } from "lucide-react";
import imageCompression from "browser-image-compression";

interface AvatarUploadProps {
    uid: string;
    url: string | null;
    fallback: string;
    onUpload?: (url: string) => void;
}

const ERROR_SUBIDA = "No se pudo subir la foto. Inténtalo de nuevo.";

export function AvatarUpload({ uid, url, fallback, onUpload }: AvatarUploadProps) {
    const [uploading, setUploading] = useState(false);
    const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const avatarUrl = uploadedUrl ?? url;
    const fileInputRef = useRef<HTMLInputElement>(null);

    async function subir(file: File) {
        const options = { maxSizeMB: 0.1, maxWidthOrHeight: 400, useWebWorker: true };
        const compressedFile = await imageCompression(file, options);

        const supabase = createClient();
        const fileExt = compressedFile.name.split(".").pop();
        if (!fileExt) {
            setError(ERROR_SUBIDA);
            return;
        }
        const filePath = `${uid}/${Date.now()}.${fileExt}`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
            .from("avatars")
            .upload(filePath, compressedFile, { upsert: true });

        if (uploadError) {
            setError(ERROR_SUBIDA);
            return;
        }

        // Get public URL
        const { data } = supabase.storage
            .from("avatars")
            .getPublicUrl(filePath);

        const anterior = uploadedUrl;
        setUploadedUrl(data.publicUrl);

        // Update profile
        const result = await updateAvatar(filePath);
        if (!result.success) {
            setUploadedUrl(anterior);
            setError(result.error);
            return;
        }

        onUpload?.(filePath);
    }

    async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        // Sin esto, volver a elegir la misma foto no dispara nada
        event.target.value = "";
        if (!file) return;

        setUploading(true);
        setError(null);

        try {
            await subir(file);
        } catch {
            setError(ERROR_SUBIDA);
        } finally {
            setUploading(false);
        }
    }

    return (
        <div className="w-[min(176px,45vw)] shrink-0">
            <button
                type="button"
                aria-label={`Cambiar foto de ${fallback}`}
                aria-busy={uploading || undefined}
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="pulsable block w-full text-left"
            >
                <span className="relative block">
                    <Avatar
                        src={avatarUrl}
                        fallback={fallback}
                        priority
                        className="h-[min(176px,45vw)] w-[min(176px,45vw)] text-[min(136px,34vw)]"
                    />
                    {uploading && (
                        <span className="absolute inset-0 flex items-center justify-center bg-background/70 font-display text-[23px] font-semibold">
                            Subiendo
                        </span>
                    )}
                </span>
                <span className="t-meta flex min-h-11 items-center gap-1.5 text-muted">
                    <Camera size={18} strokeWidth={1.75} aria-hidden="true" />
                    Cambiar foto
                </span>
            </button>
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleUpload}
                className="hidden"
                tabIndex={-1}
                aria-hidden="true"
            />
            {error && <AvisoError className="t-meta">{error}</AvisoError>}
        </div>
    );
}
