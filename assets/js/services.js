/**
 * assets/js/services.js
 * Handles Third-Party Integrations (EmailJS & Google Calendar)
 */

// --- 1. EMAIL NOTIFICATIONS (via EmailJS) ---
// REGISTER HERE FOR FREE: https://www.emailjs.com/
// 1. Create Account -> Add Service (Gmail) -> Add Template
// 2. Get Public Key, Service ID, Template ID

export const sendEmail = async (studentEmail, studentName, status, reason) => {
    // Check if EmailJS is loaded
    if (!window.emailjs) {
        console.warn("EmailJS not loaded. Skipping email.");
        return;
    }

    // Initialize (Replace with YOUR_PUBLIC_KEY from EmailJS Dashboard)
    emailjs.init("YOUR_PUBLIC_KEY_HERE"); 

    const templateParams = {
        to_email: studentEmail,
        to_name: studentName,
        status: status, // "APPROVED" or "REJECTED"
        message: `Your gate pass request for '${reason}' has been ${status}.`,
        link: "https://harsha-e.github.io/UNI-Pass/portals/student/portalB.html"
    };

    try {
        // Replace with YOUR_SERVICE_ID and YOUR_TEMPLATE_ID
        await emailjs.send('service_gmail', 'template_gatepass', templateParams);
        console.log(`📧 Email sent to ${studentEmail}`);
        return true;
    } catch (error) {
        console.error("❌ Email Failed:", error);
        return false;
    }
};

// --- 2. GOOGLE CALENDAR INTEGRATION ---
export const addToGoogleCalendar = (data) => {
    // Format dates for Google (YYYYMMDDTHHmmssZ)
    // We assume dates are stored as ISO strings or similar in Firestore
    const start = new Date(data.startDate).toISOString().replace(/-|:|\.\d\d\d/g, "");
    const end = new Date(data.endDate).toISOString().replace(/-|:|\.\d\d\d/g, "");

    const title = encodeURIComponent(`Gate Pass: ${data.reasonType}`);
    const details = encodeURIComponent(`Approved Gate Pass.\nReason: ${data.reason}\nRef ID: ${data.id}`);
    const location = encodeURIComponent("MVGR College Main Gate");

    // Construct the Dynamic Link
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${details}&location=${location}&sf=true&output=xml`;

    // Open in new tab
    window.open(url, '_blank');
};
