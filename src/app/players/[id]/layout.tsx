import type { ReactNode } from "react";
import { Detalle } from "@/components/Detalle";

export default function Layout({ children }: { children: ReactNode }) {
    return <Detalle>{children}</Detalle>;
}
