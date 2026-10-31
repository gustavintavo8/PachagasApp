"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/Button";

export function Reintentar() {
    const router = useRouter();
    const [pending, startTransition] = useTransition();

    return (
        <Button
            type="button"
            variant="ghost"
            size="sm"
            loading={pending}
            className="-ml-3 mt-1 font-bold"
            onClick={() => startTransition(() => router.refresh())}
        >
            Reintentar
        </Button>
    );
}
