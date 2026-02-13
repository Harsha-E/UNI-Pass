/**
 * UNI-PASS PDF GENERATOR (Enterprise Edition)
 * Generates secure, verifiable PDF passes with Real QR Code & Footer ID.
 */
import { db } from './firebase-init.js'; // Ensure firebase is init if needed, though mostly data is passed in.

export async function generateOfficialPDF(docId, data) {
    if (!window.jspdf) {
        alert("PDF Library not loaded. Please refresh.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const width = doc.internal.pageSize.getWidth();
    const height = doc.internal.pageSize.getHeight();

    // --- COLORS ---
    const BLUE = [30, 58, 138]; // Corporate Blue
    const GRAY = [100, 116, 139];
    const BLACK = [15, 23, 42];

    // 1. HEADER BRANDING
    doc.setFillColor(...BLUE);
    doc.rect(0, 0, width, 45, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("MVGR COLLEGE OF ENGINEERING", width/2, 20, {align: 'center'});
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Vizianagaram, Andhra Pradesh - 535005", width/2, 28, {align: 'center'});
    
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("OFFICIAL CAMPUS GATE PASS", width/2, 38, {align: 'center'});

    // 2. PASS META (Top Right)
    doc.setTextColor(...BLACK);
    doc.setFontSize(10);
    doc.text(`ISSUED: ${new Date().toLocaleString()}`, width - 15, 55, {align: 'right'});

    // 3. STUDENT DETAILS (Boxed)
    const startY = 65;
    doc.setDrawColor(200);
    doc.setFillColor(248, 250, 252); // Slate-50
    doc.rect(15, startY, width - 30, 90, 'FD');

    let y = startY + 10;
    const lineHeight = 14;

    function addRow(label, value) {
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...GRAY);
        doc.text(label.toUpperCase(), 25, y);
        
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...BLACK);
        doc.text(String(value || "-"), 80, y);
        
        doc.setDrawColor(230);
        doc.line(25, y + 5, width - 25, y + 5);
        y += lineHeight;
    }

    addRow("Student Name", data.student.name);
    addRow("Roll Number", data.student.rollNumber);
    addRow("Department", data.student.dept);
    addRow("Valid From", new Date(data.startDate).toDateString());
    addRow("Valid To", new Date(data.endDate).toDateString());
    addRow("Category", data.type);

    // 4. REASON / NOTES
    y += 5;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...GRAY);
    doc.text("AUTHORIZED PURPOSE / DESTINATION:", 25, y);
    y += 8;
    doc.setFont("helvetica", "italic");
    doc.setTextColor(...BLACK);
    const splitNote = doc.splitTextToSize(data.reason || "N/A", width - 60);
    doc.text(splitNote, 25, y);

    // 5. SIGNATURES
    y = 200;
    
    // Find all unique approvers from logs, maintaining order.
    const approvers = data.logs.filter(log => log.action !== 'CREATED');
    const firstApprover = approvers.length > 0 ? approvers[0] : null;
    const secondApprover = approvers.length > 1 ? approvers[1] : null;
    const thirdApprover = approvers.length > 2 ? approvers[2] : null;

    // First Signature (Teacher or Counsellor)
    if (firstApprover) {
        doc.setFont("helvetica", "bold");
        doc.text("Verified By", 40, y);
        doc.setTextColor(22, 163, 74); // Green Ink
        doc.setFont("courier", "bolditalic");
        doc.text(`[ Signed: ${firstApprover.by} ]`, 40, y + 8);
    }

    // Second Signature (HOD)
    if (secondApprover) {
        doc.setTextColor(...BLACK);
        doc.setFont("helvetica", "bold");
        doc.text("HOD", width / 2, y, {align: 'center'});
        doc.setTextColor(22, 163, 74);
        doc.setFont("courier", "bolditalic");
        doc.text(`[ Signed: ${secondApprover.by} ]`, width / 2, y + 8, {align: 'center'});
    }

    // Third Signature (Principal)
    if (approvers.length > 1) {
        doc.setTextColor(...BLACK);
        doc.setFont("helvetica", "bold");
        doc.text("Principal", width - 40, y, {align: 'right'});
        doc.setTextColor(22, 163, 74);
        doc.setFont("courier", "bolditalic");
        doc.text(`[ Signed: ${thirdApprover ? thirdApprover.by : approvers[1].by} ]`, width - 40, y + 8, {align: 'right'});
    }

    // 6. QR CODE & FOOTER ID
    const qrY = 240;
    const checkUrl = `https://harsha-e.github.io/UNI-Pass/public/checker.html?id=${docId}`;
    
    // Create Real QR Code
    const qrApi = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(checkUrl)}`;

    try {
        const img = await loadImage(qrApi);
        doc.addImage(img, 'PNG', width/2 - 20, qrY - 10, 40, 40);
    } catch (e) {
        doc.setTextColor(255, 0, 0);
        doc.text("QR LOAD ERROR", width/2, qrY + 10, {align: 'center'});
    }

    // QR Description
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text("Scan to verify authenticity.", width/2, qrY + 35, {align: 'center'});

    // --- THE FOOTER ID (EXACTLY AS REQUESTED) ---
    // This allows the guard to manually type the ID if the QR fails
    doc.setFont("courier", "bold"); 
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0); // Black for visibility
    doc.text(`PASS ID: ${docId}`, width/2, qrY + 45, {align: 'center'});

    // Save
    doc.save(`GATE_PASS_${data.rollNumber}.pdf`);
}

// Helper to load image for PDF
function loadImage(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = url;
        img.onload = () => resolve(img);
        img.onerror = reject;
    });
}

// Attach to window for global access
window.generateOfficialPDF = generateOfficialPDF;
