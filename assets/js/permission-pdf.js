/**
 * UNI-PASS PDF GENERATOR
 */
import { db } from './firebase-init.js';

// 1. Crypto Engine
async function generateDigitalSignature(data) {
    const rawString = `${data.studentID}|${data.startDate}|${data.endDate}|${data.status}|${data.timestamp}`;
    const encoder = new TextEncoder();
    const encoded = encoder.encode(rawString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}


window.generateOfficialPDF = async function(docId, data) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const width = doc.internal.pageSize.getWidth();

    // --- 1. PREPARE DATA ---
    const rollNo = data.rollNumber || (data.studentID ? data.studentID.substring(0,10).toUpperCase() : "UNKNOWN");
    const dept = data.department ? data.department.toUpperCase() : "ENGINEERING";

    // --- 2. ENSURE SIGNATURE EXISTS (For the text at the bottom) ---
    let finalSignature = data.digitalSignature;
    if (!finalSignature) {
        finalSignature = await generateDigitalSignature(data);
        await db.collection('permissions').doc(docId).update({ digitalSignature: finalSignature });
    }

    // --- 3. HEADER ---
    doc.setFillColor(30, 58, 138); 
    doc.rect(0, 0, width, 45, 'F');
    doc.setTextColor(255);
    doc.setFont("helvetica", "bold"); doc.setFontSize(20);
    doc.text("MVGR COLLEGE OF ENGINEERING", width/2, 20, {align: 'center'});
    doc.setFontSize(12); doc.setFont("helvetica", "normal");
    doc.text("OFFICIAL CAMPUS GATE PASS", width/2, 35, {align: 'center'});

    // --- 4. STATUS ---
    const approverEvent = data.workflowHistory?.find(e => e.step === 'APPROVED');
    const approverName = approverEvent ? approverEvent.actor.toUpperCase() : "AUTHORIZED FACULTY";

    doc.setFillColor(220, 252, 231); doc.setDrawColor(22, 163, 74);
    doc.roundedRect(15, 55, width - 30, 20, 2, 2, 'FD');
    doc.setTextColor(22, 163, 74); doc.setFontSize(12); doc.setFont("helvetica", "bold");
    doc.text(`STATUS: APPROVED BY ${approverName}`, width/2, 68, {align: 'center'});

    // --- 5. DETAILS ---
    doc.setDrawColor(200); doc.setFillColor(250, 250, 250);
    doc.rect(15, 85, width - 30, 100, 'FD');

    let y = 100;
    function addRow(lbl, val) {
        doc.setTextColor(100); doc.setFontSize(10); doc.text(lbl.toUpperCase(), 25, y);
        doc.setTextColor(0); doc.setFontSize(12); doc.text(val || "-", 80, y);
        doc.line(25, y+4, width - 25, y+4);
        y += 15;
    }

    addRow("Student Name", data.studentName);
    addRow("Roll Number", rollNo);
    addRow("Department", dept);
    addRow("Section", data.section || "A");
    addRow("Valid From", new Date(data.startDate).toDateString());
    addRow("Valid To", new Date(data.endDate).toDateString());
    addRow("Reason Type", data.reasonType);

    // Reason
    doc.setTextColor(100); doc.setFontSize(10); doc.text("NOTE / DESTINATION:", 25, y+5);
    doc.setTextColor(50); doc.setFont("helvetica", "italic");
    const splitText = doc.splitTextToSize(data.reason || "N/A", width - 50);
    doc.text(splitText, 25, y+12);

    // --- 6. FOOTER & QR CODE (SIMPLIFIED) ---
    const footerY = 250;
    
    // SIMPLE URL: Just the ID. No hash key.
    const checkUrl = `https://harsha-e.github.io/UNI-Pass/public/checker.html?id=${docId}`;
    
    // Use QuickChart with the SHORT URL (High Reliability)
    const qrApiUrl = `https://quickchart.io/qr?text=${encodeURIComponent(checkUrl)}&size=200&ecLevel=L&margin=1`;

    try {
        doc.addImage(qrApiUrl, "PNG", 20, footerY-10, 25, 25);
    } catch (e) {
        doc.text("QR ERROR", 25, footerY);
    }

    // Print Hash Text (For looks only)
    doc.setFont("courier", "normal"); doc.setFontSize(8); doc.setTextColor(80);
    doc.text("DIGITAL HASH:", 50, footerY);
    doc.text(finalSignature.substring(0, 60), 50, footerY+5);
    doc.text(finalSignature.substring(60), 50, footerY+10);
    
    doc.setFont("helvetica", "italic"); doc.setFontSize(10); doc.setTextColor(0);
    doc.text("Signed Electronically", width-60, footerY, {align:'center'});
    
    doc.save(`PASS_${rollNo}.pdf`);
};
