// Mobile Authentication API - Login endpoint
import { authService } from '@/lib/auth-service';
import { localLoginLimiter } from '@/lib/rate-limiter';
import { handleError, errors } from '@/lib/error-handler';
import { prisma } from '@/lib/prisma';
import { supabase } from '@/lib/supabase';
import { signToken } from '@/lib/jwt';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { email, password, username } = body;

        // Support both email and username for login
        const loginId = (username || email || '').trim();

        if (!loginId || !password) {
            throw errors.validationError({
                loginId: ['Username/email is required'],
                password: ['Password is required']
            });
        }

        // Apply rate limiting
        const limitResult = await localLoginLimiter.limit(loginId);
        if (!limitResult.success) {
            return NextResponse.json(
                {
                    error: 'TOO_MANY_ATTEMPTS',
                    message: 'Too many login attempts. Try again later.',
                },
                { status: 429 }
            );
        }

        // Use the consolidated AuthService for credential verification
        const authenticatedUser = await authService.authenticateWithCredentials(loginId, password);

        if (!authenticatedUser) {
            return NextResponse.json(
                { error: 'Invalid credentials' },
                { status: 401 }
            );
        }

        // Try to get a Supabase session for the token (preferred for mobile)
        let token: string;
        let refreshToken: string | undefined;

        // Resolve email for Supabase session
        let emailToAuth = loginId;
        if (!loginId.includes('@') && authenticatedUser.email) {
            emailToAuth = authenticatedUser.email;
        }

        try {
            const { data: authData } = await supabase.auth.signInWithPassword({
                email: emailToAuth,
                password,
            });
            if (authData?.session) {
                token = authData.session.access_token;
                refreshToken = authData.session.refresh_token;

                // Link Supabase ID if needed
                if (authData.user && authenticatedUser.id) {
                    const existingUser = await prisma.user.findUnique({
                        where: { id: authenticatedUser.id },
                        select: { supabaseId: true }
                    });
                    if (existingUser && !existingUser.supabaseId) {
                        await prisma.user.update({
                            where: { id: authenticatedUser.id },
                            data: { supabaseId: authData.user.id }
                        });
                    }
                }
            } else {
                // Supabase session not available, issue legacy JWT
                token = signToken({
                    userId: authenticatedUser.id,
                    username: authenticatedUser.username,
                    fullName: authenticatedUser.fullName,
                    role: authenticatedUser.role,
                });
            }
        } catch {
            // Supabase auth failed, issue legacy JWT
            token = signToken({
                userId: authenticatedUser.id,
                username: authenticatedUser.username,
                fullName: authenticatedUser.fullName,
                role: authenticatedUser.role,
            });
        }

        return NextResponse.json({
            token,
            ...(refreshToken && { refreshToken }),
            user: {
                id: authenticatedUser.id,
                email: authenticatedUser.email || authenticatedUser.username,
                fullName: authenticatedUser.fullName || authenticatedUser.username,
                role: authenticatedUser.role,
            }
        });

    } catch (error) {
        return handleError(error);
    }
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS() {
    return new NextResponse(null, {
        status: 200,
        headers: {
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
}
