import { generateOTP, sendOTPEmail } from '@/lib/email';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';

// POST - Send OTP to organization email
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { email, purpose } = body;

        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        }

        if (!purpose || !['CHANGE_PASSWORD', 'FORGOT_PASSWORD'].includes(purpose)) {
            return NextResponse.json({ error: 'Valid purpose is required' }, { status: 400 });
        }

        // Verify the email belongs to a user
        const user = await prisma.user.findFirst({
            where: { email },
        });

        if (!user) {
            return NextResponse.json(
                { error: 'No account found with this email' },
                { status: 404 }
            );
        }

        // Delete any existing unused OTPs for this email/purpose
        await prisma.otpVerification.deleteMany({
            where: {
                email,
                purpose,
                verified: false,
            },
        });

        // Generate OTP and hash it for storage
        const otp = generateOTP();
        const otpHash = await bcrypt.hash(otp, 10);

        // Store OTP in database (expires in 10 minutes)
        await prisma.otpVerification.create({
            data: {
                email,
                otp: otpHash,
                purpose,
                expiresAt: new Date(Date.now() + 10 * 60 * 1000),
            },
        });

        // Send OTP via email
        const sent = await sendOTPEmail(email, otp, purpose as 'CHANGE_PASSWORD' | 'FORGOT_PASSWORD');

        if (!sent) {
            return NextResponse.json(
                { error: 'Failed to send OTP email. Please check SMTP configuration.' },
                { status: 500 }
            );
        }

        return NextResponse.json(
            { success: true, message: 'OTP sent to your email' }
        );
    } catch (error) {
        console.error('Send OTP error:', error);
        return NextResponse.json(
            { error: 'Failed to send OTP' },
            { status: 500 }
        );
    }
}
