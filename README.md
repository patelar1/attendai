# ATTEND AI — Smart College Attendance & Automated AI Absentee Calling System

**ATTEND AI** is a full-stack college attendance management system with role-based access control (Admin, HOD, Teacher) and an automated AI voice calling engine powered by Gemini (`@google/genai`) that calls absent students or their guardians, conducts a polite bilingual conversation (Hindi `hi-IN` by default, English `en-IN` optional), and extracts structured absence reasons.

---

## 1. Demo Credentials (Seeded Out of the Box)

The database seeds automatically with **1 Admin, 2 HODs, 3 Teachers, 5 Courses, 9 Branches (CSE, CSD, IT, EC, ME, etc.), 64 Students, and 7 Days of Attendance**:

| Role | User ID / Login ID | Password | Assigned Scope |
| :--- | :--- | :--- | :--- |
| **System Admin** | `ADM-001` *(via Admin Login tab)* | `Admin@123` | Full User Management, Scheduler Config, Audit Logs |
| **HOD (CSE / IT)** | `HOD-CSE-01` | `Hod@123` | B.Tech (`CSE`, `CSD`, `IT`), `BCA`, `MCA` |
| **HOD (EC / ME / MBA)** | `HOD-CORE-02` | `Hod@123` | B.Tech (`EC`, `ME`), `MBA`, `B.Com` |
| **Teacher (CSE / CSD)** | `TCH-CSE-01` | `Teacher@123` | B.Tech `CSE` (Year 2 & 3), `CSD` (Year 2) |
| **Teacher (IT / BCA)** | `TCH-IT-02` | `Teacher@123` | B.Tech `IT` (Year 2), `BCA-DS` (Year 1), `MCA-SE` (Year 1) |
| **Teacher (EC / ME)** | `TCH-EC-03` | `Teacher@123` | B.Tech `EC` (Year 2), `ME` (Year 2) |

*Note: Google Sign-In works for any email registered by the Admin (including the project owner's Google account pre-seeded in `server/seedData.ts`). Unregistered Google emails receive `"Account not found, contact administrator"`.*

---

## 2. Permission & Security Model

1. **Zero Public Sign-Up**: Accounts are created exclusively by the Admin. New accounts have `mustChangePassword = true` and must set a new password on first sign-in.
2. **Server-Side RBAC Middleware & Firestore Security Rules (`firestore.rules`)**:
   - **Admin (`admin`)**: Creates/deactivates HOD and Teacher accounts, resets passwords, configures the AI Calling Scheduler, and audits all system logs.
   - **HOD (`hod`)**: Manages Courses and Branches, adds/edits/soft-deletes students (including validated CSV bulk import) strictly within their assigned departments, approves past-date teacher attendance edits, and manages AI call transcripts.
   - **Teacher (`teacher`)**: Views student directory in **read-only mode** (`Only HOD can edit student data`), marks daily attendance for assigned `Course + Branch + Year` combinations (same-day edits allowed; past-date edits locked until HOD approval), exports attendance analytics CSV, and triggers/reviews AI calls or enters manual reason overrides.

---

## 3. Environment Variables (`.env.example`)

- `GEMINI_API_KEY`: Server-side API key used by `server.ts` for Gemini 3.8 Flash conversation simulation, structured JSON reason extraction (`{ reasonText, reasonCategory, language, summary }`), and Gemini 3.8 Flash Lite TTS voice synthesis. Never exposed to the browser.
- `APP_URL`: Runtime application URL.

---

## 4. Setup & Running Locally

```bash
npm install
npm run dev
```

The Express + Vite server starts on `http://0.0.0.0:3000`.

To build for production:
```bash
npm run build
npm start
```

---

## 5. Plugging in a Live Telephony Provider (Twilio Voice) in Phase 2

The Phase 2 AI Calling Engine in `server.ts` is architected so that `executeGeminiAiCall()` separates telephony transport from Gemini speech understanding and structured JSON extraction:

1. Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_PHONE_NUMBER` in your server environment.
2. In the Admin Console -> **AI Calling Scheduler & Telephony**, switch **Telephony Mode** from `Test Mode` to `Twilio Voice Provider + Gemini AI`.
3. Point your Twilio Voice webhook URL to `/api/ai-calls/:id/call` to stream the bilateral audio/speech transcript into Gemini `gemini-3.8-flash`, which automatically extracts `{ reasonText, reasonCategory, language, summary }` and updates the `absentFollowups` record.
