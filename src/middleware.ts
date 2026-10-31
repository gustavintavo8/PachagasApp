import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { conDestino, rutaInterna } from "@/lib/destino";

function redirectTo(request: NextRequest, ruta: string) {
    const url = request.nextUrl.clone();
    const corte = ruta.indexOf("?");
    url.pathname = corte === -1 ? ruta : ruta.slice(0, corte);
    url.search = corte === -1 ? "" : ruta.slice(corte);

    return NextResponse.redirect(url);
}

/** Adonde iba quien se ha topado con la puerta. Lo interno de Next y el código de OAuth no cuentan. */
function destinoDe(request: NextRequest) {
    const parametros = new URLSearchParams(request.nextUrl.search);
    parametros.delete("_rsc");
    parametros.delete("code");
    const consulta = parametros.toString();
    return rutaInterna(`${request.nextUrl.pathname}${consulta ? `?${consulta}` : ""}`);
}

export async function middleware(request: NextRequest) {
    const pathname = request.nextUrl.pathname;
    const isFantasyRoute = pathname === "/fantasy" || pathname.startsWith("/fantasy/");

    // Fantasy is paused for now. Keep the UI, server actions, and direct URLs
    // unavailable while preserving the underlying data for a future reactivation.
    if (isFantasyRoute) {
        return new NextResponse("Not Found", { status: 404 });
    }

    let supabaseResponse = NextResponse.next({
        request,
    });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    );
                    supabaseResponse = NextResponse.next({
                        request,
                    });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    // Refresh the session
    const {
        data: { user },
    } = await supabase.auth.getUser();

    const isApiRoute = pathname.startsWith("/api/");

    // Routes accessible without authentication, for both guests and logged-in users
    // (legal/transparency pages must stay reachable from anywhere, e.g. before signup).
    const publicRoutes = ["/login", "/auth/callback", "/privacidad", "/aviso-legal", "/terminos", "/access"];
    const isPublicRoute = publicRoutes.includes(pathname);

    // Of those, only the login page should redirect an already-authenticated user away.
    const guestOnlyRoutes = ["/login"];
    const isGuestOnlyRoute = guestOnlyRoutes.includes(pathname);

    // If user is not authenticated and trying to access a protected route
    if (!user && !isPublicRoute && !isApiRoute) {
        return redirectTo(request, conDestino("/login", destinoDe(request)));
    }

    if (user?.is_anonymous === true && !isPublicRoute && !isApiRoute) {
        return redirectTo(request, conDestino("/login", destinoDe(request)));
    }

    const shouldCheckAccess = Boolean(
        user &&
        user.is_anonymous !== true &&
        (!isPublicRoute || pathname === "/access")
    );

    if (shouldCheckAccess && user) {
        const { data: allowed, error: accessError } = await supabase.rpc(
            "current_user_has_community_access"
        );
        const hasAccess = accessError ? false : allowed === true;

        if (pathname === "/access" && hasAccess) {
            return redirectTo(request, rutaInterna(request.nextUrl.searchParams.get("next")) ?? "/");
        }

        if (!isPublicRoute && !hasAccess && !isApiRoute) {
            return redirectTo(request, conDestino("/access", destinoDe(request)));
        }
    }

    // If user is authenticated and trying to access the login page
    if (user && user.is_anonymous !== true && isGuestOnlyRoute) {
        return redirectTo(request, rutaInterna(request.nextUrl.searchParams.get("next")) ?? "/");
    }

    return supabaseResponse;
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public folder (imágenes, manifest.json y sw.js: se piden sin sesión)
         */
        "/((?!_next/static|_next/image|favicon.ico|sw\\.js$|.*\\.(?:svg|png|jpg|jpeg|gif|webp|json)$).*)",
    ],
};
