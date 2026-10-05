import { NextRequest } from "next/server";

/**
 * Checks if the request comes from an allowed IP or subnet defined in ALLOWED_SUBNET.
 * When ALLOWED_SUBNET is not configured or set to '*', all traffic is permitted.
 */
export function isAllowedIp(req: NextRequest): boolean {
    const envSubnets = process.env.ALLOWED_SUBNET?.trim();

    // If no subnet restrictions are configured or wildcard is present, allow all connections
    if (!envSubnets || envSubnets === '*' || envSubnets.split(',').some(s => s.trim() === '*')) {
        return true;
    }

    const allowedSubnets = envSubnets.split(',').map((s) => s.trim()).filter(Boolean);

    // Get client IP from headers or connection
    const forwardedFor = req.headers.get("x-forwarded-for");
    const realIp = req.headers.get("x-real-ip");
    const clientIp = req.ip || realIp || (forwardedFor ? forwardedFor.split(',')[0].trim() : null);

    // If client IP cannot be determined in development, allow it
    if (!clientIp) {
        return process.env.NODE_ENV !== 'production';
    }

    // Allow localhost and local loopbacks
    if (
        clientIp === "::1" ||
        clientIp === "127.0.0.1" ||
        clientIp === "localhost" ||
        clientIp === "::ffff:127.0.0.1"
    ) {
        return true;
    }

    // Check if the IP starts with or matches any allowed subnet
    for (const subnet of allowedSubnets) {
        if (clientIp.startsWith(subnet) || clientIp.includes(subnet)) {
            return true;
        }
    }

    console.warn(`[NetworkGuard] Access Denied for IP: ${clientIp}. Add this to ALLOWED_SUBNET in .env to grant access.`);
    return false;
}
