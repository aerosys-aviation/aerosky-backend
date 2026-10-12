import { authenticateRequest } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import * as XLSX from 'xlsx';
import { formatDate } from '@/lib/date';

export async function GET(request: NextRequest) {
    const auth = await authenticateRequest(request);
    if (!auth?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = auth.user.role;
    if (!['SUPER_ADMIN', 'ADMIN', 'ADMINISTRATION', 'SALES', 'OPERATIONS_MANAGER'].includes(userRole)) {
        return NextResponse.json({ error: 'Forbidden: Insufficient permissions to export orders' }, { status: 403 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const ids = searchParams.get('ids');
        const format = searchParams.get('format') || 'xlsx';

        console.log('Download request:', { ids, format });

        const where: any = {};

        // Security filter - removed

        if (ids && ids !== 'all') {
            where.id = { in: ids.split(',') };
        }

        const orders = await prisma.order.findMany({
            where,
            orderBy: { createdAt: 'desc' },
        });

        if (orders.length === 0) {
            return NextResponse.json({ error: 'No orders found' }, { status: 404 });
        }

        // Handle Individual PDF Download
        if (format === 'pdf' && orders.length === 1) {
            try {
                const order = orders[0];
                const doc = new jsPDF();

                // PDF Styles & Colors
                const primaryColor: [number, number, number] = [0, 0, 0]; // Black as requested
                const secondaryColor: [number, number, number] = [71, 85, 105];
                const accentColor: [number, number, number] = [59, 130, 246];

                // Header
                doc.setFillColor(0, 0, 0);
                doc.rect(0, 0, 210, 40, 'F');

                doc.setTextColor(255, 255, 255);
                doc.setFontSize(18);
                doc.setFont('helvetica', 'bold');
                doc.text('AeroSys Aviaiton India Private Limited', 15, 22);

                doc.setFontSize(9);
                doc.setFont('helvetica', 'italic');
                doc.text('Capturing moments from the new point', 15, 30);

                doc.setFontSize(12);
                doc.setFont('helvetica', 'normal');
                doc.text('ORDER SPECIFICATION SHEET', 210 - 15, 25, { align: 'right' });

                // Order Summary Box
                let currentY = 50;
                doc.setTextColor(30, 58, 138); // Keeping subtle blue for the contract ID to stand out
                doc.setFontSize(18);
                doc.text(`Contract: ${order.contractNumber}`, 15, currentY);

                doc.setDrawColor(accentColor[0], accentColor[1], accentColor[2]);
                doc.setLineWidth(0.5);
                doc.line(15, currentY + 2, 80, currentY + 2);

                currentY += 15;

                // Section 1: Core Information
                doc.setFontSize(12);
                doc.setFont('helvetica', 'bold');
                doc.text('1. CORE ORDER & FINANCIAL INFORMATION', 15, currentY);
                currentY += 5;

                const coreInfo = [
                    ['Client Name', order.clientName, 'Client Segment', order.clientSegment],
                    ['Order Date', formatDate(order.orderDate), 'Est. Completion', order.estimatedCompletionDate ? formatDate(order.estimatedCompletionDate) : 'TBD'],
                    ['Contract Value', `${order.currency} ${order.contractValue.toLocaleString()}`, 'Revenue Status', order.revenueRecognitionStatus],
                ];

                autoTable(doc, {
                    startY: currentY,
                    head: [],
                    body: coreInfo,
                    theme: 'plain',
                    styles: { fontSize: 10, cellPadding: 3 },
                    columnStyles: {
                        0: { fontStyle: 'bold', textColor: secondaryColor, cellWidth: 40 },
                        1: { cellWidth: 55 },
                        2: { fontStyle: 'bold', textColor: secondaryColor, cellWidth: 40 },
                        3: { cellWidth: 55 },
                    },
                });

                currentY = (doc as any).lastAutoTable.finalY + 10;

                // Section 2: Technical Configuration
                doc.setFont('helvetica', 'bold');
                doc.text('2. TECHNICAL & CONFIGURATION DETAILS', 15, currentY);
                currentY += 5;

                const techInfo = [
                    ['Drone Model', order.droneModel, 'Drone Type', order.droneType],
                    ['Weight Class', order.weightClass, 'Software/AI Tier', order.softwareAiTier || 'Standard'],
                    ['Payload Config', order.payloadConfiguration || 'None', 'Endurance Req.', order.flightEnduranceRequirements || 'Standard'],
                ];

                autoTable(doc, {
                    startY: currentY,
                    head: [],
                    body: techInfo,
                    theme: 'striped',
                    headStyles: { fillColor: primaryColor },
                    styles: { fontSize: 10, cellPadding: 3 },
                    columnStyles: {
                        0: { fontStyle: 'bold', textColor: secondaryColor, cellWidth: 40 },
                        1: { cellWidth: 55 },
                        2: { fontStyle: 'bold', textColor: secondaryColor, cellWidth: 40 },
                        3: { cellWidth: 55 },
                    },
                });

                currentY = (doc as any).lastAutoTable.finalY + 10;

                // Section 3: Regulatory & Operational Status
                doc.setFont('helvetica', 'bold');
                doc.text('3. REGULATORY & OPERATIONAL STATUS', 15, currentY);
                currentY += 5;

                const regInfo = [
                    ['DGCA/FAA Status', order.dgcaFaaCertificationStatus, 'UIN Number', order.uin || 'Pending'],
                    ['Export License', order.exportLicenseStatus || 'N/A', 'BOM Readiness', order.bomReadiness],
                    ['Manufacturing Stage', order.manufacturingStage, 'After-Sales/AMC', order.afterSalesAmc || 'N/A'],
                ];

                autoTable(doc, {
                    startY: currentY,
                    head: [],
                    body: regInfo,
                    theme: 'plain',
                    styles: { fontSize: 10, cellPadding: 3 },
                    columnStyles: {
                        0: { fontStyle: 'bold', textColor: secondaryColor, cellWidth: 40 },
                        1: { cellWidth: 55 },
                        2: { fontStyle: 'bold', textColor: secondaryColor, cellWidth: 40 },
                        3: { cellWidth: 55 },
                    },
                });

                currentY = (doc as any).lastAutoTable.finalY + 10;

                // Section 4: Technical Notes
                if (order.calibrationTestLogs || order.geofencingRequirements) {
                    doc.setFont('helvetica', 'bold');
                    doc.text('4. TECHNICAL NOTES & REQUIREMENTS', 15, currentY);
                    currentY += 5;

                    const notesInfo = [];
                    if (order.geofencingRequirements) notesInfo.push(['Geofencing Req.', order.geofencingRequirements]);
                    if (order.calibrationTestLogs) notesInfo.push(['Calibration Logs', order.calibrationTestLogs]);

                    autoTable(doc, {
                        startY: currentY,
                        head: [],
                        body: notesInfo,
                        theme: 'plain',
                        styles: { fontSize: 10, cellPadding: 3 },
                        columnStyles: {
                            0: { fontStyle: 'bold', textColor: secondaryColor, cellWidth: 40 },
                            1: { cellWidth: 150 },
                        },
                    });
                }

                // Footer
                const pageCount = doc.getNumberOfPages();
                for (let i = 1; i <= pageCount; i++) {
                    doc.setPage(i);
                    doc.setFontSize(8);
                    doc.setTextColor(150, 150, 150);
                    doc.text(`Generated on ${new Date().toLocaleString()} | Page ${i} of ${pageCount}`, 105, 285, { align: 'center' });
                    doc.text('AeroSys Aviation India - Official Technical Document', 105, 290, { align: 'center' });
                }

                const specSheetBuffer = doc.output('arraybuffer');

                // If COC data exists, merge it
                if (order.cocData) {
                    try {
                        console.log('COC data found, merging...');
                        const mainPdfDoc = await PDFDocument.load(specSheetBuffer);

                        // Extract base64 content
                        const cocBase64 = order.cocData.split(',')[1] || order.cocData;
                        const cocPdfDoc = await PDFDocument.load(Buffer.from(cocBase64, 'base64'));

                        // Copy pages from COC to main PDF
                        const cocPages = await mainPdfDoc.copyPages(cocPdfDoc, cocPdfDoc.getPageIndices());
                        cocPages.forEach(page => mainPdfDoc.addPage(page));

                        const mergedPdfBytes = await mainPdfDoc.save();
                        return new NextResponse(Buffer.from(mergedPdfBytes), {
                            status: 200,
                            headers: {
                                'Content-Type': 'application/pdf',
                                'Content-Disposition': `attachment; filename="Order_${order.contractNumber}.pdf"`,
                            },
                        });
                    } catch (mergeErr) {
                        console.error('Error merging COC PDF:', mergeErr);
                        // If merge fails, return just the spec sheet as fallback
                        return new NextResponse(Buffer.from(specSheetBuffer), {
                            status: 200,
                            headers: {
                                'Content-Type': 'application/pdf',
                                'Content-Disposition': `attachment; filename="Order_${order.contractNumber}_SpecOnly.pdf"`,
                            },
                        });
                    }
                }

                return new NextResponse(Buffer.from(specSheetBuffer), {
                    status: 200,
                    headers: {
                        'Content-Type': 'application/pdf',
                        'Content-Disposition': `attachment; filename="Order_${order.contractNumber}.pdf"`,
                    },
                });
            } catch (err: any) {
                console.error('PDF Generation Error:', err);
                return NextResponse.json({ error: 'Failed to generate PDF', message: err.message }, { status: 500 });
            }
        }

        // Bulk Excel Logic (Keep existing)
        const excelData = orders.map((order: any, index: number) => ({
            'S.No': index + 1,
            'Contract Number': order.contractNumber,
            'Client Name': order.clientName,
            'Client Segment': order.clientSegment,
            'Order Date': order.orderDate ? formatDate(order.orderDate) : '',
            'Est. Completion Date': order.estimatedCompletionDate ? formatDate(order.estimatedCompletionDate) : '',
            'Contract Value': order.contractValue,
            'Currency': order.currency,
            'Revenue Status': order.revenueRecognitionStatus,
            'Drone Model': order.droneModel,
            'Drone Type': order.droneType,
            'Weight Class': order.weightClass,
            'Payload Config': order.payloadConfiguration || '',
            'Flight Endurance': order.flightEnduranceRequirements || '',
            'Software/AI Tier': order.softwareAiTier || '',
            'DGCA/FAA Status': order.dgcaFaaCertificationStatus,
            'UIN': order.uin || '',
            'Export License': order.exportLicenseStatus || '',
            'Geofencing': order.geofencingRequirements || '',
            'BOM Readiness': order.bomReadiness,
            'Manufacturing Stage': order.manufacturingStage,
            'Calibration Logs': order.calibrationTestLogs || '',
            'After-Sales/AMC': order.afterSalesAmc || '',
            'Created At': order.createdAt ? formatDate(order.createdAt) : '',
        }));

        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(excelData);

        const colWidths = [
            { wch: 5 }, { wch: 18 }, { wch: 25 }, { wch: 15 }, { wch: 12 }, { wch: 18 },
            { wch: 15 }, { wch: 8 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 12 },
            { wch: 18 }, { wch: 18 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
            { wch: 18 }, { wch: 12 }, { wch: 18 }, { wch: 25 }, { wch: 20 }, { wch: 12 },
        ];
        worksheet['!cols'] = colWidths;

        XLSX.utils.book_append_sheet(workbook, worksheet, 'Orders');
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        return new NextResponse(buffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="OrderBook_${new Date().toISOString().split('T')[0]}.xlsx"`,
            },
        });
    } catch (error) {
        console.error('General Download Error:', error);
        return NextResponse.json({ error: 'Failed to generate download' }, { status: 500 });
    }
}
