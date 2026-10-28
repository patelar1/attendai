export type UserRole = 'admin' | 'hod' | 'teacher';

export interface ClassAssignment {
  courseId: string;
  branchId: string;
  year: number;
}

export interface StaffUser {
  id: string;
  userId: string; // e.g., ADM-001, HOD-CSE-01, TCH-CSE-01
  role: UserRole;
  allowedRoles: UserRole[]; // Roles available on this account
  name: string;
  email: string;
  mobile: string;
  active: boolean;
  mustChangePassword: boolean;
  departments: string[]; // e.g., ['CSE', 'CSD', 'IT']
  assignedCourses: string[]; // courseIds for HOD
  assignments: ClassAssignment[]; // courseId + branchId + year for Teacher/HOD
  createdAt: string;
  updatedAt: string;
}

export interface Course {
  id: string;
  code: string; // e.g., B.Tech, BCA, MCA, MBA, B.Com
  name: string;
  durationYears: number;
  createdAt: string;
  updatedAt: string;
}

export interface Branch {
  id: string;
  courseId: string;
  code: string; // e.g., CSE, CSD, IT, EC, ME
  name: string;
  createdAt: string;
  updatedAt: string;
}

export type StudentStatus = 'active' | 'inactive' | 'deleted';

export interface Student {
  id: string;
  courseId: string;
  branchId: string;
  year: number;
  rollNo: string;
  name: string;
  mobile: string;
  guardianMobile: string;
  email: string;
  status: StudentStatus;
  createdAt: string;
  updatedAt: string;
}

export type AttendanceStatus = 'present' | 'absent' | 'leave';

export interface AttendanceRecord {
  id: string;
  studentId: string;
  courseId: string;
  branchId: string;
  year: number;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  markedBy: string; // user.id
  markedByName: string;
  hodApprovedPastEdit?: boolean;
  markedAt: string;
  updatedAt: string;
}

export type CallStatus =
  | 'pending'
  | 'calling'
  | 'answered'
  | 'unanswered'
  | 'failed'
  | 'opted_out';

export type ReasonCategory =
  | 'medical'
  | 'family'
  | 'transport'
  | 'personal'
  | 'other'
  | 'none';

export type CallLanguage = 'hi-IN' | 'en-IN';

export interface AbsentFollowup {
  id: string;
  attendanceId: string;
  studentId: string;
  courseId: string;
  branchId: string;
  year: number;
  date: string; // YYYY-MM-DD
  phoneToCall: string;
  contactTarget: 'student' | 'guardian';
  callStatus: CallStatus;
  attempts: number;
  maxAttempts: number;
  lastAttemptAt: string | null;
  nextRetryAt: string | null;
  reasonText: string;
  reasonCategory: ReasonCategory;
  transcript: string;
  summary: string;
  language: CallLanguage;
  overriddenByTeacher: boolean;
  overriddenByName?: string;
  consentRecorded: boolean;
  updatedAt: string;
}

export interface AuditLogEntry {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  entity: string;
  entityId: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  summary: string;
  timestamp: string;
}

export interface SchedulerConfig {
  enabled: boolean;
  firstPassTime: string; // "12:00"
  secondPassTime: string; // "13:00"
  allowedStartHour: number; // 9 (9 AM)
  allowedEndHour: number; // 18 (6 PM)
  defaultLanguage: CallLanguage; // 'hi-IN'
  defaultContactTarget: 'student' | 'guardian';
  maxRetries: number; // 2 (so up to 3 total attempts)
  retryGapMinutes: number; // 45
  providerMode: 'test_mock' | 'twilio_live';
  lastRunAt: string | null;
}

export interface PastDateApprovalRequest {
  id: string;
  courseId: string;
  branchId: string;
  year: number;
  date: string;
  requestedById: string;
  requestedByName: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}
