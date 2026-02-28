import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { SearchX } from "lucide-react";

export default function NotFound() {
    return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-accent/10">
                <SearchX size={40} className="text-accent" />
            </div>
            <h1 className="mb-2 text-4xl font-bold text-foreground">404</h1>
            <p className="mb-6 max-w-md text-center text-muted">
                La página que buscas no existe o ha sido movida.
            </p>
            <Link href="/">
                <Button size="lg">
                    Volver al Dashboard
                </Button>
            </Link>
        </div>
    );
}
