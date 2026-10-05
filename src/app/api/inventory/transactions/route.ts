import { authenticateRequest } from "@/lib/api-auth";
import { checkResourceAccess } from "@/lib/authorize";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET inventory transactions
export async function GET(request: NextRequest) {
    const auth = await authenticateRequest(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const permCheck = checkResourceAccess(auth.user, 'inventory', 'view');
    if (permCheck !== true) return permCheck;

    try {
        const { searchParams } = new URL(request.url);
        const search = searchParams.get('search');

        const where: any = {};

        if (search) {
            where.OR = [
                { component: { name: { contains: search, mode: 'insensitive' } } },
                { subcontractor: { companyName: { contains: search, mode: 'insensitive' } } },
                { takenOutFor: { contains: search, mode: 'insensitive' } },
            ];
        }

        const transactions = await prisma.inventoryTransaction.findMany({
            where,
            include: {
                component: true,
                subcontractor: true,
                user: { select: { fullName: true, username: true } },
            },
            orderBy: { createdAt: "desc" },
        });

        return NextResponse.json(transactions);
    } catch (error) {
        console.error('Fetch transactions error:', error);
        return NextResponse.json({ error: "Failed to fetch transactions" }, { status: 500 });
    }
}

// POST create inventory transaction (IN or OUT)
export async function POST(request: NextRequest) {
    const auth = await authenticateRequest(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        const { componentId, type, quantity, subcontractorId, takenOutFor, date } = body;

        const parsedQuantity = parseInt(quantity, 10);
        if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
            return NextResponse.json({ error: "Quantity must be a positive integer" }, { status: 400 });
        }

        // Permission check based on type
        const permAction = type === 'IN' ? 'edit' : 'delete';
        const permCheck = checkResourceAccess(auth.user, 'inventory', permAction as any);
        if (permCheck !== true) return permCheck;

        // Record the transaction and update the component quantity in a transaction
        const result = await prisma.$transaction(async (tx) => {
            const component = await tx.component.findUnique({
                where: { id: componentId }
            });

            if (!component) {
                throw new Error("COMPONENT_NOT_FOUND");
            }

            if (type === 'OUT' && component.quantity < parsedQuantity) {
                throw new Error(`INSUFFICIENT_STOCK: Available ${component.quantity}, requested ${parsedQuantity}`);
            }

            // Record transaction
            const transaction = await tx.inventoryTransaction.create({
                data: {
                    componentId,
                    type,
                    quantity: parsedQuantity,
                    subcontractorId: subcontractorId || null,
                    userId: auth.user.id,
                    takenOutFor: takenOutFor || null,
                    date: (() => {
                        if (!date) return new Date();
                        const parsed = new Date(date);
                        return isNaN(parsed.getTime()) ? new Date() : parsed;
                    })(),
                }
            });

            // Update component stock
            const quantityChange = type === 'IN' ? parsedQuantity : -parsedQuantity;
            await tx.component.update({
                where: { id: componentId },
                data: {
                    quantity: {
                        increment: quantityChange
                    }
                }
            });

            return transaction;
        });

        return NextResponse.json(result, { status: 201 });
    } catch (error: any) {
        console.error('Create transaction error:', error);
        if (error.message === "COMPONENT_NOT_FOUND") {
            return NextResponse.json({ error: "Component not found" }, { status: 404 });
        }
        if (error.message?.startsWith("INSUFFICIENT_STOCK")) {
            return NextResponse.json({ error: error.message.replace("INSUFFICIENT_STOCK: ", "") }, { status: 400 });
        }
        return NextResponse.json({
            error: "Failed to process inventory transaction",
        }, { status: 500 });
    }
}
