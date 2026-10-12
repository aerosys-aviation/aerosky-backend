import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/api-auth";
import { checkResourceAccess } from "@/lib/authorize";
import { createDroneSchema } from "@/lib/schemas";

// GET all drones with uploads
export async function GET(request: NextRequest) {
    const auth = await authenticateRequest(request);
    if (!auth) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const permCheck = checkResourceAccess(auth.user, 'drone', 'view');
    if (permCheck !== true) return permCheck;

    try {
        const { searchParams } = new URL(request.url);
        const includeUploads = searchParams.get('includeUploads') === 'true';

        const drones = await prisma.drone.findMany({
            include: {
                uploads: includeUploads,
                accountableManager: true,
                manufacturedUnits: true,
            },
            orderBy: { createdAt: "desc" },
        });

        // Transform uploads to match frontend format
        const transformedDrones = drones.map((drone) => {
            const uploads = includeUploads && drone.uploads ? {
                trainingManual: drone.uploads.find((u) => u.uploadType === "training_manual")?.fileData,
                infrastructureManufacturing: drone.uploads
                    .filter((u) => u.uploadType === "infrastructure_manufacturing")
                    .map((u) => u.fileData),
                infrastructureTesting: drone.uploads
                    .filter((u) => u.uploadType === "infrastructure_testing")
                    .map((u) => u.fileData),
                infrastructureOffice: drone.uploads
                    .filter((u) => u.uploadType === "infrastructure_office")
                    .map((u) => u.fileData),
                infrastructureOthers: drone.uploads
                    .filter((u) => u.uploadType === "infrastructure_others")
                    .map((u) => ({ label: u.label || "", image: u.fileData })),
                regulatoryDisplay: drone.uploads
                    .filter((u) => u.uploadType === "regulatory_display")
                    .map((u) => u.fileData),
                systemDesign: drone.uploads.find((u) => u.uploadType === "system_design")?.fileData,
                hardwareSecurity: drone.uploads
                    .filter((u) => u.uploadType === "hardware_security")
                    .map((u) => u.fileData),
                webPortalLink: drone.webPortalLink,
            } : {
                webPortalLink: drone.webPortalLink,
            };

            return {
                id: drone.id,
                modelName: drone.modelName,
                image: drone.image,
                accountableManagerId: drone.accountableManagerId,
                createdAt: drone.createdAt.toISOString(),
                uploads,
                manufacturedUnits: drone.manufacturedUnits.map((u) => ({
                    serialNumber: u.serialNumber,
                    uin: u.uin,
                })),
                recurringData: drone.recurringData,
            };
        });

        return NextResponse.json(transformedDrones);
    } catch (error) {
        console.error("Error fetching drones:", error);
        return NextResponse.json({ error: "Failed to fetch drones" }, { status: 500 });
    }
}

// POST create drone
export async function POST(request: NextRequest) {
    const auth = await authenticateRequest(request);
    if (!auth) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const permCheck = checkResourceAccess(auth.user, 'drone', 'create');
    if (permCheck !== true) return permCheck;

    try {
        const body = await request.json();
        const validation = createDroneSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json(
                { error: "Validation failed", details: validation.error.format() },
                { status: 400 }
            );
        }

        const { modelName, image, manufacturedUnits } = validation.data;

        const drone = await prisma.drone.create({
            data: {
                modelName,
                image: image || null,
                manufacturedUnits: {
                    create: (manufacturedUnits || []).map((unit) => ({
                        serialNumber: unit.serialNumber,
                        uin: unit.uin,
                    })),
                },
            },
            include: {
                manufacturedUnits: true,
            },
        });

        return NextResponse.json({
            id: drone.id,
            modelName: drone.modelName,
            image: drone.image,
            accountableManagerId: drone.accountableManagerId,
            createdAt: drone.createdAt.toISOString(),
            manufacturedUnits: drone.manufacturedUnits.map((u) => ({
                serialNumber: u.serialNumber,
                uin: u.uin,
            })),
            uploads: {
                infrastructureManufacturing: [],
                infrastructureTesting: [],
                infrastructureOffice: [],
                infrastructureOthers: [],
                regulatoryDisplay: [],
                hardwareSecurity: [],
            },
        }, { status: 201 });
    } catch (error) {
        console.error("Error creating drone:", error);
        return NextResponse.json({ error: "Failed to create drone" }, { status: 500 });
    }
}
