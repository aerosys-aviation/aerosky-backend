import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN', 'ADMINISTRATION'];

export async function GET(request: NextRequest) {
    const auth = await authenticateRequest(request);
    if (!auth) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!ADMIN_ROLES.includes(auth.user.role)) {
        return NextResponse.json(
            { error: "Forbidden: Administration access required to view reports." },
            { status: 403 }
        );
    }

    try {
        const { searchParams } = new URL(request.url);
        const search = searchParams.get('search')?.trim() || '';
        const category = searchParams.get('category')?.trim() || '';
        const status = searchParams.get('status')?.trim() || '';
        const period = searchParams.get('period')?.trim() || '';
        const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
        const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
        const skip = (page - 1) * limit;

        const whereClause: any = {};

        if (search) {
            whereClause.OR = [
                { title: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
                { tags: { contains: search, mode: 'insensitive' } },
                { fileName: { contains: search, mode: 'insensitive' } },
                { user: { fullName: { contains: search, mode: 'insensitive' } } },
                { user: { username: { contains: search, mode: 'insensitive' } } },
            ];
        }

        if (category && category !== 'All') {
            whereClause.category = { equals: category, mode: 'insensitive' };
        }

        if (status && status !== 'All') {
            whereClause.status = { equals: status, mode: 'insensitive' };
        }

        if (period && period !== 'All') {
            whereClause.period = { equals: period, mode: 'insensitive' };
        }

        const [reports, totalCount, allReportsSummary] = await Promise.all([
            prisma.report.findMany({
                where: whereClause,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
                include: {
                    user: {
                        select: {
                            id: true,
                            fullName: true,
                            username: true,
                            email: true,
                            role: true,
                        }
                    }
                }
            }),
            prisma.report.count({ where: whereClause }),
            prisma.report.findMany({
                select: {
                    category: true,
                    status: true,
                    createdAt: true,
                }
            })
        ]);

        // Compute metrics
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const metrics = {
            totalReports: allReportsSummary.length,
            recentCount: allReportsSummary.filter(r => r.createdAt >= thirtyDaysAgo).length,
            operationsCount: allReportsSummary.filter(r => /operation|fleet|drone/i.test(r.category)).length,
            financialCount: allReportsSummary.filter(r => /financial|audit|expense|budget/i.test(r.category)).length,
            complianceCount: allReportsSummary.filter(r => /compliance|safety|security|legal/i.test(r.category)).length,
        };

        return NextResponse.json({
            reports,
            metrics,
            pagination: {
                page,
                limit,
                total: totalCount,
                totalPages: Math.ceil(totalCount / limit) || 1,
            }
        });
    } catch (error) {
        console.error("Error fetching administrative reports:", error);
        return NextResponse.json(
            { error: "Failed to fetch reports. Please try again later." },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    const auth = await authenticateRequest(request);
    if (!auth) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!ADMIN_ROLES.includes(auth.user.role)) {
        return NextResponse.json(
            { error: "Forbidden: Administration access required to create reports." },
            { status: 403 }
        );
    }

    try {
        const body = await request.json();
        const {
            title,
            description,
            category = "General",
            status = "published",
            period,
            attachment,
            fileName,
            fileSize,
            tags
        } = body;

        if (!title || typeof title !== "string" || !title.trim()) {
            return NextResponse.json({ error: "Report title is required." }, { status: 400 });
        }

        if (!description || typeof description !== "string" || !description.trim()) {
            return NextResponse.json({ error: "Report description or summary is required." }, { status: 400 });
        }

        // Verify author user exists in DB to prevent foreign key errors
        const userExists = await prisma.user.findUnique({
            where: { id: auth.user.id },
            select: { id: true }
        });

        if (!userExists) {
            return NextResponse.json({ error: "Author account not found in database." }, { status: 404 });
        }

        const newReport = await prisma.report.create({
            data: {
                title: title.trim(),
                description: description.trim(),
                category: category.trim(),
                status: status ? status.trim().toLowerCase() : "published",
                period: period && period.trim() ? period.trim() : null,
                attachment: attachment && attachment.trim() ? attachment.trim() : null,
                fileName: fileName && fileName.trim() ? fileName.trim() : null,
                fileSize: fileSize && fileSize.trim() ? fileSize.trim() : null,
                tags: tags && tags.trim() ? tags.trim() : null,
                userId: auth.user.id,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        fullName: true,
                        username: true,
                        email: true,
                        role: true,
                    }
                }
            }
        });

        return NextResponse.json({
            success: true,
            message: "Report created successfully.",
            report: newReport
        }, { status: 201 });
    } catch (error) {
        console.error("Error creating administrative report:", error);
        return NextResponse.json(
            { error: "Failed to create report. Please try again." },
            { status: 500 }
        );
    }
}
