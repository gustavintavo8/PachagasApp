import Link from "next/link";
import { buttonClasses } from "@/components/ui/Button";

export default function NotFound() {
    return (
        <div className="flex min-h-[60dvh] flex-col justify-center px-4 py-8">
            <p className="t-meta text-muted">404</p>
            <h1 className="t-titular mt-1">Esto está fuera de banda.</h1>
            <p className="mt-3 text-muted">
                La página que buscas no existe o ha sido movida.
            </p>
            <Link href="/" className={buttonClasses("primary", "lg", "mt-6 w-full md:w-auto md:self-start")}>
                Volver al inicio
            </Link>
        </div>
    );
}
