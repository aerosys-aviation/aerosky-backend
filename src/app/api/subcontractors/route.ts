import { authenticateRequest } from "@/lib/api-auth";
import { checkResourceAccess } from "@/lib/authorize";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET all subcontractors
export async function GET(request: NextRequest) {
    const auth = await authenticateRequest(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const permCheck = checkResourceAccess(auth.user, 'subcontractor', 'view');
    if (permCheck !== true) return permCheck;

    try {
        const subcontractors = await prisma.subcontractor.findMany({
            orderBy: { createdAt: "desc" },
        });
        return NextResponse.json(subcontractors);
    } catch (error) {
        console.error('Fetch subcontractors error:', error);
        return NextResponse.json({ error: "Failed to fetch subcontractors" }, { status: 500 });
    }
}

// POST create subcontractor
export async function POST(request: NextRequest) {
    const auth = await authenticateRequest(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const permCheck = checkResourceAccess(auth.user, 'subcontractor', 'create');
    if (permCheck !== true) return permCheck;

    try {
        const body = await request.json();
        const { companyName, type, contactPerson, contactEmail, contactPhone, agreementDate } = body;

        const subcontractor = await prisma.subcontractor.create({
            data: {
                companyName,
                type,
                contactPerson,
                contactEmail,
                contactPhone,
                agreementDate,
            }
        });

        return NextResponse.json(subcontractor, { status: 201 });
    } catch (error) {
        console.error('Create subcontractor error:', error);
        return NextResponse.json({
            error: "Failed to create subcontractor",
        }, { status: 500 });
    }
}
