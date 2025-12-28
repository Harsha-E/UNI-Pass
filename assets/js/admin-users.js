import { db, auth } from '/assets/js/firebase-init.js';
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  query,
  orderBy,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { sendPasswordResetEmail } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

const userList = document.getElementById('userList');

function canApprove(currentRole, targetRole) {
  const hierarchy = { admin: ['hod', 'teacher', 'student'], hod: ['teacher', 'student'], teacher: ['student'] };
  return hierarchy[currentRole]?.includes(targetRole) || false;
}

function el(tag, attrs = {}, ...children){
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k,v])=>{ if(k==='class') node.className=v; else node.setAttribute(k,v); });
  children.forEach(c=>{ if(typeof c==='string') node.appendChild(document.createTextNode(c)); else if(c) node.appendChild(c); });
  return node;
}

async function loadUsers(){
  userList.textContent = 'Loading...';
  const currentRole = sessionStorage.getItem('role');
  const q = query(collection(db,'users'), orderBy('createdAt','desc'));
  const snap = await getDocs(q);
  const rows = snap.docs.map(d=>({ id: d.id, ...d.data() }));

  if(rows.length===0){ userList.textContent='No users found.'; return; }

  const table = el('table',{class:'admin-table'});
  const thead = el('thead',{}, el('tr',{}, el('th',{},'Email'), el('th',{},'Role'), el('th',{},'Dept'), el('th',{},'Approved'), el('th',{},'Disabled'), el('th',{},'Actions')));
  table.appendChild(thead);
  const tbody = el('tbody');

  for(const u of rows){
    const tr = el('tr',{},
      el('td',{}, u.email || ''),
      el('td',{}, u.role || ''),
      el('td',{}, u.department || ''),
      el('td',{}, String(!!u.approved)),
      el('td',{}, String(!!u.disabled)),
      el('td',{}, '')
    );

    // Actions
    const approveBtn = el('button', {class:'btn small'}, 'Approve');
    approveBtn.addEventListener('click', async ()=>{
      if (!canApprove(currentRole, u.role)) {
        alert('You cannot approve this role.');
        return;
      }
      await updateDoc(doc(db,'users',u.id), { approved: true, approvedAt: serverTimestamp() });
      loadUsers();
    });

    const disableBtn = el('button', {class:'btn small danger'}, u.disabled ? 'Enable' : 'Disable');
    disableBtn.addEventListener('click', async ()=>{
      await updateDoc(doc(db,'users',u.id), { disabled: !u.disabled });
      loadUsers();
    });

    const notifyBtn = el('button', {class:'btn small secondary'}, 'Notify');
    notifyBtn.addEventListener('click', async ()=>{
      try{
        await sendPasswordResetEmail(auth, u.email);
        alert('Notification (password-reset) sent to ' + u.email + '.');
      }catch(e){
        alert('Could not send email via Auth. Consider Cloud Function for email notifications.');
      }
    });

    const actionTd = tr.querySelector('td:last-child');
    if (actionTd) {
      actionTd.appendChild(approveBtn);
      actionTd.appendChild(disableBtn);
      actionTd.appendChild(notifyBtn);
    }

    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  userList.innerHTML = '';
  userList.appendChild(table);
}

loadUsers();
