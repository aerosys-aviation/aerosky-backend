// Shared authentication types used across the application
import { Role } from '@prisma/client';

/**
 * Represents an authenticated user across all auth methods
 * (session, JWT, Supabase). Single source of truth — do not
 * redefine in other modules.
 */
export interface AuthenticatedUser {
    id: string;
    username: string;
    fullName?: string;
    email?: string;
    role: Role;
}

export interface AuthResult {
    user: AuthenticatedUser;
    type: 'session' | 'jwt';
}
