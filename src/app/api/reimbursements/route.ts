import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

// GET Fetch reimbursements
export async function GET(request: NextRequest) {
    const auth = await authenticateRequest(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');

        const where: Prisma.ReimbursementWhereInput = {};

        // Filtering: privileged roles (SUPER_ADMIN, ADMIN, ADMINISTRATION) can see all
        // Regular users can only see their own
        const isPrivileged = auth.user.role === 'ADMINISTRATION' || auth.user.role === 'SUPER_ADMIN' || auth.user.role === 'ADMIN';
        if (!isPrivileged) {
            where.userId = auth.user.id;
        }

        if (status) {
            where.status = status;
        }

        const reimbursements = await prisma.reimbursement.findMany({
            where,
            include: {
                user: {
                    select: {
                        fullName: true,
                        username: true,
                        role: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        return NextResponse.json(reimbursements);
    } catch (error) {
        console.error('Fetch reimbursements error:', error);
        return NextResponse.json({ error: "Failed to fetch reimbursements" }, { status: 500 });
    }
}

// POST Submit a reimbursement
export async function POST(request: NextRequest) {
    const auth = await authenticateRequest(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        const { name, category, amount, date, billData } = body;

        if (!name || !amount || !date || !billData) {
            return NextResponse.json({ error: "Missing required fields: description, amount, date, and receipt" }, { status: 400 });
        }

        const parsedAmount = parseFloat(amount);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            return NextResponse.json({ error: "Amount must be a valid positive number" }, { status: 400 });
        }

        const reimbursement = await prisma.reimbursement.create({
            data: {
                name: name.trim(),
                category: category || "Other",
                amount: parsedAmount,
                date: new Date(date),
                billData,
                userId: auth.user.id,
            }
        });

        return NextResponse.json(reimbursement, { status: 201 });
    } catch (error) {
        console.error('Create reimbursement error:', error);
        return NextResponse.json({
            error: "Failed to submit reimbursement",
        }, { status: 500 });
    }
}

// PATCH Update reimbursement status (administration only)
export async function PATCH(request: NextRequest) {
    const auth = await authenticateRequest(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Privilege check
    const isPrivileged = auth.user.role === 'ADMINISTRATION' || auth.user.role === 'SUPER_ADMIN' || auth.user.role === 'ADMIN';
    if (!isPrivileged) {
        return NextResponse.json({ error: 'Forbidden: Administration or Admin access required' }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { id, status } = body;

        if (!id || !status) {
            return NextResponse.json({ error: 'Missing id or status' }, { status: 400 });
        }

        const validStatuses = ['Pending', 'Approved', 'Completed', 'Rejected'];
        if (!validStatuses.includes(status)) {
            return NextResponse.json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, { status: 400 });
        }

        const reimbursement = await prisma.reimbursement.update({
            where: { id },
            data: { status }
        });

        return NextResponse.json({ success: true, status: reimbursement.status });
    } catch (error) {
        console.error('Update reimbursement status error:', error);
        return NextResponse.json({
            error: 'Failed to update status',
        }, { status: 500 });
    }
}
