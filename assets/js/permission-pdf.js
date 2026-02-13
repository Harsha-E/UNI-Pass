/**
 * UNI-PASS PDF GENERATOR
 * Simple, Functional Version
 * Features:
 * - Nested Schema Support (Fixes "Undefined" errors)
 * - Dynamic Signatures (1, 2, or 3 signers based on approval)
 * - Fixed Principal Name: Dr. Y.M.C. Sekhar
 */
import { db } from './firebase-init.js';

export async function generateOfficialPDF(docId, data) {
    if (!window.jspdf) {
        alert("PDF Library not loaded. Please refresh.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const width = doc.internal.pageSize.getWidth();

    // --- COLORS ---
    const BLUE = [30, 58, 138]; 
    const GRAY = [100, 116, 139];
    const BLACK = [15, 23, 42];
    const GREEN_INK = [22, 163, 74];

    // 1. HEADER
    doc.setFillColor(...BLUE);
    doc.rect(0, 0, width, 45, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("MVGR COLLEGE OF ENGINEERING", width / 2, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Vizianagaram, Andhra Pradesh - 535005", width / 2, 28, { align: 'center' });
    
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("OFFICIAL CAMPUS GATE PASS", width / 2, 38, { align: 'center' });

    // 2. META DATA
    doc.setTextColor(...BLACK);
    doc.setFontSize(10);
    doc.text(`ISSUED: ${new Date().toLocaleString()}`, width - 15, 55, { align: 'right' });

    // 3. STUDENT DETAILS (Simple Box)
    const startY = 65;
    doc.setDrawColor(200);
    doc.setFillColor(248, 250, 252);
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

    // Access nested student data correctly
    const sName = data.student?.name || data.studentName || "Unknown";
    const sRoll = data.student?.rollNumber || data.rollNumber || "N/A";
    const sDept = data.student?.dept || data.department || "General";
    const sType = data.type || data.reasonType || "General";

    addRow("Student Name", sName);
    addRow("Roll Number", sRoll);
    addRow("Department", sDept);
    addRow("Valid From", new Date(data.startDate).toDateString());
    addRow("Valid To", new Date(data.endDate).toDateString());
    addRow("Category", sType);

    // 4. REASON
    y += 5;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...GRAY);
    doc.text("AUTHORIZED PURPOSE / DESTINATION:", 25, y);
    y += 8;
    doc.setFont("helvetica", "italic");
    doc.setTextColor(...BLACK);
    const splitNote = doc.splitTextToSize(data.reason || "N/A", width - 60);
    doc.text(splitNote, 25, y);

    // 5. SIGNATURES (Logic for 1, 2, or 3 signers)
    y = 215;
    const approvers = [];

    // --- Resolve Teacher ---
    let teacherName = data.approvals?.teacher?.name;
    if (!teacherName) {
        const log = data.logs?.find(l => 
            ['VERIFIED', 'ENDORSED', 'APPROVED'].includes(l.action) && 
            l.by !== 'Student' && 
            !l.by.includes('Sekhar')
        );
        teacherName = log ? log.by : "Class Teacher";
    }
    approvers.push({ title: "Class Teacher", name: teacherName });

    // --- Resolve HOD ---
    const isHodPath = data.routingPath?.includes('HOD') && data.status === 'APPROVED';
    if (data.approvals?.hod || isHodPath) {
        let hodName = data.approvals?.hod?.name;
        if (!hodName || hodName === "Head of Dept") {
            const log = data.logs?.find(l => 
                (l.action === 'APPROVED' || l.action === 'ENDORSED') && 
                l.by !== teacherName && 
                !l.by.includes('Sekhar')
            );
            hodName = log ? log.by : "Head of Dept";
        }
        approvers.push({ title: "Head of Dept", name: hodName });
    }

    // --- Resolve Principal ---
    const isPrincipalPath = data.routingPath?.includes('PRINCIPAL') && data.status === 'APPROVED';
    if (data.approvals?.principal || isPrincipalPath) {
        approvers.push({ title: "Principal", name: "Dr. Y.M.C. Sekhar" });
    }

    // Render Signatures
    const sectionWidth = width / approvers.length;
    approvers.forEach((signer, index) => {
        const cx = (index * sectionWidth) + (sectionWidth / 2);
        
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(...BLACK);
        doc.text(signer.title.toUpperCase(), cx, y, { align: 'center' });
        
        doc.setTextColor(...GREEN_INK);
        doc.setFont("courier", "bolditalic");
        doc.setFontSize(11);
        doc.text(`[ Signed: ${signer.name} ]`, cx, y + 8, { align: 'center' });
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...GRAY);
        doc.text("Digitally Verified", cx, y + 13, { align: 'center' });
    });

    // 6. QR CODE & FOOTER
    const qrY = 245;
    const checkUrl = `https://harsha-e.github.io/UNI-Pass/public/checker.html?id=${docId}`;
    const qrApi = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(checkUrl)}`;

    try {
        const img = await loadImage(qrApi);
        doc.addImage(img, 'PNG', width / 2 - 20, qrY - 15, 40, 40);
    } catch (e) {
        doc.setTextColor(255, 0, 0);
        doc.text("QR ERROR", width / 2, qrY, { align: 'center' });
    }

    doc.setFont("courier", "bold"); 
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0); 
    doc.text(`PASS ID: ${docId}`, width / 2, qrY + 35, { align: 'center' });

    doc.save(`GATE_PASS_${sRoll}.pdf`);
}

function loadImage(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = url;
        img.onload = () => resolve(img);
        img.onerror = reject;
    });
}

window.generateOfficialPDF = generateOfficialPDF;