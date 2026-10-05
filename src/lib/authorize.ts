// Authorization middleware for API routes
import { NextRequest, NextResponse } from 'next/server';
import { Permission } from './permissions';
import { canAccess, createAuditLog, hasPermission } from './rbac';
import type { AuthenticatedUser } from '@/types/auth';

// Re-export the shared type for backward compatibility
export type { AuthenticatedUser };

/**
 * Create a response for unauthorized access
 */
export function unauthorizedResponse(message = 'Unauthorized'): NextResponse {
    return NextResponse.json({ error: message }, {
        status: 401,
    });
}

/**
 * Create a response for forbidden access
 */
export function forbiddenResponse(message = 'Forbidden: Insufficient permissions'): NextResponse {
    return NextResponse.json({ error: message }, {
        status: 403,
    });
}

/**
 * Check if user has the required permission
 * Returns true if authorized, NextResponse if not
 */
export function checkPermission(
    user: AuthenticatedUser | null,
    requiredPermission: Permission
): true | NextResponse {
    if (!user) {
        return unauthorizedResponse();
    }

    if (!hasPermission(user.role, requiredPermission)) {
        return forbiddenResponse(`You don't have permission: ${requiredPermission}`);
    }

    return true;
}

/**
 * Check if user can access a resource with an action
 * Returns true if authorized, NextResponse if not
 */
export function checkResourceAccess(
    user: AuthenticatedUser | null,
    resource: string,
    action: 'view' | 'create' | 'edit' | 'delete'
): true | NextResponse {
    if (!user) {
        return unauthorizedResponse();
    }

    if (!canAccess(user.role, resource, action)) {
        return forbiddenResponse(`You don't have permission to ${action} ${resource}`);
    }

    return true;
}

/**
 * Higher-order function to wrap API handlers with permission checks
 */
export function withPermission(
    requiredPermission: Permission,
    handler: (request: NextRequest, user: AuthenticatedUser) => Promise<NextResponse>
) {
    return async (request: NextRequest, user: AuthenticatedUser | null): Promise<NextResponse> => {
        const check = checkPermission(user, requiredPermission);
        if (check !== true) {
            return check;
        }
        // After checkPermission passes, user is guaranteed to be non-null
        return handler(request, user as AuthenticatedUser);
    };
}

/**
 * Log an API action for audit purposes
 */
export async function logAction(
    user: AuthenticatedUser,
    action: string,
    resource: string,
    resourceId?: string,
    details?: Record<string, unknown>,
    request?: NextRequest
): Promise<void> {
    const ipAddress = request?.headers.get('x-forwarded-for') ||
        request?.headers.get('x-real-ip') ||
        undefined;

    await createAuditLog({
        userId: user.id,
        action,
        resource,
        resourceId,
        details,
        ipAddress: ipAddress || undefined,
    });
}
