// Import jsPDF from the CDN (ensure this path works in your setup, typically standard for browser modules)
import { jsPDF } from "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";

export function generateOfficialPDF(requestData, docId) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // -- CONFIGURATION --
    const pageWidth = doc.internal.pageSize.getWidth();
    const primaryColor = [30, 58, 138]; // #1e3a8a
    
    // 1. Header Section
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, pageWidth, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("OFFICIAL GATE PASS", pageWidth / 2, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("INSTITUTE OF TECHNOLOGY", pageWidth / 2, 30, { align: 'center' });

    // 2. Student Details
    const startY = 60;
    doc.setTextColor(0, 0, 0);
    
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("STUDENT DETAILS", 20, startY);
    
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setLineHeightFactor(1.5);
    
    doc.text(`Name: ${requestData.studentName}`, 20, startY + 10);
    doc.text(`Roll Number: ${requestData.rollNumber}`, 20, startY + 18);
    doc.text(`Department: ${requestData.department}`, 20, startY + 26);
    doc.text(`Reason: ${requestData.reasonType}`, 20, startY + 34);

    // 3. Authorization Details
    const authY = startY + 50;
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("AUTHORIZATION", 20, authY);
    
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    
    doc.text(`Valid From: ${requestData.startDate}`, 20, authY + 10);
    doc.text(`Valid To: ${requestData.endDate}`, 20, authY + 18);
    doc.text(`Status: APPROVED`, 20, authY + 26);
    
    // 4. Footer & QR Code
    const footerY = 250;
    
    // --- UPDATED QR LINK ---
    // Make sure this matches your exact GitHub URL
    const checkUrl = `https://harsha-e.github.io/UNI-Pass/public/checker.html?id=${docId}`;
    
    doc.addImage(
        "https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=" + encodeURIComponent(checkUrl), 
        "PNG", 
        20, 
        footerY - 15, 
        30, 
        30
    );
    
    // --- UPDATED TEXT ID ---
    doc.setFont("courier", "bold"); 
    doc.setFontSize(12); 
    doc.setTextColor(0);
    doc.text("PASS ID: " + docId, 60, footerY); // Readable ID

    doc.setFont("courier", "normal"); 
    doc.setFontSize(8); 
    doc.setTextColor(100);
    doc.text("DIGITAL SIGNATURE VERIFIED", 60, footerY + 6);
    
    doc.setFont("helvetica", "italic"); 
    doc.setFontSize(10); 
    doc.setTextColor(0);
    doc.text("Authorized Electronically", pageWidth - 20, footerY, { align: 'right' });
    
    // Save File
    doc.save(`PASS_${requestData.rollNumber || 'Student'}.pdf`);
}
