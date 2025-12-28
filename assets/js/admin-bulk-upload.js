import { auth, db } from './firebase-init.js';

document.getElementById('csv-upload').addEventListener('change', handleFileUpload);

async function handleFileUpload(event) {
    const file = event.target.files[0];
    const reader = new FileReader();

    reader.onload = async (e) => {
        const text = e.target.result;
        const rows = text.split('\n').slice(1); // Skip header

        let successCount = 0;
        const logArea = document.getElementById('upload-logs');

        for (const row of rows) {
            const [name, email, rollNo, dept, role] = row.split(','); // Assumes CSV format
            
            if (!email || !rollNo) continue;

            try {
                // 1. Create Auth User (Backend function usually required, but simulated here via Firestore trigger)
                // Since client SDK cannot create *other* users easily, we write to a 'temp_users' collection
                // and let a Cloud Function handle the Auth creation.
                
                await db.collection('users').doc(rollNo.trim()).set({
                    displayName: name.trim(),
                    email: email.trim(),
                    department: dept.trim(),
                    role: role ? role.trim().toLowerCase() : 'student',
                    createdAt: new Date().toISOString()
                });

                successCount++;
                logArea.innerText += `✅ Queued: ${name} (${rollNo})\n`;
                
            } catch (err) {
                logArea.innerText += `❌ Failed: ${row} - ${err.message}\n`;
            }
        }
        alert(`Processed ${successCount} records.`);
    };

    reader.readAsText(file);
}