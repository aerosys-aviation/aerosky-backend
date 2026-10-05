import { authenticateRequest } from "@/lib/api-auth";
import { checkResourceAccess } from "@/lib/authorize";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

// GET /api/mobile/expenses - Fetch expenses
export async function GET(request: NextRequest) {
    const auth = await authenticateRequest(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const permCheck = checkResourceAccess(auth.user, 'expense', 'view');
    if (permCheck !== true) return permCheck;

    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');
        const category = searchParams.get('category');
        const status = searchParams.get('status');

        const where: Prisma.ExpenseWhereInput = {};

        if (category) where.category = category;
        if (status) where.status = status;

        const [expenses, total] = await Promise.all([
            prisma.expense.findMany({
                where,
                orderBy: { date: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.expense.count({ where })
        ]);

        return NextResponse.json({
            expenses,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) }
        });
    } catch (error) {
        console.error('Mobile fetch expenses error:', error);
        return NextResponse.json({ error: "Failed to fetch expenses" }, { status: 500 });
    }
}

// POST /api/mobile/expenses - Create new expense
export async function POST(request: NextRequest) {
    const auth = await authenticateRequest(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const permCheck = checkResourceAccess(auth.user, 'expense', 'create');
    if (permCheck !== true) return permCheck;

    try {
        const body = await request.json();
        const { description, amount, date, category, paymentMethod, attachment, paymentStatus } = body;

        if (!description || !amount || !date || !category) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const expense = await prisma.expense.create({
            data: {
                description,
                amount: parseFloat(amount),
                date: new Date(date),
                category,
                paymentMethod: paymentMethod || null,
                paymentStatus: paymentStatus || 'unpaid',
                attachment: attachment || null,
            }
        });

        return NextResponse.json(expense, { status: 201 });
    } catch (error) {
        console.error('Mobile create expense error:', error);
        return NextResponse.json({ error: "Failed to create expense" }, { status: 500 });
    }
}

// PUT /api/mobile/expenses - Update expense
export async function PUT(request: NextRequest) {
    const auth = await authenticateRequest(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const permCheck = checkResourceAccess(auth.user, 'expense', 'edit');
    if (permCheck !== true) return permCheck;

    try {
        const body = await request.json();
        const { id, description, amount, date, category, paymentMethod, attachment, status, paymentStatus } = body;

        if (!id) {
            return NextResponse.json({ error: "Expense ID is required" }, { status: 400 });
        }

        const updateData: Prisma.ExpenseUpdateInput = {};
        if (description !== undefined) updateData.description = description;
        if (amount !== undefined) updateData.amount = parseFloat(amount);
        if (date !== undefined) updateData.date = new Date(date);
        if (category !== undefined) updateData.category = category;
        if (paymentMethod !== undefined) updateData.paymentMethod = paymentMethod;
        if (attachment !== undefined) updateData.attachment = attachment;
        if (status !== undefined) updateData.status = status;
        if (paymentStatus !== undefined) (updateData as any).paymentStatus = paymentStatus;

        const expense = await prisma.expense.update({
            where: { id },
            data: updateData
        });

        return NextResponse.json(expense);
    } catch (error) {
        console.error('Mobile update expense error:', error);
        return NextResponse.json({ error: "Failed to update expense" }, { status: 500 });
    }
}

// DELETE /api/mobile/expenses - Delete expense
export async function DELETE(request: NextRequest) {
    const auth = await authenticateRequest(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const permCheck = checkResourceAccess(auth.user, 'expense', 'delete');
    if (permCheck !== true) return permCheck;

    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: "Expense ID is required" }, { status: 400 });
        }

        await prisma.expense.delete({ where: { id } });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Mobile delete expense error:', error);
        return NextResponse.json({ error: "Failed to delete expense" }, { status: 500 });
    }
}
