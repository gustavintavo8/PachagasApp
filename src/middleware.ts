import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function redirectTo(request: NextRequest, pathname: string) {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    return NextResponse.redirect(url);
}

export async function middleware(request: NextRequest) {
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

    const pathname = request.nextUrl.pathname;
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
        return redirectTo(request, "/login");
    }

    if (user?.is_anonymous === true && !isPublicRoute && !isApiRoute) {
        return redirectTo(request, "/login");
    }

    const shouldCheckAccess = Boolean(
        user &&
        user.is_anonymous !== true &&
        (!isPublicRoute || pathname === "/access")
    );

    if (shouldCheckAccess && user) {
        const [{ data: grant }, { data: profile }] = await Promise.all([
            supabase
                .from("community_access_grants")
                .select("user_id")
                .eq("user_id", user.id)
                .is("revoked_at", null)
                .maybeSingle(),
            supabase
                .from("profiles")
                .select("is_admin")
                .eq("id", user.id)
                .maybeSingle(),
        ]);
        const allowed = Boolean(grant || profile?.is_admin === true);

        if (pathname === "/access" && allowed) {
            return redirectTo(request, "/");
        }

        if (!isPublicRoute && !allowed && !isApiRoute) {
            return redirectTo(request, "/access");
        }
    }

    // If user is authenticated and trying to access the login page
    if (user && user.is_anonymous !== true && isGuestOnlyRoute) {
        return redirectTo(request, "/");
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
         * - public folder
         */
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ],
};
