// Support Ticket Detail API - Get, Update, Delete single ticket
import { authenticateRequest } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

// GET - Get single ticket with all messages
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const auth = await authenticateRequest(request);
        if (!auth) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const ticket = await prisma.supportTicket.findUnique({
            where: { id: params.id },
            include: {
                user: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        role: true
                    }
                },
                messages: {
                    orderBy: { createdAt: 'asc' }
                }
            }
        });

        if (!ticket) {
            return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
        }

        const isPrivileged = ['SUPER_ADMIN', 'ADMIN', 'ADMINISTRATION'].includes(auth.user.role);

        // Check authorization
        if (!isPrivileged && ticket.userId !== auth.user.id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Reset hasNewReply if the owner is viewing it
        if (!isPrivileged && ticket.userId === auth.user.id && ticket.hasNewReply) {
            await prisma.supportTicket.update({
                where: { id: params.id },
                data: { hasNewReply: false }
            });
            ticket.hasNewReply = false;
        }

        return NextResponse.json(ticket);
    } catch (error) {
        console.error('Get ticket error:', error);
        return NextResponse.json(
            { error: 'Failed to get ticket' },
            { status: 500 }
        );
    }
}

// PUT - Update ticket status
export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const auth = await authenticateRequest(request);
        if (!auth) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const isPrivileged = ['SUPER_ADMIN', 'ADMIN', 'ADMINISTRATION'].includes(auth.user.role);

        // Only privileged admins can update ticket status
        if (!isPrivileged) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        const { status, priority } = body;

        const ticket = await prisma.supportTicket.update({
            where: { id: params.id },
            data: {
                ...(status && { status }),
                ...(priority && { priority })
            }
        });

        return NextResponse.json(ticket);
    } catch (error) {
        console.error('Update ticket error:', error);
        return NextResponse.json(
            { error: 'Failed to update ticket' },
            { status: 500 }
        );
    }
}

// DELETE - Delete ticket
export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const auth = await authenticateRequest(request);
        if (!auth) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const isPrivileged = ['SUPER_ADMIN', 'ADMIN', 'ADMINISTRATION'].includes(auth.user.role);

        // Only privileged admins can delete tickets
        if (!isPrivileged) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        await prisma.supportTicket.delete({
            where: { id: params.id }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Delete ticket error:', error);
        return NextResponse.json(
            { error: 'Failed to delete ticket' },
            { status: 500 }
        );
    }
}
