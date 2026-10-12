import { authenticateRequest } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { GoogleGenerativeAI, SchemaType, Part } from '@google/generative-ai';
import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { formatDate } from '@/lib/date';
import {
  DATABASE_SCHEMA_DOC,
  executeSafeSqlQuery,
  executeDeterministicFallback,
} from '@/lib/assistant-db';

// Input validation schema
const assistantRequestSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty').max(2000, 'Message too long'),
  history: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string(),
    })
  ).optional().default([]),
});

type AssistantRequest = z.infer<typeof assistantRequestSchema>;

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * Fetches comprehensive context data about the user's operations, scoped by user role
 */
async function getContextData(userId?: string, userRole?: string) {
  try {
    const isPrivileged = ['SUPER_ADMIN', 'ADMIN', 'ADMINISTRATION', 'SALES'].includes(userRole || '');
    const hasOrderAccess = ['SUPER_ADMIN', 'ADMIN', 'ADMINISTRATION', 'SALES', 'OPERATIONS'].includes(userRole || '');
    const where: any = {};

    const [drones, orders, flights, components, teamMembers, batteries, rawLeads] = await Promise.all([
      prisma.drone.count({ where }),
      hasOrderAccess ? prisma.order.count({ where }) : Promise.resolve(0),
      prisma.flightLog.count({ where }),
      prisma.component.count({ where }),
      prisma.teamMember.count({ where }),
      prisma.battery.count({ where }),
      isPrivileged ? prisma.lead.count({ where: {} }) : Promise.resolve(0),
    ]);
    const leads = isPrivileged ? rawLeads : 0;

    // Get recent orders with more details if authorized
    const recentOrders = hasOrderAccess ? await prisma.order.findMany({
      where,
      select: {
        id: true,
        contractNumber: true,
        clientName: true,
        contractValue: true,
        manufacturingStage: true,
        paymentStatus: true,
        quantity: true,
        droneModel: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }) : [];

    // Get low stock components
    const lowStockComponents = await prisma.component.findMany({
      where: {
        ...where,
        quantity: { lte: 5 },
      },
      select: {
        name: true,
        quantity: true,
        category: true,
      },
      take: 10,
    });

    // Get high-priority orders
    const criticalOrders = hasOrderAccess ? await prisma.order.findMany({
      where: {
        ...where,
        priorityLevel: 'High',
      },
      select: {
        contractNumber: true,
        clientName: true,
        priorityLevel: true,
        manufacturingStage: true,
      },
      take: 5,
    }) : [];

    // Calculate order statistics
    const orderStats = {
      inDesign: orders > 0 ? recentOrders.filter(o => o.manufacturingStage === 'In Design').length : 0,
      inProduction: orders > 0 ? recentOrders.filter(o => o.manufacturingStage === 'In Production').length : 0,
      readyForDelivery: orders > 0 ? recentOrders.filter(o => o.manufacturingStage === 'Ready for Delivery').length : 0,
      delivered: orders > 0 ? recentOrders.filter(o => o.manufacturingStage === 'Delivered').length : 0,
    };

    // Calculate payment statistics (only for privileged roles)
    const paymentStats = isPrivileged ? {
      paid: orders > 0 ? recentOrders.filter(o => o.paymentStatus === 'Paid').length : 0,
      pending: orders > 0 ? recentOrders.filter(o => o.paymentStatus === 'Pending').length : 0,
      unpaid: orders > 0 ? recentOrders.filter(o => o.paymentStatus === 'Unpaid').length : 0,
    } : { paid: 0, pending: 0, unpaid: 0 };

    // Calculate total contract value (only for privileged roles)
    const totalContractValue = isPrivileged
      ? recentOrders.reduce((sum, o) => sum + parseFloat(o.contractValue.toString()), 0).toFixed(2)
      : 'Confidential';

    // Fetch pending follow-ups (only for privileged CRM roles)
    const pendingFollowUps = isPrivileged ? await prisma.followUp.findMany({
      where: {
        status: 'PENDING',
      },
      select: {
        id: true,
        title: true,
        scheduledAt: true,
        lead: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { scheduledAt: 'asc' },
      take: 5,
    }) : [];

    // Fetch team members with details
    const teamMembersDetails = await prisma.teamMember.findMany({
      where,
      select: {
        id: true,
        name: true,
        position: true,
        phone: true,
        email: true,
      },
      take: 15,
    });

    const pastInteractions = userId ? await prisma.assistantMessage.findMany({
      where: { conversation: { userId } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }) : [];

    const userInstructions = userId ? await prisma.assistantInstruction.findMany({
      where: { userId, isActive: true },
      orderBy: { createdAt: 'asc' },
    }) : [];

    return {
      pastInteractions: pastInteractions.reverse(),
      userInstructions,
      summary: {
        totalDrones: drones,
        totalOrders: orders,
        totalFlights: flights,
        totalComponents: components,
        teamMembers: teamMembers,
        batteries: batteries,
        totalLeads: leads,
      },
      stats: {
        orderStats,
        paymentStats,
        totalContractValue,
      },
      recentOrders: recentOrders.map(o => ({
        ...o,
        contractValue: isPrivileged ? o.contractValue.toString() : 'Confidential',
        createdAt: formatDate(o.createdAt),
      })),
      criticalOrders,
      lowStockItems: lowStockComponents,
      pendingFollowUps,
      teamMembersDetails,
    };
  } catch (error) {
    console.error('Error fetching context data:', error);
    return null;
  }
}

/**
 * Builds an intelligent system prompt with rich context, schema knowledge, and instructions
 */
function buildSystemPrompt(contextData: any): string {
  const {
    summary = {},
    stats = {},
    userInstructions = [],
    pastInteractions = [],
  } = contextData || {};

  const instructionsText = userInstructions.length > 0
    ? `\n\n## Explicit User Custom Instructions\nThe user asked you to remember these rules:\n${userInstructions.map((inst: any, idx: number) => `${idx + 1}. ${inst.content}`).join('\n')}\n`
    : '';

  const pastInteractionsText = pastInteractions.length > 0
    ? `\n\n## Past Conversation Context\n${pastInteractions.map((msg: any) => `${msg.role === 'user' ? 'User' : 'Aero'}: ${msg.content}`).join('\n\n')}\n`
    : '';

  return `# Aero - AeroSky Aviation Senior Intelligence Assistant

You are Aero, the senior AI Operations & Business Intelligence Assistant for AeroSky Aviation India.
You have direct, real-time access to the company's Supabase PostgreSQL database via the \`execute_sql_query\` tool.

${DATABASE_SCHEMA_DOC}
${instructionsText}${pastInteractionsText}

## Core Rules for Data & SQL Queries:
1. **Always Fetch Real Data**: When asked about inventory, components, orders, revenues, drones, flight logs, expenses, team members, or CRM leads, DO NOT guess or hallucinate. Use the \`execute_sql_query\` tool to run an exact PostgreSQL SELECT query.
2. **Read-Only Queries**: Only write SELECT queries (or WITH ... SELECT CTEs). Never run INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, or CREATE.
3. **Table & Column Naming**: Use snake_case table and column names matching the schema (e.g., \`components\`, \`orders\`, \`flight_logs\`, \`contract_number\`, \`client_name\`, \`manufacturing_stage\`, \`quantity\`, \`unit_price\`).
4. **Markdown Tables**: When displaying lists or query results with multiple columns, format them as clean Markdown tables with aligned columns.
5. **Insights & Business Analysis**: Do not just spit out raw rows. Provide an executive summary, compute totals/averages/percentages where helpful, highlight bottlenecks or critical risks, and give actionable recommendations.
6. **Privacy & Security**: Never attempt to select password hashes, reset tokens, or private authentication secrets.

## AeroSky Aviation - Products & Services Overview:
- **VEDANSH**: Precision Surveying & Mapping Drone. DGCA Type Certified, PPK dual GPS, 24MP RGB sensor, 40 min flight time, 500g payload. Used for land surveying, mining, agriculture, disaster assessment.
- **SHAURYA**: Tactical & Professional-Grade Drone. Military-grade frame, dual GPS anti-jamming, 45 min flight time, 15km range, 2kg payload capacity, modular LiDAR & multispectral payloads. Used for defense, surveillance, critical infrastructure.
- **Services**: Aerial surveying, 3D topographic mapping, infrastructure inspection, defense monitoring, agricultural crop health.
- **Partners**: IIT Kanpur incubated, working with Ministry of Road Transport, Adani, NABARD, Delhi Police.

## High-Level Operations Snapshot:
- Fleet: ${summary.totalDrones || 0} drones, ${summary.batteries || 0} batteries
- Inventory: ${summary.totalComponents || 0} components recorded
- Orders Pipeline: ${summary.totalOrders || 0} contracts (Value: ${stats.totalContractValue === 'Confidential' ? 'Restricted' : `₹${stats.totalContractValue || '0'}`})
- Leads: ${summary.totalLeads || 0} active leads | Flights: ${summary.totalFlights || 0} logs`;
}

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user (Supports Session or JWT)
    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json(
        { error: 'Unauthorized', reply: 'Please log in to chat with Aero.' },
        { status: 401 }
      );
    }

    // 2. Validate request body
    const body = await request.json();
    const validated = assistantRequestSchema.parse(body);

    // 3. Check for explicit memory instruction (/remember, remember:)
    const lowerMsg = validated.message.toLowerCase();
    const rememberPrefixes = ['/remember', 'remember:', 'keep in memory:', 'memorize:'];
    let memoryContent = '';

    for (const prefix of rememberPrefixes) {
      if (lowerMsg.startsWith(prefix)) {
        memoryContent = validated.message.substring(prefix.length).trim();
        break;
      }
    }

    if (memoryContent) {
      await prisma.assistantInstruction.create({
        data: {
          userId: auth.user.id,
          content: memoryContent,
        }
      });
      return NextResponse.json({
        reply: "Got it! I've saved this instruction to my explicit memory. I will strictly reference it in all our future conversations.",
        success: true,
      });
    }

    // 4. Check for direct SQL query execution (/sql ..., SQL: ..., query: ...)
    const isDirectSql = lowerMsg.startsWith('/sql ') ||
      lowerMsg.startsWith('sql:') ||
      lowerMsg.startsWith('query:') ||
      (lowerMsg.startsWith('select ') && lowerMsg.includes('from '));

    if (isDirectSql) {
      const fallbackResult = await executeDeterministicFallback(validated.message, auth.user.role);
      return NextResponse.json({
        reply: fallbackResult.reply,
        success: true,
        queries: fallbackResult.queries,
      });
    }

    // 5. Get context data for prompt
    const contextData = await getContextData(auth.user.id, auth.user.role);

    // 6. Gemini Tool Calling Flow
    let responseText = '';
    const executedQueries: Array<{ query: string; rowCount: number; explanation?: string }> = [];

    if (process.env.GEMINI_API_KEY) {
      try {
        const model = genAI.getGenerativeModel({
          model: 'gemini-2.5-flash',
          tools: [
            {
              functionDeclarations: [
                {
                  name: 'execute_sql_query',
                  description: 'Executes a safe read-only SQL SELECT query against the AeroSky PostgreSQL database on Supabase to fetch accurate, real-time data.',
                  parameters: {
                    type: SchemaType.OBJECT,
                    properties: {
                      query: {
                        type: SchemaType.STRING,
                        description: 'The SQL SELECT query in PostgreSQL syntax. Must be read-only.',
                      },
                      explanation: {
                        type: SchemaType.STRING,
                        description: 'Brief explanation of what data this query fetches.',
                      },
                    },
                    required: ['query'],
                  },
                },
                {
                  name: 'get_database_schema',
                  description: 'Returns the PostgreSQL database schema documentation for AeroSky tables and columns.',
                  parameters: {
                    type: SchemaType.OBJECT,
                    properties: {
                      tableName: {
                        type: SchemaType.STRING,
                        description: 'Optional name of a specific table to inspect.',
                      },
                    },
                  },
                },
              ],
            },
          ],
          systemInstruction: buildSystemPrompt(contextData),
        });

        const conversationHistory = [
          ...validated.history.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }],
          })),
        ];

        const chat = model.startChat({
          history: conversationHistory,
          generationConfig: {
            maxOutputTokens: 2500,
            temperature: 0.4, // Lower temperature for more factual database answers
            topP: 0.9,
          },
        });

        let currentResult = await chat.sendMessage(validated.message);
        let toolTurns = 0;
        const maxToolTurns = 3;

        // Loop to execute tool calls until Gemini produces its final natural language answer
        while (toolTurns < maxToolTurns) {
          const functionCalls = currentResult.response.functionCalls();
          if (!functionCalls || functionCalls.length === 0) {
            break;
          }

          const functionResponses: Part[] = [];

          for (const fnCall of functionCalls) {
            if (fnCall.name === 'execute_sql_query') {
              const queryStr = (fnCall.args as any)?.query;
              const explanation = (fnCall.args as any)?.explanation || 'Database query';
              const sqlResult = await executeSafeSqlQuery(queryStr, { userRole: auth.user.role });

              executedQueries.push({
                query: sqlResult.query || queryStr,
                rowCount: sqlResult.rowCount || 0,
                explanation,
              });

              functionResponses.push({
                functionResponse: {
                  name: fnCall.name,
                  response: {
                    success: sqlResult.success,
                    data: sqlResult.data || [],
                    rowCount: sqlResult.rowCount || 0,
                    columns: sqlResult.columns || [],
                    error: sqlResult.error,
                  },
                },
              });
            } else if (fnCall.name === 'get_database_schema') {
              functionResponses.push({
                functionResponse: {
                  name: fnCall.name,
                  response: {
                    schema: DATABASE_SCHEMA_DOC,
                  },
                },
              });
            }
          }

          // Send tool results back to Gemini
          currentResult = await chat.sendMessage(functionResponses);
          toolTurns++;
        }

        responseText = currentResult.response.text();
      } catch (geminiError) {
        console.warn('Gemini API call failed or encountered error, falling back to deterministic SQL engine:', geminiError);
        // Seamless fallback to deterministic SQL engine
        const fallbackResult = await executeDeterministicFallback(validated.message, auth.user.role);
        responseText = fallbackResult.reply;
        executedQueries.push(...fallbackResult.queries);
      }
    } else {
      // GEMINI_API_KEY not configured: use robust deterministic SQL engine directly
      const fallbackResult = await executeDeterministicFallback(validated.message, auth.user.role);
      responseText = fallbackResult.reply;
      executedQueries.push(...fallbackResult.queries);
    }

    if (!responseText) {
      responseText = 'Unable to generate a response. Please try asking with more details.';
    }

    // 7. Save conversation to persistent memory
    try {
      if (auth?.user?.id && responseText) {
        let conversation = await prisma.assistantConversation.findFirst({
          where: { userId: auth.user.id },
          orderBy: { createdAt: 'desc' },
        });

        if (!conversation) {
          conversation = await prisma.assistantConversation.create({
            data: {
              userId: auth.user.id,
              title: validated.message.substring(0, 30),
            },
          });
        }

        await prisma.assistantMessage.createMany({
          data: [
            {
              conversationId: conversation.id,
              role: 'user',
              content: validated.message,
            },
            {
              conversationId: conversation.id,
              role: 'assistant',
              content: responseText,
            },
          ],
        });
      }
    } catch (dbErr) {
      console.error('Failed to save to Assistant Memory:', dbErr);
    }

    // 8. Return response with executed SQL queries for frontend transparency
    return NextResponse.json({
      reply: responseText,
      success: true,
      queries: executedQueries,
    });
  } catch (error) {
    console.error('Assistant route error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          reply: 'Please check your message and try again.',
          fields: error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        reply: 'Sorry, something went wrong processing your request. Please try again.',
        debug: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
      { status: 500 }
    );
  }
}
