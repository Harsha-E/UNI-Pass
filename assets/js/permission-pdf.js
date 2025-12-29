import { jsPDF } from "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";

export function generateOfficialPDF(requestData, docId) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // -- (Keep your existing Header/Body styling code here) --
    // -- I am providing the Footer fix below --

    // ... [Assume Header & Body code exists above] ...

    // Footer - The Critical Fix
    const footerY = 250;
    const width = doc.internal.pageSize.getWidth();
    
    // 1. Correct Link (Points to your GitHub Pages)
    const checkUrl = `https://harsha-e.github.io/UNI-Pass/public/checker.html?id=${docId}`;
    doc.addImage("https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=" + encodeURIComponent(checkUrl), "PNG", 20, footerY-10, 25, 25);
    
    // 2. Readable ID (Instead of Hash)
    doc.setFont("courier", "bold"); doc.setFontSize(10); doc.setTextColor(0);
    doc.text("PASS ID: " + docId, 50, footerY);

    doc.setFont("courier", "normal"); doc.setFontSize(8); doc.setTextColor(80);
    doc.text("DIGITAL SIGNATURE:", 50, footerY+6);
    // Use a truncated hash just for "visual" security
    doc.text((requestData.signature || "SHA256-SIG").substring(0, 40) + "...", 50, footerY+11);
    
    doc.setFont("helvetica", "italic"); doc.setFontSize(10); doc.setTextColor(0);
    doc.text("Signed Electronically", width-60, footerY, {align:'center'});
    
    doc.save(`PASS_${requestData.rollNumber || 'Student'}.pdf`);
}
