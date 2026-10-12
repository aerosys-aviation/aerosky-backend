import { withAuth, NextRequestWithAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import type { NextRequest, NextFetchEvent } from "next/server";

// CORS allowed origins by default
const DEFAULT_ALLOWED_ORIGINS = {
    development: [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:8081',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:8081',
    ],
    production: [
        'https://app.aerosysaviation.in',
        'https://mobile.aerosysaviation.in',
        'https://dashboard.aerosysaviation.in',
    ],
};

// Paths that bypass NextAuth session checks (extracted to avoid duplication)
const PUBLIC_PATHS = [
    "/api/mobile",
    "/api/auth",
    "/unauthorized",
    "/login",
    "/register",
    "/forgot-password"
];

function isPublicPath(pathname: string): boolean {
    return PUBLIC_PATHS.some(path =>
        pathname === path || pathname.startsWith(`${path}/`)
    );
}

function isOriginAllowed(origin: string | null): boolean {
    if (!origin) return false;

    const isDev = process.env.NODE_ENV !== 'production';
    if (isDev) {
        if (
            origin.startsWith('http://localhost') ||
            origin.startsWith('http://127.0.0.1') ||
            origin.startsWith('http://192.168.') ||
            origin.startsWith('http://10.')
        ) {
            return true;
        }
    }

    const customOrigins = (process.env.ALLOWED_ORIGINS || '')
        .split(',')
        .map(o => o.trim())
        .filter(Boolean);

    const allowed = new Set([
        ...DEFAULT_ALLOWED_ORIGINS.production,
        ...DEFAULT_ALLOWED_ORIGINS.development,
        ...customOrigins,
    ]);

    if (process.env.NEXTAUTH_URL) {
        try {
            allowed.add(new URL(process.env.NEXTAUTH_URL).origin);
        } catch {
            // Ignore invalid URL
        }
    }

    return allowed.has(origin);
}

// 1. Wrap NextAuth logic
const authMiddleware = withAuth(
    function middleware(req: NextRequestWithAuth) {
        if (isPublicPath(req.nextUrl.pathname)) {
            return NextResponse.next();
        }
        return NextResponse.next();
    },
    {
        callbacks: {
            authorized: ({ token, req }: { token: any; req: NextRequest }) => {
                if (isPublicPath(req.nextUrl.pathname)) return true;
                return !!token;
            },
        },
    }
);

// 2. Export top-level middleware handling CORS and auth
export default async function middleware(req: NextRequest, event: NextFetchEvent) {
    const origin = req.headers.get("origin");

    // Handle preflight OPTIONS requests centrally
    if (req.method === "OPTIONS") {
        const response = new NextResponse(null, { status: 204 });
        if (origin && isOriginAllowed(origin)) {
            response.headers.set("Access-Control-Allow-Origin", origin);
            response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
            response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
            response.headers.set("Access-Control-Allow-Credentials", "true");
            response.headers.set("Access-Control-Max-Age", "86400");
        }
        return response;
    }

    // Delegate to NextAuth middleware
    const res = await (authMiddleware as any)(req, event);

    // Inject CORS headers for validated origins
    if (res && origin && isOriginAllowed(origin)) {
        res.headers.set("Access-Control-Allow-Origin", origin);
        res.headers.set("Access-Control-Allow-Credentials", "true");
        res.headers.set("Vary", "Origin");
    }

    return res;
}

export const config = {
    matcher: ["/dashboard/:path*", "/api/:path*", "/login", "/register", "/unauthorized"],
};
