# Security Specification (`security_spec.md`)

## 1. Data Invariants

1. **Default-Deny Catch-All**: Every unmatched path is strictly denied (`allow read, write: if false;`).
2. **Verified Authentication**: Every mutating operation requires `request.auth != null && request.auth.token.email_verified == true`.
3. **Zero Trust Roles**: Roles are never trusted from custom claims. `isAdmin()` verifies existence in `/admins/$(request.auth.uid)` or the bootstrapped verified admin email `chandraprakashchauhan157@gmail.com`. `isHod()` and `isTeacher()` verify the server-persisted user document in `/users/$(request.auth.uid)`.
4. **PII Isolation**: `/users/{userId}` and `/students/{studentId}` contain PII (`email`, `mobile`, `guardianMobile`). Blanket `isSignedIn()` reads or lists are strictly prohibited. Reads on `/users/{userId}` are restricted to `isOwner(userId) || isAdmin()`.
5. **Relational Existence**: Creating a `Branch` requires `exists(/courses/$(incoming().courseId))`. Creating a `Student` requires `exists(/courses/$(incoming().courseId))` and `exists(/branches/$(incoming().branchId))`. Creating `Attendance` requires `exists(/students/$(incoming().studentId))`. Creating `AbsentFollowup` requires `exists(/attendance/$(incoming().attendanceId))`.
6. **Terminal State Locking**: Once an `AbsentFollowup` reaches `callStatus == 'opted_out'`, further non-admin updates are blocked to respect recipient opt-out privacy.
7. **Immutable Fields & Server Timestamps**: `id`, `createdAt`, `createdByUid`, `ownerUid`, and `actorUid` are immutable after creation. `createdAt` must equal `request.time` on creation and `updatedAt` must equal `request.time` on update.

## 2. The "Dirty Dozen" Payloads

1. **Payload 1 (Shadow Field Injection)**: `POST /courses/c1` with `{ ..., "isSuperCourse": true }` -> Rejected by `hasOnly()`.
2. **Payload 2 (Self-Assigned Admin Role)**: `POST /users/u1` by non-admin setting `role: "admin"` -> Rejected because only `isAdmin()` can create `/users/{userId}`.
3. **Payload 3 (Unverified Admin Email Spoof)**: Request with `email: "chandraprakashchauhan157@gmail.com"` and `email_verified: false` -> Rejected by `isVerified()`.
4. **Payload 4 (ID Poisoning)**: Document ID with 300 chars or special chars `../admin` -> Rejected by `isValidId()`.
5. **Payload 5 (Denial-of-Wallet Oversized String)**: `Student.name` with 10,000 characters -> Rejected by `data.name.size() <= 120`.
6. **Payload 6 (PII Blanket Read on Users)**: Authenticated teacher attempts `GET /users/other_teacher` -> Rejected because `userId != request.auth.uid && !isAdmin()`.
7. **Payload 7 (Teacher Attempting Student Creation/Mutation)**: Teacher attempts `POST /students/s1` or `PATCH /students/s1` -> Rejected because only `isHod() || isAdmin()` can create or update students.
8. **Payload 8 (Orphaned Attendance Record)**: `POST /attendance/a1` referencing non-existent `studentId` -> Rejected by `exists(/students/$(incoming().studentId))`.
9. **Payload 9 (Timestamp Forgery)**: `POST /attendance/a1` with backdated `createdAt` / `markedAt != request.time` -> Rejected by strict timestamp check.
10. **Payload 10 (Terminal State Bypass on Opted-Out Followup)**: Non-admin attempts `PATCH /absentFollowups/f1` when `existing().callStatus == 'opted_out'` -> Rejected by terminal state lock.
11. **Payload 11 (Immutable Field Mutation)**: `PATCH /students/s1` changing `createdByUid` or `createdAt` -> Rejected by immutability invariant.
12. **Payload 12 (Audit Log Tampering / Deletion)**: Any user attempting `PATCH` or `DELETE` on `/auditLogs/{logId}` -> Rejected (`allow update, delete: if false;`).
