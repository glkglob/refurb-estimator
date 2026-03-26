import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

// Routes with progressive disclosure are intentionally not hard-redirected to auth.
const PROTECTED_ROUTES: string[] = [];
const PUBLIC_ROUTES = [
  "/",
  "/rooms",
  "/photo",
  "/auth/login",
  "/auth/signup",
  "/auth/onboarding"
];
const ONBOARDING_ALLOWED_ROUTES = ["/auth/onboarding", "/auth/login", "/auth/signup", "/auth/forgot-password"];

function matchesRoute(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}

export async function updateSession(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let response = NextResponse.next({ request });

  // Keep the app functional in localStorage-only mode when Supabase env vars are absent.
  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      }
    }
  });

  const pathname = request.nextUrl.pathname;
  const isProtectedRoute = PROTECTED_ROUTES.some((route) => matchesRoute(pathname, route));
  const isPublicRoute = PUBLIC_ROUTES.some((route) => matchesRoute(pathname, route));

  if (!isProtectedRoute && !isPublicRoute) {
    return response;
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user && isProtectedRoute) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/auth/login";
    loginUrl.searchParams.set("redirectedFrom", pathname);
    return NextResponse.redirect(loginUrl);
  }

  let isTradesperson = false;
  let isOnboardingComplete = true;

  if (user) {
    const { data: profileData } = await supabase
      .from("profiles")
      .select("role, onboarding_complete")
      .eq("id", user.id)
      .maybeSingle();

    isTradesperson = profileData?.role === "tradesperson";
    isOnboardingComplete = profileData?.onboarding_complete === true;

    if (isTradesperson && !isOnboardingComplete) {
      const canAccessWithoutOnboarding = ONBOARDING_ALLOWED_ROUTES.some((route) =>
        matchesRoute(pathname, route)
      );

      if (!canAccessWithoutOnboarding) {
        const onboardingUrl = request.nextUrl.clone();
        onboardingUrl.pathname = "/auth/onboarding";
        onboardingUrl.searchParams.delete("redirectedFrom");
        return NextResponse.redirect(onboardingUrl);
      }
    }
  }

  if (user && (pathname === "/auth/login" || pathname === "/auth/signup")) {
    if (isTradesperson && !isOnboardingComplete) {
      const onboardingUrl = request.nextUrl.clone();
      onboardingUrl.pathname = "/auth/onboarding";
      onboardingUrl.searchParams.delete("redirectedFrom");
      return NextResponse.redirect(onboardingUrl);
    }

    const scenariosUrl = request.nextUrl.clone();
    scenariosUrl.pathname = "/scenarios";
    scenariosUrl.searchParams.delete("redirectedFrom");
    return NextResponse.redirect(scenariosUrl);
  }

  return response;
}
