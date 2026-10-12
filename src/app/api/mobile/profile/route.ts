// Profile update and password change API
import { authenticateRequest } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';

// GET - Get current user profile
export async function GET(request: NextRequest) {
    try {
        const auth = await authenticateRequest(request);
        if (!auth) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { id: auth.user.id },
            select: {
                id: true,
                username: true,
                email: true,
                fullName: true,
                phone: true,
                role: true,
                isActive: true,
                createdAt: true,
                teamMember: {
                    select: {
                        name: true,
                        phone: true,
                        position: true,
                    }
                }
            }
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        return NextResponse.json({
            id: user.id,
            username: user.username,
            email: user.email,
            fullName: user.fullName || user.teamMember?.name || user.username,
            phone: user.phone || user.teamMember?.phone,
            role: user.role,
            position: user.teamMember?.position,
            createdAt: user.createdAt,
        });
    } catch (error) {
        console.error('Get profile error:', error);
        return NextResponse.json({ error: 'Failed to get profile' }, { status: 500 });
    }
}

// PUT - Update profile
export async function PUT(request: NextRequest) {
    try {
        const auth = await authenticateRequest(request);
        if (!auth) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { email, fullName, phone } = body;

        // Update user record with new fields
        await prisma.user.update({
            where: { id: auth.user.id },
            data: {
                email: email || undefined,
                fullName: fullName || undefined,
                phone: phone || undefined
            }
        });

        // Also update team member if linked for consistency
        const user = await prisma.user.findUnique({
            where: { id: auth.user.id },
            select: { teamMemberId: true }
        });

        if (user?.teamMemberId) {
            await prisma.teamMember.update({
                where: { id: user.teamMemberId },
                data: {
                    name: fullName || undefined,
                    phone: phone || undefined,
                    email: email || undefined
                }
            });
        }

        return NextResponse.json({ success: true, message: 'Profile updated successfully' });
    } catch (error) {
        console.error('Update profile error:', error);
        return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
    }
}

// PATCH - Change password
export async function PATCH(request: NextRequest) {
    try {
        const auth = await authenticateRequest(request);
        if (!auth) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { currentPassword, newPassword, otpVerificationId } = body;

        if (!currentPassword || !newPassword || !otpVerificationId) {
            return NextResponse.json(
                { error: 'Current password, new password, and OTP verification are required' },
                { status: 400 }
            );
        }

        // Get user with password hash
        const user = await prisma.user.findUnique({
            where: { id: auth.user.id },
            select: { passwordHash: true, supabaseId: true }
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Verify current password
        let isValid = false;
        if (user.passwordHash) {
            isValid = await bcrypt.compare(currentPassword, user.passwordHash);
        }
        if (!isValid && auth.user.email) {
            try {
                const { data: sbData } = await supabase.auth.signInWithPassword({
                    email: auth.user.email,
                    password: currentPassword,
                });
                if (sbData?.user) isValid = true;
            } catch (sbErr) {
                console.warn('Supabase profile password check warning:', sbErr);
            }
        }

        if (!isValid) {
            return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
        }

        // Hash new password and update in a transaction
        await prisma.$transaction(async (tx) => {
            // Delete OTP record first to prevent replay attacks
            const deleteResult = await tx.otpVerification.deleteMany({
                where: {
                    id: otpVerificationId,
                    verified: true,
                    email: auth.user.email,
                },
            });

            if (deleteResult.count === 0) {
                throw new Error('Invalid or expired OTP verification');
            }

            const newPasswordHash = await bcrypt.hash(newPassword, 12);
            await tx.user.update({
                where: { id: auth.user.id },
                data: { passwordHash: newPasswordHash }
            });

            // Clean up all remaining OTP records for this email
            await tx.otpVerification.deleteMany({
                where: { email: auth.user.email! },
            });
        });

        if (user.supabaseId && supabaseAdmin) {
            try {
                await supabaseAdmin.auth.admin.updateUserById(user.supabaseId, { password: newPassword });
            } catch (sbErr) {
                console.warn('Supabase admin password sync notice:', sbErr);
            }
        }

        return NextResponse.json({ success: true, message: 'Password changed successfully' });
    } catch (error) {
        console.error('Change password error:', error);
        const isOtpError = error instanceof Error && error.message === 'Invalid or expired OTP verification';
        return NextResponse.json(
            { error: isOtpError ? error.message : 'Failed to change password' },
            { status: isOtpError ? 401 : 500 }
        );
    }
}
