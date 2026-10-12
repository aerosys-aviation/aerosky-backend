import { prisma } from '@/lib/prisma';
import { localLoginLimiter } from '@/lib/rate-limiter';
import bcrypt from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { email, otp, purpose } = body;

        if (!email || !otp || !purpose) {
            return NextResponse.json(
                { error: 'Email, OTP, and purpose are required' },
                { status: 400 }
            );
        }

        // Apply rate limiting (prevents brute forcing 6-digit OTPs)
        const limitResult = await localLoginLimiter.limit(`verify-otp:${email}`);
        if (!limitResult.success) {
            return NextResponse.json(
                { error: 'Too many verification attempts. Please try again later.' },
                { status: 429 }
            );
        }

        // Find all non-verified, non-expired OTPs for this email and purpose
        const otpRecords = await prisma.otpVerification.findMany({
            where: {
                email,
                purpose,
                verified: false,
                expiresAt: { gt: new Date() },
            },
            orderBy: { createdAt: 'desc' },
        });

        if (otpRecords.length === 0) {
            return NextResponse.json(
                { error: 'OTP expired or not found. Please request a new one.' },
                { status: 400 }
            );
        }

        // Check if any OTP record matches
        let matchedRecord = null;
        for (const record of otpRecords) {
            const isMatch = await bcrypt.compare(otp, record.otp);
            if (isMatch) {
                matchedRecord = record;
                break;
            }
        }

        if (!matchedRecord) {
            return NextResponse.json(
                { error: 'Invalid OTP. Please try again.' },
                { status: 400 }
            );
        }

        // Mark OTP as verified
        await prisma.otpVerification.update({
            where: { id: matchedRecord.id },
            data: { verified: true },
        });

        return NextResponse.json({
            success: true,
            verificationId: matchedRecord.id,
            message: 'OTP verified successfully',
        });
    } catch (error) {
        console.error('Verify OTP error:', error);
        return NextResponse.json(
            { error: 'Failed to verify OTP' },
            { status: 500 }
        );
    }
}
