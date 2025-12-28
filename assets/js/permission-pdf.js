import { jsPDF } from "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.es.min.js";
import QRCode from "https://cdn.jsdelivr.net/npm/qrcode@1.5.4/+esm";

export async function generatePermissionPDF(data) {
  const pdf = new jsPDF("p", "mm", "a4");

  pdf.setFillColor(30, 41, 59);
  pdf.rect(0, 0, 210, 32, "F");

  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(18);
  pdf.text("UNI PASS", 105, 20, { align: "center" });

  pdf.setTextColor(0, 0, 0);
  pdf.setFontSize(11);

  let y = 45;

  const row = (l, r) => {
    pdf.text(l, 20, y);
    pdf.text(r, 110, y);
    y += 8;
  };

  row("Student Name", data.name);
  row("Registration No", data.regd);
  row("Department", data.department);
  y += 4;
  row("Permission Scope", data.scope);
  row("Reason", data.reason);
  y += 4;
  row("Permission ID", data.permissionId);
  row("Status", "AUTHORIZED");
  y += 4;
  row("Valid From", data.validFrom);
  row("Valid Till", data.validTill);
  y += 4;
  row("Requested At", data.requestedAt);
  row("Recommended By", data.recommendedBy);
  row("Authorized By", data.authorizedBy);
  row("Authorized At", data.authorizedAt);

  const qrData = await QRCode.toDataURL(
    `${data.verifyUrl}?pid=${data.permissionId}`
  );

  pdf.addImage(qrData, "PNG", 70, y + 10, 70, 70);

  pdf.setFontSize(9);
  pdf.text(
    "Scan QR to verify permission status in real-time",
    105,
    y + 90,
    { align: "center" }
  );

  pdf.setDrawColor(180);
  pdf.line(20, 265, 190, 265);

  pdf.setFontSize(8);
  pdf.text(
    "This is a system-generated authorization certificate. Firestore is the source of truth.",
    105,
    275,
    { align: "center" }
  );

  pdf.save(`UniPass_${data.permissionId}.pdf`);
}
