/*
 Admin Bulk User Upload
 Supports: CSV, XLS, XLSX
 Creates Firestore user docs (NO Auth creation yet)
*/

import { db } from "/assets/js/firebase-init.js";
import {
 doc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* ====== REQUIRED COLUMNS ======
 email, role, department
 role ∈ student | teacher | hod | admin
================================ */

const fileInput = document.querySelector('input[type="file"]');
const uploadBtn = document.getElementById('upload');

fileInput.addEventListener("change", async e => {
 const file = e.target.files[0];
 if (!file) return;

 const ext = file.name.split(".").pop().toLowerCase();
 let rows = [];

 try {
   if (ext === "csv") {
     rows = await parseCSV(file);
   } else if (ext === "xls" || ext === "xlsx") {
     rows = await parseXLS(file);
   } else {
     alert("Unsupported file format. Please use CSV, XLS, or XLSX.");
     return;
   }

   if (rows.length === 0) {
     alert("No data found in file.");
     return;
   }

   await processRows(rows);
   alert("Upload completed");
 } catch (error) {
   console.error("Upload failed:", error);
   alert("Upload failed: " + error.message);
 }
});

/* ====== PROCESS ROWS ====== */
async function processRows(rows){
 for(const r of rows){
   if(!r.email || !r.role) continue;
    const fakeUid = btoa(r.email).replace(/=/g,""); // temp UID until Auth creation
    const autoApprove = document.getElementById('autoApprove')?.checked === true;

    await setDoc(doc(db,"users",fakeUid),{
      email: r.email.trim(),
      role: r.role.trim().toLowerCase(),
      department: r.department || null,
      approved: !!autoApprove,
      firstLogin: true,
      disabled: false,
      createdAt: serverTimestamp()
    });
 }
}

/* ====== CSV PARSER ====== */
function parseCSV(file){
 return new Promise(res=>{
   const reader=new FileReader();
   reader.onload=()=>{
     const lines=reader.result.split("\n");
     const headers=lines.shift().split(",").map(h=>h.trim());
     const data=lines.map(l=>{
       const obj={};
       l.split(",").forEach((v,i)=>obj[headers[i]]=v.trim());
       return obj;
     });
     res(data);
   };
   reader.readAsText(file);
 });
}

/* ====== XLS / XLSX PARSER ======
 Requires SheetJS CDN in admin.html:
 <script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>
================================ */
function parseXLS(file){
 return new Promise(res=>{
   const reader=new FileReader();
   reader.onload=e=>{
     const wb=XLSX.read(e.target.result,{type:"binary"});
     const sheet=wb.Sheets[wb.SheetNames[0]];
     res(XLSX.utils.sheet_to_json(sheet));
   };
   reader.readAsBinaryString(file);
 });
}
