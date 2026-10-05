// Support Ticket API - List and Create
import { authenticateRequest } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

// GET - Get support tickets
// SUPER_ADMIN sees all tickets, ADMIN sees only their org's tickets
export async function GET(request: NextRequest) {
    try {
        const auth = await authenticateRequest(request);
        if (!auth) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const isPrivileged = ['SUPER_ADMIN', 'ADMIN', 'ADMINISTRATION'].includes(auth.user.role);

        const tickets = await prisma.supportTicket.findMany({
            where: isPrivileged ? {} : { userId: auth.user.id },
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
                    take: 1,
                    orderBy: { createdAt: 'desc' }
                },
                _count: {
                    select: { messages: true }
                }
            },
            orderBy: [
                { status: 'asc' },
                { priority: 'desc' },
                { updatedAt: 'desc' }
            ]
        });

        return NextResponse.json(tickets);
    } catch (error) {
        console.error('Get support tickets error:', error);
        return NextResponse.json(
            { error: 'Failed to get tickets' },
            { status: 500 }
        );
    }
}

// POST - Create a new support ticket
export async function POST(request: NextRequest) {
    try {
        const auth = await authenticateRequest(request);
        if (!auth) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { subject, message, priority } = body;

        if (!subject || !message) {
            return NextResponse.json(
                { error: 'Subject and message are required' },
                { status: 400 }
            );
        }

        // Create ticket with initial message in a transaction
        const ticket = await prisma.$transaction(async (tx) => {
            // Create the ticket
            const newTicket = await tx.supportTicket.create({
                data: {
                    subject,
                    priority: priority || 'NORMAL',
                    userId: auth.user.id,
                }
            });

            // Create initial message
            await tx.supportMessage.create({
                data: {
                    ticketId: newTicket.id,
                    senderId: auth.user.id,
                    message
                }
            });

            return newTicket;
        });

        console.log('Created support ticket:', ticket.id, 'by user:', auth.user.username);

        return NextResponse.json({
            success: true,
            ticket,
            message: 'Your support ticket has been created'
        });
    } catch (error) {
        console.error('Create support ticket error:', error);
        return NextResponse.json(
            { error: 'Failed to create ticket' },
            { status: 500 }
        );
    }
}
