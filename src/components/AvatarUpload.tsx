"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { updateAvatar } from "@/app/profile/actions";
import { Avatar } from "@/components/ui/Avatar";
import { Camera } from "lucide-react";
import imageCompression from "browser-image-compression";

interface AvatarUploadProps {
    uid: string;
    url: string | null;
    fallback: string;
    onUpload?: (url: string) => void;
}

export function AvatarUpload({ uid, url, fallback, onUpload }: AvatarUploadProps) {
    const [uploading, setUploading] = useState(false);
    const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
    const avatarUrl = uploadedUrl ?? url;
    const fileInputRef = useRef<HTMLInputElement>(null);

    async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        if (!file) return;

        setUploading(true);

        const options = { maxSizeMB: 0.1, maxWidthOrHeight: 400, useWebWorker: true };
        const compressedFile = await imageCompression(file, options);

        const supabase = createClient();
        const fileExt = compressedFile.name.split(".").pop();
        const filePath = `${uid}/${Date.now()}.${fileExt}`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
            .from("avatars")
            .upload(filePath, compressedFile, { upsert: true });

        if (uploadError) {
            console.error("Upload error:", uploadError);
            setUploading(false);
            return;
        }

        // Get public URL
        const { data } = supabase.storage
            .from("avatars")
            .getPublicUrl(filePath);

        setUploadedUrl(data.publicUrl);

        // Update profile
        await updateAvatar(filePath);

        onUpload?.(filePath);
        setUploading(false);
    }

    return (
        <div className="flex flex-col items-center gap-3">
            <div
                role="button"
                tabIndex={0}
                className="group relative cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        fileInputRef.current?.click();
                    }
                }}
            >
                <Avatar src={avatarUrl} fallback={fallback} size="xl" />
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                    <Camera size={24} className="text-white" />
                </div>
                {uploading && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60">
                        <svg className="h-6 w-6 animate-spin text-accent" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                    </div>
                )}
            </div>
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleUpload}
                className="hidden"
            />
            <span className="text-xs text-muted">Pulsa para cambiar avatar</span>
        </div>
    );
}
