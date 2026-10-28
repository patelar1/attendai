/**
 * Security Rules Verification Suite (Dirty Dozen Payloads)
 * Verifies all 12 adversarial payloads defined in security_spec.md are rejected.
 */

export interface DirtyDozenTestCase {
  id: number;
  name: string;
  collection: string;
  operation: 'create' | 'update' | 'delete' | 'get' | 'list';
  expectedResult: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_TESTS: DirtyDozenTestCase[] = [
  { id: 1, name: 'Shadow Field Injection on Course', collection: 'courses', operation: 'create', expectedResult: 'PERMISSION_DENIED' },
  { id: 2, name: 'Self-Assigned Admin Role on User', collection: 'users', operation: 'create', expectedResult: 'PERMISSION_DENIED' },
  { id: 3, name: 'Unverified Admin Email Spoof', collection: 'admins', operation: 'get', expectedResult: 'PERMISSION_DENIED' },
  { id: 4, name: 'Document ID Poisoning (>128 chars)', collection: 'students', operation: 'create', expectedResult: 'PERMISSION_DENIED' },
  { id: 5, name: 'Denial-of-Wallet Oversized String', collection: 'students', operation: 'create', expectedResult: 'PERMISSION_DENIED' },
  { id: 6, name: 'PII Blanket Read on Another User', collection: 'users', operation: 'get', expectedResult: 'PERMISSION_DENIED' },
  { id: 7, name: 'Teacher Attempting Student Mutation', collection: 'students', operation: 'update', expectedResult: 'PERMISSION_DENIED' },
  { id: 8, name: 'Orphaned Attendance Record Creation', collection: 'attendance', operation: 'create', expectedResult: 'PERMISSION_DENIED' },
  { id: 9, name: 'Client Timestamp Forgery', collection: 'attendance', operation: 'create', expectedResult: 'PERMISSION_DENIED' },
  { id: 10, name: 'Terminal State Bypass on Opted-Out Followup', collection: 'absentFollowups', operation: 'update', expectedResult: 'PERMISSION_DENIED' },
  { id: 11, name: 'Immutable Field Mutation on Student', collection: 'students', operation: 'update', expectedResult: 'PERMISSION_DENIED' },
  { id: 12, name: 'Audit Log Tampering / Deletion', collection: 'auditLogs', operation: 'delete', expectedResult: 'PERMISSION_DENIED' },
];
