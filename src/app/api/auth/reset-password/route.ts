import { prisma } from '@/lib/prisma';
import { supabaseAdmin } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { email, newPassword, verificationId } = body;

        if (!email || !newPassword || !verificationId) {
            return NextResponse.json(
                { error: 'Email, new password, and verification ID are required' },
                { status: 400 }
            );
        }

        if (newPassword.length < 8) {
            return NextResponse.json(
                { error: 'Password must be at least 8 characters long' },
                { status: 400 }
            );
        }

        // Verify the OTP verification record exists and is verified
        const otpRecord = await prisma.otpVerification.findUnique({
            where: { id: verificationId },
        });

        if (!otpRecord) {
            return NextResponse.json(
                { error: 'Invalid verification. Please request a new OTP.' },
                { status: 400 }
            );
        }

        if (!otpRecord.verified) {
            return NextResponse.json(
                { error: 'OTP not yet verified. Please verify OTP first.' },
                { status: 400 }
            );
        }

        if (otpRecord.email !== email) {
            // Check if it's the username
            const user = await prisma.user.findFirst({
                where: {
                    OR: [
                        { email },
                        { username: email },
                    ],
                },
            });

            if (!user || (user.email !== otpRecord.email && user.username !== otpRecord.email)) {
                return NextResponse.json(
                    { error: 'Email mismatch with verification record.' },
                    { status: 400 }
                );
            }
        }

        // Check if the verification is not too old (30 minutes max after verification)
        const verificationAge = Date.now() - otpRecord.createdAt.getTime();
        if (verificationAge > 30 * 60 * 1000) {
            return NextResponse.json(
                { error: 'Verification expired. Please request a new OTP.' },
                { status: 400 }
            );
        }

        // Hash the new password
        const passwordHash = await bcrypt.hash(newPassword, 12);

        // Update user password in a transaction — delete OTP records to prevent replay
        await prisma.$transaction(async (tx) => {
            // Delete the OTP record FIRST to prevent replay attacks
            // If this verification ID has already been consumed, the deleteMany below
            // will delete 0 rows and we proceed (idempotent)
            const deleteResult = await tx.otpVerification.deleteMany({
                where: { id: verificationId },
            });

            // If the OTP record was already consumed (deleted), reject
            if (deleteResult.count === 0) {
                throw new Error('VERIFICATION_ALREADY_USED');
            }

            // Find the user by email
            const user = await tx.user.findFirst({
                where: {
                    OR: [
                        { email },
                        { username: email },
                    ],
                },
            });

            if (!user) {
                throw new Error('User not found');
            }

            // Update user password
            await tx.user.update({
                where: { id: user.id },
                data: { passwordHash },
            });

            // If Supabase user exists and admin client is available, update Supabase password
            if (user.supabaseId && supabaseAdmin) {
                try {
                    await supabaseAdmin.auth.admin.updateUserById(user.supabaseId, { password: newPassword });
                } catch (sbErr) {
                    console.warn('Supabase admin password sync notice:', sbErr);
                }
            }

            // Delete all remaining OTP records for this email
            await tx.otpVerification.deleteMany({
                where: { email: otpRecord.email },
            });
        });

        return NextResponse.json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
        console.error('Reset password error:', error);

        // Handle known business logic errors without leaking internals
        if (error instanceof Error && error.message === 'VERIFICATION_ALREADY_USED') {
            return NextResponse.json(
                { error: 'This verification has already been used. Please request a new OTP.' },
                { status: 400 }
            );
        }

        return NextResponse.json(
            { error: 'Failed to reset password' },
            { status: 500 }
        );
    }
}
