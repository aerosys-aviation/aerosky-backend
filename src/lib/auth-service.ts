import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { supabase } from '@/lib/supabase';
import { signToken, verifyToken as verifyTokenUtil } from '@/lib/jwt';
import type { AuthenticatedUser } from '@/types/auth';

// Re-export the shared type for backward compatibility
export type { AuthenticatedUser };

export class AuthService {
  // Authenticate with credentials via Supabase Auth (with DB bcrypt fallback)
  async authenticateWithCredentials(
    username: string,
    password: string
  ): Promise<AuthenticatedUser | null> {
    const rawUser = username.trim();
    let emailToAuth = rawUser;

    if (!rawUser.includes('@')) {
      const dbUser = await prisma.user.findFirst({
        where: {
          OR: [
            { username: { equals: rawUser, mode: 'insensitive' } },
            { email: { equals: rawUser, mode: 'insensitive' } }
          ]
        }
      });
      if (dbUser?.email) {
        emailToAuth = dbUser.email;
      }
    }

    // 1. Try Supabase Auth
    try {
      const { data: authData } = await supabase.auth.signInWithPassword({
        email: emailToAuth,
        password,
      });

      if (authData?.user) {
        let user = await prisma.user.findFirst({
          where: {
            OR: [
              { supabaseId: authData.user.id },
              { email: { equals: authData.user.email, mode: 'insensitive' } },
              { username: { equals: rawUser, mode: 'insensitive' } }
            ]
          }
        });

        if (user) {
          // Check if account is active
          if (user.isActive === false) {
            console.warn(`[Auth] Login denied: Account for ${rawUser} is deactivated.`);
            return null;
          }

          if (!user.supabaseId) {
            await prisma.user.update({
              where: { id: user.id },
              data: { supabaseId: authData.user.id }
            });
          }
        } else if (authData.user.email) {
          const teamMember = await prisma.teamMember.findFirst({
            where: { email: { equals: authData.user.email, mode: 'insensitive' } }
          });

          user = await prisma.user.create({
            data: {
              username: authData.user.email.split('@')[0] || rawUser,
              email: authData.user.email,
              fullName: authData.user.user_metadata?.full_name || authData.user.user_metadata?.name || rawUser,
              supabaseId: authData.user.id,
              role: 'VIEWER',
              teamMemberId: teamMember ? teamMember.id : undefined,
            }
          });
        }

        if (user) {
          return {
            id: user.id,
            username: user.username,
            fullName: user.fullName || undefined,
            email: user.email || undefined,
            role: user.role,
          };
        }
      }
    } catch (err) {
      console.warn('AuthService Supabase Auth error:', err);
    }

    // 2. Fallback to local DB bcrypt verification
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: { equals: rawUser, mode: 'insensitive' } },
          { email: { equals: emailToAuth, mode: 'insensitive' } },
          { email: { equals: rawUser, mode: 'insensitive' } }
        ]
      }
    });

    if (user && user.passwordHash) {
      // Check if account is active before verifying password
      if (user.isActive === false) {
        console.warn(`[Auth] Login denied: Account for ${rawUser} is deactivated.`);
        return null;
      }

      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (isValid) {
        return {
          id: user.id,
          username: user.username,
          fullName: user.fullName || undefined,
          email: user.email || undefined,
          role: user.role,
        };
      }
    }

    // Credentials failed
    return null;
  }

  // Authenticate with token (Supabase JWT, legacy JWT, or session)
  async authenticateWithToken(
    token: string,
    isJwt: boolean = false
  ): Promise<AuthenticatedUser | null> {
    if (isJwt) {
      return this.verifyJwt(token);
    } else {
      return this.verifySessionToken(token);
    }
  }

  // JWT helpers
  private async verifyJwt(token: string): Promise<AuthenticatedUser | null> {
    try {
      // 1. Try Supabase token
      const { data: sbData } = await supabase.auth.getUser(token);
      if (sbData?.user) {
        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { supabaseId: sbData.user.id },
              { email: { equals: sbData.user.email, mode: 'insensitive' } }
            ]
          }
        });
        if (user) {
          if (user.isActive === false) return null;
          return {
            id: user.id,
            username: user.username,
            fullName: user.fullName || undefined,
            email: user.email || undefined,
            role: user.role,
          };
        }
      }

      // 2. Legacy JWT
      const decoded = verifyTokenUtil(token) as { userId?: string; id?: string; username?: string; sub?: string } | null;
      if (!decoded) return null;
      
      const userId = decoded.userId || decoded.id || decoded.sub;
      let user = null;

      if (userId) {
        user = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, username: true, fullName: true, email: true, role: true, isActive: true },
        });
      }

      if (!user && decoded.username) {
        user = await prisma.user.findUnique({
          where: { username: decoded.username },
          select: { id: true, username: true, fullName: true, email: true, role: true, isActive: true },
        });
      }

      if (!user || user.isActive === false) return null;

      return {
        id: user.id,
        username: user.username,
        fullName: user.fullName || undefined,
        email: user.email || undefined,
        role: user.role,
      };
    } catch (error) {
      return null;
    }
  }

  private async verifySessionToken(token: string): Promise<AuthenticatedUser | null> {
    return null;
  }

  // Hash password
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  // Generate JWT token
  generateJwt(user: AuthenticatedUser): string {
    return signToken({
      userId: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
    });
  }
}

export const authService = new AuthService();