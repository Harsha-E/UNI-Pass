# UNI-PASS: Digital Campus Permission System
**Live Site:** [https://harsha-e.github.io/UNI-Pass/](https://harsha-e.github.io/UNI-Pass/)

# 👨‍⚖️ Judge's Login Credentials
To test the various role-based dashboards and cross-portal workflows, please use the following verified credentials:

| Role | Email | Password |
| :--- | :--- | :--- |
| **Super Admin** | `admin@test.com` | `121212` |
| **HOD** | `hod@test.com` | `121212` |
| **Faculty (Teacher)** | `Teacher@test.com` | `121212` |
| **Lab Assistant** | `dyteloj@test.com` | `121212` |
| **Student (Standard)** | `Student@test.com` | `121212` |
| **Student (Institutional)** | `24331A4228@mvgrce.edu.in` | `121212` |

# 🚀 Key Features & Highlights
* **Multi-Role Access Control**: Secure, unique dashboards and logic for Admin, HOD, Faculty, and Students.
* **Automatic Workflow Engine**: Logic that identifies "sensitive" requests or durations exceeding 2 days and automatically escalates them to the HOD.
* **Real-time Synchronization**: Powered by **Google Firebase**, providing instant updates on request statuses and lab inventory across all portals.
* **Digital Gate Pass (QR)**: Dynamically generated official PDF passes featuring unique QR codes for instant security verification at campus gates.
* **Analytics Intelligence**: Built-in data visualization using **Chart.js** to track request trends, rejection rates, and leave distributions.
* **Onboarding Security**: New institutional signups must verify their email and receive manual **Admin Approval** before portal access is granted.
* **AI Alumni Assistant**: Integrated conversational bot providing career guidance and mentorship connections.

# 🛡️ New User Onboarding Workflow
We have implemented a strict verification and manual approval process to ensure campus security:

1.  **Registration**: New users sign up via the registration page.
2.  **Email Verification**: A verification link is sent to the provided email; users **must verify** before they can log in.
3.  **Admin Approval Request**: Once verified, the account is set to `pending` status.
4.  **Final Authorization**: The **Super Admin** (`admin@test.com`) must navigate to the **Staff Approvals** tab and click **Approve Access** to grant the user entry to the system.

# 🛠️ Integrated Technologies
* **Google Cloud / Firebase**: Real-time DB (Firestore), Authentication, and Hosting.
* **Google Analytics (GA4)**: Integrated tracking for system interaction and performance.
* **EmailJS**: Automated email notifications for approval/rejection decisions.
* **Google Calendar**: One-click sync for approved student "On-Duty" events.
* **Tailwind CSS**: Fully responsive mobile + desktop UI design across all portals.

---

**Note to Judges:** When testing new signups, remember to verify the email first, then switch to the **Admin** account to approve the pending request in the **Staff Approvals** tab.
