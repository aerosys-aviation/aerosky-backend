import { authOptions } from "@/lib/auth";
import { getTokenFromHeader, verifyToken } from "@/lib/jwt";
import { prisma } from "@/lib/prisma";
import { supabase } from "@/lib/supabase";
import { getServerSession } from "next-auth";
import { NextRequest } from 'next/server';
import type { AuthenticatedUser, AuthResult } from '@/types/auth';

// Re-export for backward compatibility
export type { AuthenticatedUser, AuthResult };

export async function authenticateRequest(request: NextRequest): Promise<AuthResult | null> {
    try {
        // 1. Try Bearer Token (Mobile or API client with Supabase / JWT)
        const authHeader = request.headers.get('Authorization');
        const token = getTokenFromHeader(authHeader);

        if (token) {
            // A. Try Supabase Auth Token verification
            try {
                const { data: supabaseData } = await supabase.auth.getUser(token);
                if (supabaseData?.user) {
                    const sbUser = supabaseData.user;
                    const user = await prisma.user.findFirst({
                        where: {
                            OR: [
                                { supabaseId: sbUser.id },
                                { email: { equals: sbUser.email, mode: 'insensitive' } },
                            ]
                        },
                        select: { id: true, username: true, email: true, role: true, supabaseId: true, isActive: true }
                    });

                    if (user) {
                        // Reject deactivated users
                        if (user.isActive === false) {
                            console.warn(`[API Auth] Access denied: Account ${user.username} is deactivated.`);
                            return null;
                        }

                        if (!user.supabaseId) {
                            await prisma.user.update({
                                where: { id: user.id },
                                data: { supabaseId: sbUser.id }
                            });
                        }
                        return {
                            user: {
                                id: user.id,
                                username: user.username,
                                email: user.email || undefined,
                                role: user.role,
                            },
                            type: 'jwt'
                        };
                    } else if (sbUser.email) {
                        // Provision Prisma user for new Supabase user with least privilege (VIEWER)
                        const teamMember = await prisma.teamMember.findFirst({
                            where: { email: { equals: sbUser.email, mode: 'insensitive' } }
                        });

                        const newUser = await prisma.user.create({
                            data: {
                                username: sbUser.email.split('@')[0],
                                email: sbUser.email,
                                fullName: sbUser.user_metadata?.full_name || sbUser.email.split('@')[0],
                                supabaseId: sbUser.id,
                                role: 'VIEWER',
                                teamMemberId: teamMember ? teamMember.id : undefined,
                            }
                        });
                        return {
                            user: {
                                id: newUser.id,
                                username: newUser.username,
                                email: newUser.email || undefined,
                                role: newUser.role,
                            },
                            type: 'jwt'
                        };
                    }
                }
            } catch (sbErr) {
                console.warn('Supabase token verification check error:', sbErr);
            }

            // B. Fallback to legacy JWT verification
            const decoded = verifyToken(token) as { userId?: string; id?: string; username?: string; sub?: string } | null;

            if (decoded) {
                const userId = decoded.userId || decoded.id || decoded.sub;

                let user = null;
                if (userId) {
                    user = await prisma.user.findUnique({
                        where: { id: userId },
                        select: { id: true, username: true, email: true, role: true, isActive: true }
                    });
                }

                if (!user && decoded.username) {
                    user = await prisma.user.findUnique({
                        where: { username: decoded.username },
                        select: { id: true, username: true, email: true, role: true, isActive: true }
                    });
                }

                if (user) {
                    // Reject deactivated users
                    if (user.isActive === false) {
                        console.warn(`[API Auth] Access denied: Account ${user.username} is deactivated.`);
                        return null;
                    }

                    return {
                        user: {
                            id: user.id,
                            username: user.username,
                            email: user.email || undefined,
                            role: user.role,
                        },
                        type: 'jwt'
                    };
                }
            }
        }

        // 2. Try session (Web dashboard)
        const session = await getServerSession(authOptions);
        if (session?.user) {
            let user = null;

            if ((session.user as any).id) {
                user = await prisma.user.findUnique({
                    where: { id: (session.user as any).id },
                    select: { id: true, username: true, email: true, role: true, isActive: true }
                });
            }

            if (!user && session.user.email) {
                user = await prisma.user.findUnique({
                    where: { email: session.user.email },
                    select: { id: true, username: true, email: true, role: true, isActive: true }
                });
            }

            if (!user && session.user.name) {
                user = await prisma.user.findUnique({
                    where: { username: session.user.name },
                    select: { id: true, username: true, email: true, role: true, isActive: true }
                });
            }

            if (user) {
                // Reject deactivated users even for active sessions
                if (user.isActive === false) {
                    console.warn(`[API Auth] Access denied: Account ${user.username} is deactivated.`);
                    return null;
                }

                return {
                    user: {
                        id: user.id,
                        username: user.username,
                        email: user.email || undefined,
                        role: user.role,
                    },
                    type: 'session'
                };
            }
        }
    } catch (error) {
        console.error('Authentication error:', error);
    }

    return null;
}
