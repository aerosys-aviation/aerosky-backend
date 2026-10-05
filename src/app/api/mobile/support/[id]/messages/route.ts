// Support Ticket Messages API - Chat messages
import { authenticateRequest } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

// GET - Get all messages for a ticket
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
            where: { id: params.id }
        });

        if (!ticket) {
            return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
        }

        const isPrivileged = ['SUPER_ADMIN', 'ADMIN', 'ADMINISTRATION'].includes(auth.user.role);

        // Check authorization
        if (!isPrivileged && ticket.userId !== auth.user.id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const messages = await prisma.supportMessage.findMany({
            where: { ticketId: params.id },
            orderBy: { createdAt: 'asc' }
        });

        return NextResponse.json(messages);
    } catch (error) {
        console.error('Get messages error:', error);
        return NextResponse.json(
            { error: 'Failed to get messages' },
            { status: 500 }
        );
    }
}

// POST - Add a new message (reply)
export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const auth = await authenticateRequest(request);
        if (!auth) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const ticket = await prisma.supportTicket.findUnique({
            where: { id: params.id }
        });

        if (!ticket) {
            return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
        }

        const isPrivileged = ['SUPER_ADMIN', 'ADMIN', 'ADMINISTRATION'].includes(auth.user.role);

        // Check authorization
        if (!isPrivileged && ticket.userId !== auth.user.id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        const { message } = body;

        if (!message) {
            return NextResponse.json({ error: 'Message is required' }, { status: 400 });
        }

        // Create message and update ticket status if admin replies
        const result = await prisma.$transaction(async (tx) => {
            const newMessage = await tx.supportMessage.create({
                data: {
                    ticketId: params.id,
                    senderId: auth.user.id,
                    message
                }
            });

            // Update ticket status and timestamp
            const updateData: any = { updatedAt: new Date() };

            // If privileged admin replies to an OPEN ticket, mark it as IN_PROGRESS
            if (isPrivileged && ticket.status === 'OPEN') {
                updateData.status = 'IN_PROGRESS';
            }

            // Set hasNewReply flag
            if (isPrivileged) {
                updateData.hasNewReply = true;
            } else if (ticket.userId === auth.user.id) {
                // User replying means they've read previous replies
                updateData.hasNewReply = false;
            }

            await tx.supportTicket.update({
                where: { id: params.id },
                data: updateData
            });

            return newMessage;
        });

        console.log('Added message to ticket:', params.id, 'by:', auth.user.username);

        return NextResponse.json(result);
    } catch (error) {
        console.error('Add message error:', error);
        return NextResponse.json(
            { error: 'Failed to add message' },
            { status: 500 }
        );
    }
}
