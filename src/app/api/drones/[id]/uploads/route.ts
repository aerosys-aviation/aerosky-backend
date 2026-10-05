import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/api-auth";
import { checkResourceAccess } from "@/lib/authorize";

const ALLOWED_UPLOAD_TYPES = [
    "training_manual",
    "system_design",
    "infrastructure_manufacturing",
    "infrastructure_testing",
    "infrastructure_office",
    "regulatory_display",
    "hardware_security",
];

const ALLOWED_MIME_TYPES = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
];

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

function validateFileEntry(file: any): { valid: boolean; error?: string } {
    if (!file) {
        return { valid: false, error: "Empty file payload." };
    }

    if (typeof file === "string") {
        // Check for data URI pattern
        const dataUriMatch = file.match(/^data:([a-zA-Z0-9\/+-]+);base64,/);
        if (dataUriMatch) {
            const mime = dataUriMatch[1].toLowerCase();
            if (!ALLOWED_MIME_TYPES.includes(mime)) {
                return { valid: false, error: `Invalid file type: ${mime}. Allowed types: PDF, JPEG, PNG, WebP.` };
            }
        }
        // Check size (base64 length * 0.75 gives approx byte size)
        const approxBytes = Math.round(file.length * 0.75);
        if (approxBytes > MAX_FILE_SIZE_BYTES) {
            return { valid: false, error: "File exceeds the 10MB size limit." };
        }
        return { valid: true };
    }

    if (typeof file === "object" && file !== null) {
        if (file.size && file.size > MAX_FILE_SIZE_BYTES) {
            return { valid: false, error: "File exceeds the 10MB size limit." };
        }
        if (file.type && !ALLOWED_MIME_TYPES.includes(file.type.toLowerCase())) {
            return { valid: false, error: `Invalid file type: ${file.type}. Allowed types: PDF, JPEG, PNG, WebP.` };
        }
        return { valid: true };
    }

    return { valid: false, error: "Unsupported file payload format." };
}

// POST upload files for a drone
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await authenticateRequest(request);
    if (!auth) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const permCheck = checkResourceAccess(auth.user, 'drone', 'edit');
    if (permCheck !== true) return permCheck;

    try {
        const { id } = await params;

        // Verify drone exists
        const drone = await prisma.drone.findUnique({
            where: { id },
            select: { id: true },
        });

        if (!drone) {
            return NextResponse.json({ error: "Drone not found" }, { status: 404 });
        }
        
        // Handle both standard multipart/form-data and JSON
        const contentType = request.headers.get("content-type") || "";
        let uploadType: string = "";
        let files: any;
        let label: string | undefined;

        if (contentType.includes("multipart/form-data")) {
            const formData = await request.formData();
            uploadType = (formData.get("uploadType") as string) || "";
            label = (formData.get("label") as string) || undefined;
            
            const allFiles = formData.getAll("files");
            files = allFiles.length > 1 ? allFiles : allFiles[0];
        } else {
            const body = await request.json();
            uploadType = body.uploadType;
            files = body.files;
            label = body.label;
        }

        if (!uploadType || !files) {
            return NextResponse.json({ error: "Missing upload data (uploadType and files are required)" }, { status: 400 });
        }

        if (!ALLOWED_UPLOAD_TYPES.includes(uploadType)) {
            return NextResponse.json({ error: `Invalid uploadType: ${uploadType}` }, { status: 400 });
        }

        // Validate files (size and MIME type)
        const fileList = Array.isArray(files) ? files : [files];
        for (const f of fileList) {
            const validation = validateFileEntry(f);
            if (!validation.valid) {
                return NextResponse.json({ error: validation.error }, { status: 400 });
            }
        }

        // Delete existing uploads of this type for single file types or array types
        await prisma.droneUpload.deleteMany({
            where: { droneId: id, uploadType },
        });

        // Create new uploads
        if (Array.isArray(files)) {
            await prisma.droneUpload.createMany({
                data: files.map((f: any) => ({
                    droneId: id,
                    uploadType,
                    fileData: typeof f === 'string' ? f : (f.name || 'file_data'),
                    label: label || null,
                })),
            });
        } else {
            await prisma.droneUpload.create({
                data: {
                    droneId: id,
                    uploadType,
                    fileData: typeof files === 'string' ? files : (files.name || 'file_data'),
                    label: label || null,
                },
            });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Critical: Error uploading files:", error?.message);
        if (error?.message?.includes("prisma") || error?.message?.includes("client")) {
            return NextResponse.json({ 
                error: "Database error. Please try again later.",
            }, { status: 500 });
        }
        return NextResponse.json({ error: "Failed to process upload." }, { status: 500 });
    }
}
