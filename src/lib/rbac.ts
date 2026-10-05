// RBAC utility functions for authorization
import { Role } from '@prisma/client';
import { Permission, PERMISSIONS, ROLE_PERMISSIONS } from './permissions';
import { prisma } from './prisma';

// ============================================
// PERMISSION CHECKING
// ============================================

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: Role, permission: Permission): boolean {
    const rolePermissions = ROLE_PERMISSIONS[role] || [];
    return rolePermissions.includes(permission);
}

/**
 * Check if a role has ALL of the specified permissions
 */
export function hasAllPermissions(role: Role, permissions: Permission[]): boolean {
    return permissions.every((permission) => hasPermission(role, permission));
}

/**
 * Check if a role has ANY of the specified permissions
 */
export function hasAnyPermission(role: Role, permissions: Permission[]): boolean {
    return permissions.some((permission) => hasPermission(role, permission));
}

/**
 * Get all permissions for a role
 */
export function getPermissionsForRole(role: Role): Permission[] {
    return ROLE_PERMISSIONS[role] || [];
}

// ============================================
// RESOURCE-BASED AUTHORIZATION
// ============================================

type ResourceAction = 'view' | 'create' | 'edit' | 'delete';

const RESOURCE_PERMISSION_MAP: Record<string, Record<ResourceAction, Permission>> = {
    drone: {
        view: PERMISSIONS.DRONE_VIEW,
        create: PERMISSIONS.DRONE_CREATE,
        edit: PERMISSIONS.DRONE_EDIT,
        delete: PERMISSIONS.DRONE_DELETE,
    },
    order: {
        view: PERMISSIONS.ORDER_VIEW,
        create: PERMISSIONS.ORDER_CREATE,
        edit: PERMISSIONS.ORDER_EDIT,
        delete: PERMISSIONS.ORDER_DELETE,
    },
    team: {
        view: PERMISSIONS.TEAM_VIEW,
        create: PERMISSIONS.TEAM_CREATE,
        edit: PERMISSIONS.TEAM_EDIT,
        delete: PERMISSIONS.TEAM_DELETE,
    },
    subcontractor: {
        view: PERMISSIONS.SUBCONTRACTOR_VIEW,
        create: PERMISSIONS.SUBCONTRACTOR_CREATE,
        edit: PERMISSIONS.SUBCONTRACTOR_EDIT,
        delete: PERMISSIONS.SUBCONTRACTOR_DELETE,
    },
    battery: {
        view: PERMISSIONS.BATTERY_VIEW,
        create: PERMISSIONS.BATTERY_CREATE,
        edit: PERMISSIONS.BATTERY_EDIT,
        delete: PERMISSIONS.BATTERY_DELETE,
    },
    inventory: {
        view: PERMISSIONS.INVENTORY_VIEW,
        create: PERMISSIONS.INVENTORY_MANAGE,
        edit: PERMISSIONS.INVENTORY_IN,
        delete: PERMISSIONS.INVENTORY_OUT,
    },
    component: {
        view: PERMISSIONS.INVENTORY_VIEW,
        create: PERMISSIONS.INVENTORY_MANAGE,
        edit: PERMISSIONS.INVENTORY_MANAGE,
        delete: PERMISSIONS.INVENTORY_MANAGE,
    },
    expense: {
        view: PERMISSIONS.EXPENSE_VIEW,
        create: PERMISSIONS.EXPENSE_CREATE,
        edit: PERMISSIONS.EXPENSE_EDIT,
        delete: PERMISSIONS.EXPENSE_DELETE,
    },
    lead: {
        view: PERMISSIONS.LEAD_VIEW,
        create: PERMISSIONS.LEAD_CREATE,
        edit: PERMISSIONS.LEAD_EDIT,
        delete: PERMISSIONS.LEAD_DELETE,
    },
    crm: {
        view: PERMISSIONS.LEAD_VIEW,
        create: PERMISSIONS.LEAD_CREATE,
        edit: PERMISSIONS.LEAD_EDIT,
        delete: PERMISSIONS.LEAD_DELETE,
    },
};

/**
 * Check if a role can perform an action on a resource
 */
export function canAccess(role: Role, resource: string, action: ResourceAction): boolean {
    const resourcePermissions = RESOURCE_PERMISSION_MAP[resource.toLowerCase()];
    if (!resourcePermissions) {
        return false;
    }
    const permission = resourcePermissions[action];
    return permission ? hasPermission(role, permission) : false;
}

// ============================================
// AUDIT LOGGING
// ============================================

interface AuditLogData {
    userId: string;
    action: string;
    resource: string;
    resourceId?: string;
    details?: Record<string, unknown>;
    ipAddress?: string;
}

/**
 * Create an audit log entry
 */
export async function createAuditLog(data: AuditLogData): Promise<void> {
    try {
        await prisma.auditLog.create({
            data: {
                userId: data.userId,
                action: data.action,
                resource: data.resource,
                resourceId: data.resourceId,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                details: data.details ? (data.details as any) : null,
                ipAddress: data.ipAddress,
            },
        });
    } catch (error) {
        console.error('Failed to create audit log:', error);
        // Don't throw - audit logging should not break the main flow
    }
}

// ============================================
// ROLE UTILITIES
// ============================================

// Complete display name mapping for all roles in the system
const ROLE_DISPLAY_NAMES: Record<Role, string> = {
    SUPER_ADMIN: 'Super Admin',
    ADMIN: 'Admin',
    OPERATIONS_MANAGER: 'Operations Manager',
    QA_MANAGER: 'QA Manager',
    PILOT: 'Pilot',
    TECHNICIAN: 'Technician',
    VIEWER: 'Viewer',
    MANUFACTURING: 'Manufacturing',
    DESIGN: 'Design',
    SALES: 'Sales',
    SOFTWARE: 'Software',
    ADMINISTRATION: 'Administration',
};

/**
 * Get human-readable role name
 */
export function getRoleDisplayName(role: Role): string {
    return ROLE_DISPLAY_NAMES[role] || role;
}

// Complete role hierarchy levels
const ROLE_LEVELS: Record<Role, number> = {
    SUPER_ADMIN: 150,
    ADMIN: 100,
    ADMINISTRATION: 100,
    OPERATIONS_MANAGER: 75,
    QA_MANAGER: 75,
    MANUFACTURING: 50,
    DESIGN: 50,
    SALES: 50,
    SOFTWARE: 50,
    PILOT: 40,
    TECHNICIAN: 40,
    VIEWER: 10,
};

/**
 * Get role hierarchy level (higher = more permissions)
 */
export function getRoleLevel(role: Role): number {
    return ROLE_LEVELS[role] || 0;
}

/**
 * Check if roleA is higher or equal to roleB in hierarchy
 */
export function isRoleHigherOrEqual(roleA: Role, roleB: Role): boolean {
    return getRoleLevel(roleA) >= getRoleLevel(roleB);
}
