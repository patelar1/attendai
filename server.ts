import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { firestore } from "./server/firebaseAdmin.ts";
import { GoogleGenAI, Type } from '@google/genai';
import {
  INITIAL_COURSES,
  INITIAL_BRANCHES,
  INITIAL_USERS,
  INITIAL_STUDENTS,
  INITIAL_ATTENDANCE,
  INITIAL_FOLLOWUPS,
  INITIAL_AUDIT_LOGS,
  INITIAL_SCHEDULER_CONFIG,
  INITIAL_APPROVAL_REQUESTS,
  TODAY_DATE,
  ServerUserRecord,
  hashPassword,
  verifyPassword,
} from './server/seedData.ts';
import {
  StaffUser,
  Course,
  Branch,
  Student,
  AttendanceRecord,
  AbsentFollowup,
  AuditLogEntry,
  SchedulerConfig,
  UserRole,
  CallLanguage,
  ReasonCategory,
  PastDateApprovalRequest,
} from './src/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Server-Side Gemini Client
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// In-Memory Stateful Store (Seeded on startup)
const dbStore = {
  users: [...INITIAL_USERS] as ServerUserRecord[],
  courses: [...INITIAL_COURSES] as Course[],
  branches: [...INITIAL_BRANCHES] as Branch[],
  students: [...INITIAL_STUDENTS] as Student[],
  attendance: [...INITIAL_ATTENDANCE] as AttendanceRecord[],
  absentFollowups: [...INITIAL_FOLLOWUPS] as AbsentFollowup[],
  auditLogs: [...INITIAL_AUDIT_LOGS] as AuditLogEntry[],
  schedulerConfig: { ...INITIAL_SCHEDULER_CONFIG } as SchedulerConfig,
  approvalRequests: [...INITIAL_APPROVAL_REQUESTS] as PastDateApprovalRequest[],
};

// Session Management & Login Rate Limiting
interface SessionData {
  token: string;
  userId: string; // internal id (e.g. usr-hod-1)
  activeRole: UserRole;
  activeDepartment: string | null;
  expiresAt: number;
}

const sessions = new Map<string, SessionData>();
const loginRateLimits = new Map<string, { count: number; resetAt: number }>();

const SESSION_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 hours

function sanitizeUser(u: ServerUserRecord): StaffUser {
  const { passwordHash: _ph, ...safe } = u;
  return safe;
}

function recordAudit(
  actor: { id: string; name: string; role: UserRole },
  action: string,
  entity: string,
  entityId: string,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
  summary: string
): AuditLogEntry {
  const entry: AuditLogEntry = {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action,
    entity,
    entityId,
    before,
    after,
    summary,
    timestamp: new Date().toISOString(),
  };
  dbStore.auditLogs.unshift(entry);
  return entry;
}

interface AuthedRequest extends Request {
  session?: SessionData;
  currentUser?: ServerUserRecord;
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }
  const token = authHeader.slice(7).trim();
  const session = sessions.get(token);
  if (!session) {
    res.status(401).json({ error: 'Invalid or expired session. Please sign in again.' });
    return;
  }
  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    res.status(401).json({ error: 'Session timed out due to inactivity. Please sign in again.' });
    return;
  }
  const user = dbStore.users.find((u) => u.id === session.userId);
  if (!user || !user.active) {
    sessions.delete(token);
    res.status(403).json({ error: 'Your account has been deactivated by the administrator.' });
    return;
  }
  // Refresh rolling session timeout
  session.expiresAt = Date.now() + SESSION_TIMEOUT_MS;
  req.session = session;
  req.currentUser = user;
  next();
}

function requireRole(roles: UserRole[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.session || !req.currentUser) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (!roles.includes(req.session.activeRole)) {
      res.status(403).json({
        error: `Permission denied: requires ${roles.join(' or ').toUpperCase()} role (current role: ${req.session.activeRole.toUpperCase()}).`,
      });
      return;
    }
    next();
  };
}

// Helper to check if HOD or Teacher has access to a specific branch/course/year
function canUserAccessClass(
  user: ServerUserRecord,
  activeRole: UserRole,
  courseId: string,
  branchId: string,
  year?: number
): boolean {
  if (activeRole === 'admin') return true;
  const branch = dbStore.branches.find((b) => b.id === branchId);
  if (!branch) return false;

  if (activeRole === 'hod') {
    return (
      user.departments.includes(branch.code) ||
      user.assignedCourses.includes(courseId)
    );
  }

  // Teacher: must match assigned courseId + branchId + year
  return user.assignments.some(
    (a) =>
      a.courseId === courseId &&
      a.branchId === branchId &&
      (year === undefined || a.year === year)
  );
}

async function startServer() {
  const app = express();




try {
  await firestore.collection("connectionTest").doc("test").set({
    message: "AttendAI Firestore connected",
    timestamp: new Date().toISOString(),
  });

  console.log("Firebase Firestore connected successfully!");
} catch (error) {
  console.error("Firebase Firestore connection failed:", error);
}




  app.use(express.json({ limit: '5mb' }));

  // ============================================================================
  // 1. AUTHENTICATION & SESSION ROUTES
  // ============================================================================

  // Rate limiting helper
  function checkRateLimit(ip: string): boolean {
    const now = Date.now();
    const record = loginRateLimits.get(ip);
    if (!record || now > record.resetAt) {
      loginRateLimits.set(ip, { count: 1, resetAt: now + 60_000 });
      return true;
    }
    if (record.count >= 25) {
      return false;
    }
    record.count += 1;
    return true;
  }

  // Staff Login (HOD / Teacher) via User ID or Email + Password
  app.post('/api/auth/login', (req: Request, res: Response) => {
    const ip = req.ip || 'local';
    if (!checkRateLimit(ip)) {
      res.status(429).json({ error: 'Too many login attempts. Please wait 1 minute.' });
      return;
    }

    const { identifier, password } = req.body as { identifier?: string; password?: string };
    if (!identifier || !password) {
      res.status(400).json({ error: 'User ID / Email and password are required.' });
      return;
    }

    const cleanId = identifier.trim().toLowerCase();
    const user = dbStore.users.find(
      (u) =>
        u.userId.toLowerCase() === cleanId ||
        u.email.toLowerCase() === cleanId
    );

    if (!user || !verifyPassword(password, user.passwordHash)) {
      res.status(401).json({ error: 'Invalid User ID/Email or password.' });
      return;
    }

    if (!user.active) {
      res.status(403).json({ error: 'Account is deactivated. Please contact the System Administrator.' });
      return;
    }

    if (user.role === 'admin' && !user.allowedRoles.includes('hod') && !user.allowedRoles.includes('teacher')) {
      res.status(403).json({ error: 'Admin accounts must sign in via the dedicated Admin Portal Login.' });
      return;
    }

    const token = crypto.randomBytes(32).toString('hex');
    const defaultRole: UserRole = user.allowedRoles.includes('hod') ? 'hod' : 'teacher';
    const session: SessionData = {
      token,
      userId: user.id,
      activeRole: defaultRole,
      activeDepartment: user.departments[0] || null,
      expiresAt: Date.now() + SESSION_TIMEOUT_MS,
    };
    sessions.set(token, session);

    recordAudit(
      { id: user.id, name: user.name, role: defaultRole },
      'USER_LOGIN',
      'sessions',
      user.id,
      null,
      { userId: user.userId, method: 'password' },
      `${user.name} (${user.userId}) signed in`
    );

    res.json({
      token,
      user: sanitizeUser(user),
      activeRole: session.activeRole,
      activeDepartment: session.activeDepartment,
    });
  });

  // Separate Admin Login Screen (Unique Admin ID + Password)
  app.post('/api/auth/admin-login', (req: Request, res: Response) => {
    const ip = req.ip || 'local';
    if (!checkRateLimit(ip)) {
      res.status(429).json({ error: 'Too many login attempts. Please wait 1 minute.' });
      return;
    }

    const { adminId, password } = req.body as { adminId?: string; password?: string };
    if (!adminId || !password) {
      res.status(400).json({ error: 'Admin ID and password are required.' });
      return;
    }

    const cleanId = adminId.trim().toLowerCase();
    const user = dbStore.users.find(
      (u) =>
        (u.userId.toLowerCase() === cleanId || u.email.toLowerCase() === cleanId) &&
        u.allowedRoles.includes('admin')
    );

    if (!user || !verifyPassword(password, user.passwordHash)) {
      res.status(401).json({ error: 'Invalid Admin ID or password.' });
      return;
    }

    if (!user.active) {
      res.status(403).json({ error: 'Admin account is inactive.' });
      return;
    }

    const token = crypto.randomBytes(32).toString('hex');
    const session: SessionData = {
      token,
      userId: user.id,
      activeRole: 'admin',
      activeDepartment: 'ALL',
      expiresAt: Date.now() + SESSION_TIMEOUT_MS,
    };
    sessions.set(token, session);

    recordAudit(
      { id: user.id, name: user.name, role: 'admin' },
      'ADMIN_LOGIN',
      'sessions',
      user.id,
      null,
      { userId: user.userId },
      `System Administrator ${user.name} (${user.userId}) signed in to Admin Console`
    );

    res.json({
      token,
      user: sanitizeUser(user),
      activeRole: 'admin',
      activeDepartment: 'ALL',
    });
  });

  // Google Sign-In Verification (Works ONLY if email was already registered by Admin)
  app.post('/api/auth/google-login', (req: Request, res: Response) => {
    const { email } = req.body as { email?: string };
    if (!email) {
      res.status(400).json({ error: 'Google account email is required.' });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = dbStore.users.find((u) => u.email.toLowerCase() === cleanEmail);

    if (!user) {
      res.status(403).json({ error: 'Account not found, contact administrator' });
      return;
    }

    if (!user.active) {
      res.status(403).json({ error: 'Account is deactivated. Contact administrator.' });
      return;
    }

    const token = crypto.randomBytes(32).toString('hex');
    const defaultRole: UserRole = user.allowedRoles.includes('hod')
      ? 'hod'
      : user.allowedRoles.includes('teacher')
      ? 'teacher'
      : 'admin';

    const session: SessionData = {
      token,
      userId: user.id,
      activeRole: defaultRole,
      activeDepartment: user.departments[0] || null,
      expiresAt: Date.now() + SESSION_TIMEOUT_MS,
    };
    sessions.set(token, session);

    recordAudit(
      { id: user.id, name: user.name, role: defaultRole },
      'GOOGLE_OAUTH_LOGIN',
      'sessions',
      user.id,
      null,
      { email: user.email },
      `${user.name} (${user.email}) signed in with Google`
    );

    res.json({
      token,
      user: sanitizeUser(user),
      activeRole: session.activeRole,
      activeDepartment: session.activeDepartment,
    });
  });

  // Force Password Change on First Login
  app.post('/api/auth/change-password', requireAuth, (req: AuthedRequest, res: Response) => {
    const { newPassword } = req.body as { newPassword?: string };
    if (!newPassword || newPassword.length < 6) {
      res.status(400).json({ error: 'New password must be at least 6 characters long.' });
      return;
    }

    const user = req.currentUser!;
    user.passwordHash = hashPassword(newPassword);
    user.mustChangePassword = false;
    user.updatedAt = new Date().toISOString();

    recordAudit(
      { id: user.id, name: user.name, role: req.session!.activeRole },
      'PASSWORD_CHANGED',
      'users',
      user.id,
      { mustChangePassword: true },
      { mustChangePassword: false },
      `${user.name} updated their account password`
    );

    res.json({ user: sanitizeUser(user) });
  });

  // Validate Role & Department Selection Popup on the Server
  app.post('/api/auth/select-role-dept', requireAuth, (req: AuthedRequest, res: Response) => {
    const { role, department } = req.body as { role?: UserRole; department?: string };
    const user = req.currentUser!;

    if (!role || !user.allowedRoles.includes(role)) {
      res.status(403).json({
        error: `Role "${role}" is not assigned to your account.`,
      });
      return;
    }

    if (role !== 'admin') {
      if (!department || !user.departments.includes(department)) {
        res.status(403).json({
          error: `Department "${department}" is not assigned to your account.`,
        });
        return;
      }
    }

    req.session!.activeRole = role;
    req.session!.activeDepartment = department || null;

    recordAudit(
      { id: user.id, name: user.name, role },
      'SELECT_ROLE_DEPT',
      'sessions',
      user.id,
      null,
      { role, department },
      `${user.name} selected active role ${role.toUpperCase()} and department ${department}`
    );

    res.json({
      user: sanitizeUser(user),
      activeRole: req.session!.activeRole,
      activeDepartment: req.session!.activeDepartment,
    });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthedRequest, res: Response) => {
    res.json({
      user: sanitizeUser(req.currentUser!),
      activeRole: req.session!.activeRole,
      activeDepartment: req.session!.activeDepartment,
    });
  });

  app.post('/api/auth/logout', requireAuth, (req: AuthedRequest, res: Response) => {
    if (req.session) {
      sessions.delete(req.session.token);
    }
    res.json({ ok: true });
  });

  // ============================================================================
  // 2. ADMIN ROUTES (User Management, Password Reset, Audit Logs)
  // ============================================================================

  app.get('/api/admin/users', requireAuth, requireRole(['admin']), (_req: AuthedRequest, res: Response) => {
    res.json({
      users: dbStore.users.map(sanitizeUser),
    });
  });

  app.post('/api/admin/users', requireAuth, requireRole(['admin']), (req: AuthedRequest, res: Response) => {
    const {
      name,
      userId,
      password,
      email,
      mobile,
      role,
      departments,
      assignedCourses,
      assignments,
    } = req.body as {
      name?: string;
      userId?: string;
      password?: string;
      email?: string;
      mobile?: string;
      role?: 'hod' | 'teacher';
      departments?: string[];
      assignedCourses?: string[];
      assignments?: { courseId: string; branchId: string; year: number }[];
    };

    if (!name || !userId || !password || !mobile || !role) {
      res.status(400).json({ error: 'Name, Unique User ID, Temporary Password, Mobile, and Role are required.' });
      return;
    }

    const cleanUserId = userId.trim().toUpperCase();
    const cleanEmail = (email || `${cleanUserId.toLowerCase()}@attendai.edu.in`).trim().toLowerCase();

    if (dbStore.users.some((u) => u.userId.toUpperCase() === cleanUserId)) {
      res.status(409).json({ error: `User ID "${cleanUserId}" already exists.` });
      return;
    }
    if (dbStore.users.some((u) => u.email.toLowerCase() === cleanEmail)) {
      res.status(409).json({ error: `Email "${cleanEmail}" is already registered.` });
      return;
    }

    // Derive departments and courses from assignments if teacher
    let resolvedDepts = Array.isArray(departments) && departments.length > 0 ? departments : [];
    let resolvedCourses = Array.isArray(assignedCourses) && assignedCourses.length > 0 ? assignedCourses : [];
    const resolvedAssignments = Array.isArray(assignments) ? assignments : [];

    if (role === 'teacher' && resolvedAssignments.length > 0) {
      const deptSet = new Set<string>(resolvedDepts);
      const courseSet = new Set<string>(resolvedCourses);
      for (const a of resolvedAssignments) {
        courseSet.add(a.courseId);
        const br = dbStore.branches.find((b) => b.id === a.branchId);
        if (br) deptSet.add(br.code);
      }
      resolvedDepts = Array.from(deptSet);
      resolvedCourses = Array.from(courseSet);
    }

    if (role === 'hod' && resolvedDepts.length > 0 && resolvedAssignments.length === 0) {
      // Automatically populate assignments for HOD's assigned branches
      for (const br of dbStore.branches) {
        if (resolvedDepts.includes(br.code) || resolvedCourses.includes(br.courseId)) {
          const course = dbStore.courses.find((c) => c.id === br.courseId);
          const maxYr = course?.durationYears || 4;
          for (let y = 1; y <= maxYr; y++) {
            resolvedAssignments.push({ courseId: br.courseId, branchId: br.id, year: y });
          }
          if (!resolvedCourses.includes(br.courseId)) {
            resolvedCourses.push(br.courseId);
          }
        }
      }
    }

    const now = new Date().toISOString();
    const newUser: ServerUserRecord = {
      id: `usr-${Date.now()}`,
      userId: cleanUserId,
      role,
      allowedRoles: [role],
      name: name.trim(),
      email: cleanEmail,
      mobile: mobile.trim(),
      active: true,
      mustChangePassword: true, // Force password change on first login
      departments: resolvedDepts.length > 0 ? resolvedDepts : ['CSE'],
      assignedCourses: resolvedCourses.length > 0 ? resolvedCourses : ['course-btech'],
      assignments: resolvedAssignments,
      passwordHash: hashPassword(password),
      createdAt: now,
      updatedAt: now,
    };

    dbStore.users.push(newUser);

    recordAudit(
      { id: req.currentUser!.id, name: req.currentUser!.name, role: 'admin' },
      'CREATE_USER',
      'users',
      newUser.id,
      null,
      { userId: newUser.userId, role: newUser.role, name: newUser.name, departments: newUser.departments },
      `Created ${newUser.role.toUpperCase()} account ${newUser.userId} (${newUser.name}) with temporary password`
    );

    res.status(201).json({ user: sanitizeUser(newUser) });
  });

  // Reset Password or Toggle Active Status (Admin only)
  app.patch('/api/admin/users/:id', requireAuth, requireRole(['admin']), (req: AuthedRequest, res: Response) => {
    const target = dbStore.users.find((u) => u.id === req.params.id);
    if (!target) {
      res.status(404).json({ error: 'User account not found.' });
      return;
    }

    const { active, resetPassword, mustChangePassword, departments, assignments } = req.body as {
      active?: boolean;
      resetPassword?: string;
      mustChangePassword?: boolean;
      departments?: string[];
      assignments?: { courseId: string; branchId: string; year: number }[];
    };

    const beforeState = { active: target.active, mustChangePassword: target.mustChangePassword };

    if (typeof active === 'boolean') {
      target.active = active;
    }
    if (resetPassword && resetPassword.length >= 6) {
      target.passwordHash = hashPassword(resetPassword);
      target.mustChangePassword = true;
    }
    if (typeof mustChangePassword === 'boolean') {
      target.mustChangePassword = mustChangePassword;
    }
    if (Array.isArray(departments)) {
      target.departments = departments;
    }
    if (Array.isArray(assignments)) {
      target.assignments = assignments;
    }

    target.updatedAt = new Date().toISOString();

    recordAudit(
      { id: req.currentUser!.id, name: req.currentUser!.name, role: 'admin' },
      resetPassword ? 'RESET_PASSWORD' : 'UPDATE_USER_STATUS',
      'users',
      target.id,
      beforeState,
      { active: target.active, mustChangePassword: target.mustChangePassword, passwordReset: Boolean(resetPassword) },
      resetPassword
        ? `Reset password for ${target.name} (${target.userId})`
        : `Updated account status for ${target.name} (${target.userId}) to ${target.active ? 'Active' : 'Deactivated'}`
    );

    res.json({ user: sanitizeUser(target) });
  });

  app.get('/api/admin/audit-logs', requireAuth, requireRole(['admin', 'hod']), (req: AuthedRequest, res: Response) => {
    if (req.session!.activeRole === 'admin') {
      res.json({ logs: dbStore.auditLogs.slice(0, 200) });
      return;
    }
    // HOD sees logs related to their department or own actions
    const hodDepts = req.currentUser!.departments;
    const filtered = dbStore.auditLogs.filter(
      (l) =>
        l.actorId === req.currentUser!.id ||
        hodDepts.some((d) => l.summary.includes(d) || l.entityId.toUpperCase().includes(d))
    );
    res.json({ logs: filtered.slice(0, 150) });
  });

  // ============================================================================
  // 3. COURSES & BRANCHES ROUTES (Read for all authed, Write for HOD / Admin)
  // ============================================================================

  app.get('/api/catalog', requireAuth, (_req: AuthedRequest, res: Response) => {
    // Calculate active student counts per course & branch
    const branchCounts: Record<string, number> = {};
    const courseCounts: Record<string, number> = {};
    for (const s of dbStore.students) {
      if (s.status !== 'deleted') {
        branchCounts[s.branchId] = (branchCounts[s.branchId] || 0) + 1;
        courseCounts[s.courseId] = (courseCounts[s.courseId] || 0) + 1;
      }
    }

    res.json({
      courses: dbStore.courses.map((c) => ({ ...c, studentCount: courseCounts[c.id] || 0 })),
      branches: dbStore.branches.map((b) => ({ ...b, studentCount: branchCounts[b.id] || 0 })),
    });
  });

  app.post('/api/courses', requireAuth, requireRole(['hod', 'admin']), (req: AuthedRequest, res: Response) => {
    const { code, name, durationYears } = req.body as {
      code?: string;
      name?: string;
      durationYears?: number;
    };
    if (!code || !name) {
      res.status(400).json({ error: 'Course code and name are required.' });
      return;
    }
    const cleanCode = code.trim();
    if (dbStore.courses.some((c) => c.code.toLowerCase() === cleanCode.toLowerCase())) {
      res.status(409).json({ error: `Course "${cleanCode}" already exists.` });
      return;
    }

    const now = new Date().toISOString();
    const course: Course = {
      id: `course-${Date.now()}`,
      code: cleanCode,
      name: name.trim(),
      durationYears: Number(durationYears) || 4,
      createdAt: now,
      updatedAt: now,
    };
    dbStore.courses.push(course);

    // Ensure creating HOD has access to this new course
    if (!req.currentUser!.assignedCourses.includes(course.id)) {
      req.currentUser!.assignedCourses.push(course.id);
    }

    recordAudit(
      { id: req.currentUser!.id, name: req.currentUser!.name, role: req.session!.activeRole },
      'CREATE_COURSE',
      'courses',
      course.id,
      null,
      { code: course.code, name: course.name, durationYears: course.durationYears },
      `Created course ${course.code} (${course.name})`
    );

    res.status(201).json({ course });
  });

  app.put('/api/courses/:id', requireAuth, requireRole(['hod', 'admin']), (req: AuthedRequest, res: Response) => {
    const course = dbStore.courses.find((c) => c.id === req.params.id);
    if (!course) {
      res.status(404).json({ error: 'Course not found.' });
      return;
    }
    const { code, name, durationYears } = req.body as { code?: string; name?: string; durationYears?: number };
    const before = { code: course.code, name: course.name, durationYears: course.durationYears };

    if (code) course.code = code.trim();
    if (name) course.name = name.trim();
    if (durationYears) course.durationYears = Number(durationYears);
    course.updatedAt = new Date().toISOString();

    recordAudit(
      { id: req.currentUser!.id, name: req.currentUser!.name, role: req.session!.activeRole },
      'UPDATE_COURSE',
      'courses',
      course.id,
      before,
      { code: course.code, name: course.name, durationYears: course.durationYears },
      `Updated course ${course.code} (${course.name})`
    );

    res.json({ course });
  });

  app.delete('/api/courses/:id', requireAuth, requireRole(['hod', 'admin']), (req: AuthedRequest, res: Response) => {
    const idx = dbStore.courses.findIndex((c) => c.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Course not found.' });
      return;
    }
    const course = dbStore.courses[idx];
    const hasStudents = dbStore.students.some((s) => s.courseId === course.id && s.status !== 'deleted');
    if (hasStudents) {
      res.status(400).json({ error: 'Cannot delete a course that has active enrolled students.' });
      return;
    }
    dbStore.courses.splice(idx, 1);
    dbStore.branches = dbStore.branches.filter((b) => b.courseId !== course.id);

    recordAudit(
      { id: req.currentUser!.id, name: req.currentUser!.name, role: req.session!.activeRole },
      'DELETE_COURSE',
      'courses',
      course.id,
      { code: course.code, name: course.name },
      null,
      `Deleted course ${course.code}`
    );

    res.json({ ok: true });
  });

  app.post('/api/branches', requireAuth, requireRole(['hod', 'admin']), (req: AuthedRequest, res: Response) => {
    const { courseId, code, name } = req.body as { courseId?: string; code?: string; name?: string };
    if (!courseId || !code || !name) {
      res.status(400).json({ error: 'Course, Branch Code, and Branch Name are required.' });
      return;
    }
    const cleanCode = code.trim().toUpperCase();
    if (
      dbStore.branches.some(
        (b) => b.courseId === courseId && b.code.toUpperCase() === cleanCode
      )
    ) {
      res.status(409).json({ error: `Branch "${cleanCode}" already exists in this course.` });
      return;
    }

    const now = new Date().toISOString();
    const branch: Branch = {
      id: `branch-${Date.now()}`,
      courseId,
      code: cleanCode,
      name: name.trim(),
      createdAt: now,
      updatedAt: now,
    };
    dbStore.branches.push(branch);

    // Grant creating HOD access to this new branch
    if (!req.currentUser!.departments.includes(cleanCode)) {
      req.currentUser!.departments.push(cleanCode);
    }
    const course = dbStore.courses.find((c) => c.id === courseId);
    const maxYr = course?.durationYears || 4;
    for (let y = 1; y <= maxYr; y++) {
      req.currentUser!.assignments.push({ courseId, branchId: branch.id, year: y });
    }

    recordAudit(
      { id: req.currentUser!.id, name: req.currentUser!.name, role: req.session!.activeRole },
      'CREATE_BRANCH',
      'branches',
      branch.id,
      null,
      { courseId, code: branch.code, name: branch.name },
      `Created branch ${branch.code} (${branch.name})`
    );

    res.status(201).json({ branch });
  });

  app.put('/api/branches/:id', requireAuth, requireRole(['hod', 'admin']), (req: AuthedRequest, res: Response) => {
    const branch = dbStore.branches.find((b) => b.id === req.params.id);
    if (!branch) {
      res.status(404).json({ error: 'Branch not found.' });
      return;
    }
    const { code, name } = req.body as { code?: string; name?: string };
    const before = { code: branch.code, name: branch.name };
    if (code) branch.code = code.trim().toUpperCase();
    if (name) branch.name = name.trim();
    branch.updatedAt = new Date().toISOString();

    recordAudit(
      { id: req.currentUser!.id, name: req.currentUser!.name, role: req.session!.activeRole },
      'UPDATE_BRANCH',
      'branches',
      branch.id,
      before,
      { code: branch.code, name: branch.name },
      `Updated branch ${branch.code} (${branch.name})`
    );

    res.json({ branch });
  });

  app.delete('/api/branches/:id', requireAuth, requireRole(['hod', 'admin']), (req: AuthedRequest, res: Response) => {
    const idx = dbStore.branches.findIndex((b) => b.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Branch not found.' });
      return;
    }
    const branch = dbStore.branches[idx];
    const hasStudents = dbStore.students.some((s) => s.branchId === branch.id && s.status !== 'deleted');
    if (hasStudents) {
      res.status(400).json({ error: 'Cannot delete a branch that has enrolled students.' });
      return;
    }
    dbStore.branches.splice(idx, 1);

    recordAudit(
      { id: req.currentUser!.id, name: req.currentUser!.name, role: req.session!.activeRole },
      'DELETE_BRANCH',
      'branches',
      branch.id,
      { code: branch.code, name: branch.name },
      null,
      `Deleted branch ${branch.code}`
    );

    res.json({ ok: true });
  });

  // ============================================================================
  // 4. STUDENT MANAGEMENT (Read for assigned HOD/Teacher; Write ONLY for HOD)
  // ============================================================================

  app.get('/api/students', requireAuth, (req: AuthedRequest, res: Response) => {
    const { courseId, branchId, year } = req.query as {
      courseId?: string;
      branchId?: string;
      year?: string;
    };

    if (!courseId || !branchId || !year) {
      res.status(400).json({ error: 'courseId, branchId, and year query parameters are required.' });
      return;
    }

    const numericYear = Number(year);
    if (!canUserAccessClass(req.currentUser!, req.session!.activeRole, courseId, branchId, numericYear)) {
      res.status(403).json({
        error: 'Access denied: You are not assigned to this Course, Branch, and Year.',
      });
      return;
    }

    const list = dbStore.students
      .filter(
        (s) =>
          s.courseId === courseId &&
          s.branchId === branchId &&
          s.year === numericYear &&
          s.status !== 'deleted'
      )
      .sort((a, b) => a.rollNo.localeCompare(b.rollNo));

    res.json({ students: list });
  });

  // Add Single Student (HOD ONLY)
  app.post('/api/students', requireAuth, requireRole(['hod', 'admin']), (req: AuthedRequest, res: Response) => {
    const { courseId, branchId, year, rollNo, name, mobile, guardianMobile, email, status } = req.body as {
      courseId?: string;
      branchId?: string;
      year?: number;
      rollNo?: string;
      name?: string;
      mobile?: string;
      guardianMobile?: string;
      email?: string;
      status?: 'active' | 'inactive';
    };

    if (!courseId || !branchId || !year || !rollNo || !name || !mobile || !guardianMobile) {
      res.status(400).json({
        error: 'Roll No, Name, Student Mobile, Parent/Guardian Mobile, Course, Branch, and Year are required.',
      });
      return;
    }

    if (!canUserAccessClass(req.currentUser!, req.session!.activeRole, courseId, branchId, Number(year))) {
      res.status(403).json({ error: 'Permission denied: You can only add students inside your own department.' });
      return;
    }

    const cleanRoll = rollNo.trim().toUpperCase();
    if (dbStore.students.some((s) => s.rollNo.toUpperCase() === cleanRoll && s.status !== 'deleted')) {
      res.status(409).json({ error: `Student with Roll No "${cleanRoll}" already exists.` });
      return;
    }

    const now = new Date().toISOString();
    const student: Student = {
      id: `stu-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      courseId,
      branchId,
      year: Number(year),
      rollNo: cleanRoll,
      name: name.trim(),
      mobile: mobile.trim(),
      guardianMobile: guardianMobile.trim(),
      email: (email || `${cleanRoll.toLowerCase()}@attendai.edu.in`).trim().toLowerCase(),
      status: status === 'inactive' ? 'inactive' : 'active',
      createdAt: now,
      updatedAt: now,
    };

    dbStore.students.push(student);

    recordAudit(
      { id: req.currentUser!.id, name: req.currentUser!.name, role: req.session!.activeRole },
      'ADD_STUDENT',
      'students',
      student.id,
      null,
      { rollNo: student.rollNo, name: student.name, branchId, year: student.year },
      `Added student ${student.name} (${student.rollNo})`
    );

    res.status(201).json({ student });
  });

  // Bulk CSV Import (HOD ONLY)
  app.post('/api/students/bulk', requireAuth, requireRole(['hod', 'admin']), (req: AuthedRequest, res: Response) => {
    const { courseId, branchId, year, students } = req.body as {
      courseId?: string;
      branchId?: string;
      year?: number;
      students?: {
        rollNo: string;
        name: string;
        mobile: string;
        guardianMobile: string;
        email?: string;
        status?: 'active' | 'inactive';
      }[];
    };

    if (!courseId || !branchId || !year || !Array.isArray(students) || students.length === 0) {
      res.status(400).json({ error: 'Valid courseId, branchId, year, and non-empty students array required.' });
      return;
    }

    if (!canUserAccessClass(req.currentUser!, req.session!.activeRole, courseId, branchId, Number(year))) {
      res.status(403).json({ error: 'Permission denied: You can only import students inside your own department.' });
      return;
    }

    const now = new Date().toISOString();
    const added: Student[] = [];
    const skipped: { rollNo: string; reason: string }[] = [];

    for (const row of students) {
      const cleanRoll = (row.rollNo || '').trim().toUpperCase();
      if (!cleanRoll || !row.name || !row.mobile || !row.guardianMobile) {
        skipped.push({ rollNo: cleanRoll || 'UNKNOWN', reason: 'Missing required fields' });
        continue;
      }
      if (dbStore.students.some((s) => s.rollNo.toUpperCase() === cleanRoll && s.status !== 'deleted')) {
        skipped.push({ rollNo: cleanRoll, reason: 'Duplicate Roll Number' });
        continue;
      }
      const stu: Student = {
        id: `stu-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        courseId,
        branchId,
        year: Number(year),
        rollNo: cleanRoll,
        name: row.name.trim(),
        mobile: row.mobile.trim(),
        guardianMobile: row.guardianMobile.trim(),
        email: (row.email || `${cleanRoll.toLowerCase()}@attendai.edu.in`).trim().toLowerCase(),
        status: row.status === 'inactive' ? 'inactive' : 'active',
        createdAt: now,
        updatedAt: now,
      };
      dbStore.students.push(stu);
      added.push(stu);
    }

    recordAudit(
      { id: req.currentUser!.id, name: req.currentUser!.name, role: req.session!.activeRole },
      'CSV_BULK_IMPORT',
      'students',
      branchId,
      null,
      { importedCount: added.length, skippedCount: skipped.length, year },
      `Bulk imported ${added.length} students via CSV (${skipped.length} skipped)`
    );

    res.status(201).json({ added, skipped });
  });

  // Edit Student (HOD ONLY)
  app.put('/api/students/:id', requireAuth, requireRole(['hod', 'admin']), (req: AuthedRequest, res: Response) => {
    const stu = dbStore.students.find((s) => s.id === req.params.id && s.status !== 'deleted');
    if (!stu) {
      res.status(404).json({ error: 'Student not found.' });
      return;
    }

    if (!canUserAccessClass(req.currentUser!, req.session!.activeRole, stu.courseId, stu.branchId, stu.year)) {
      res.status(403).json({ error: 'Permission denied: Student belongs to another department.' });
      return;
    }

    const { rollNo, name, mobile, guardianMobile, email, year, status } = req.body as Partial<Student>;
    const before = {
      rollNo: stu.rollNo,
      name: stu.name,
      mobile: stu.mobile,
      guardianMobile: stu.guardianMobile,
      email: stu.email,
      status: stu.status,
    };

    if (rollNo) stu.rollNo = rollNo.trim().toUpperCase();
    if (name) stu.name = name.trim();
    if (mobile) stu.mobile = mobile.trim();
    if (guardianMobile) stu.guardianMobile = guardianMobile.trim();
    if (email) stu.email = email.trim().toLowerCase();
    if (year) stu.year = Number(year);
    if (status === 'active' || status === 'inactive') stu.status = status;
    stu.updatedAt = new Date().toISOString();

    recordAudit(
      { id: req.currentUser!.id, name: req.currentUser!.name, role: req.session!.activeRole },
      'UPDATE_STUDENT',
      'students',
      stu.id,
      before,
      {
        rollNo: stu.rollNo,
        name: stu.name,
        mobile: stu.mobile,
        guardianMobile: stu.guardianMobile,
        email: stu.email,
        status: stu.status,
      },
      `Updated student record for ${stu.name} (${stu.rollNo})`
    );

    res.json({ student: stu });
  });

  // Soft Delete Student (HOD ONLY)
  app.delete('/api/students/:id', requireAuth, requireRole(['hod', 'admin']), (req: AuthedRequest, res: Response) => {
    const stu = dbStore.students.find((s) => s.id === req.params.id && s.status !== 'deleted');
    if (!stu) {
      res.status(404).json({ error: 'Student not found.' });
      return;
    }

    if (!canUserAccessClass(req.currentUser!, req.session!.activeRole, stu.courseId, stu.branchId, stu.year)) {
      res.status(403).json({ error: 'Permission denied: Student belongs to another department.' });
      return;
    }

    const beforeStatus = stu.status;
    stu.status = 'deleted';
    stu.updatedAt = new Date().toISOString();

    recordAudit(
      { id: req.currentUser!.id, name: req.currentUser!.name, role: req.session!.activeRole },
      'SOFT_DELETE_STUDENT',
      'students',
      stu.id,
      { status: beforeStatus, rollNo: stu.rollNo, name: stu.name },
      { status: 'deleted' },
      `Soft-deleted student ${stu.name} (${stu.rollNo})`
    );

    res.json({ ok: true });
  });

  // ============================================================================
  // 5. DAILY ATTENDANCE & ATTENDANCE ANALYTICS
  // ============================================================================

  // Get daily attendance for a class and date
  app.get('/api/attendance/daily', requireAuth, async (req: AuthedRequest, res: Response) => {
    const { courseId, branchId, year, date } = req.query as {
      courseId?: string;
      branchId?: string;
      year?: string;
      date?: string;
    };

    if (!courseId || !branchId || !year || !date) {
      res.status(400).json({ error: 'courseId, branchId, year, and date are required.' });
      return;
    }

    const numericYear = Number(year);
    if (!canUserAccessClass(req.currentUser!, req.session!.activeRole, courseId, branchId, numericYear)) {
      res.status(403).json({ error: 'Access denied to this class.' });
      return;
    }

   const snapshot = await firestore
     .collection("attendance")
     .where("courseId", "==", courseId)
     .where("branchId", "==", branchId)
     .where("year", "==", numericYear)
     .where("date", "==", date)
     .get();

   const records = snapshot.docs.map((doc) => doc.data());

    const approval = dbStore.approvalRequests.find(
      (r) =>
        r.courseId === courseId &&
        r.branchId === branchId &&
        r.year === numericYear &&
        r.date === date
    );

    const isSameDay = date === TODAY_DATE;
    const canEdit =
      req.session!.activeRole === 'hod' ||
      req.session!.activeRole === 'admin' ||
      isSameDay ||
      approval?.status === 'approved';

    res.json({
      date,
      todayDate: TODAY_DATE,
      isSameDay,
      canEdit,
      approvalStatus: approval?.status || null,
      records,
    });
  });

  // Save Daily Attendance (Creates/Updates absentFollowups for absent students)
  app.post('/api/attendance/daily', requireAuth, async (req: AuthedRequest, res: Response) => {
    const { courseId, branchId, year, date, entries } = req.body as {
      courseId?: string;
      branchId?: string;
      year?: number;
      date?: string;
      entries?: { studentId: string; status: 'present' | 'absent' | 'leave' }[];
    };

    if (!courseId || !branchId || !year || !date || !Array.isArray(entries)) {
      res.status(400).json({ error: 'courseId, branchId, year, date, and entries array are required.' });
      return;
    }

    const numericYear = Number(year);
    if (!canUserAccessClass(req.currentUser!, req.session!.activeRole, courseId, branchId, numericYear)) {
      res.status(403).json({ error: 'Permission denied: You are not assigned to this class.' });
      return;
    }

    // Enforce same-day attendance rule for Teachers (later corrections require HOD approval)
    const isSameDay = date === TODAY_DATE;
    const approval = dbStore.approvalRequests.find(
      (r) =>
        r.courseId === courseId &&
        r.branchId === branchId &&
        r.year === numericYear &&
        r.date === date &&
        r.status === 'approved'
    );

    if (req.session!.activeRole === 'teacher' && !isSameDay && !approval) {
      res.status(403).json({
        error:
          'Teachers can only modify same-day attendance records. Past-date corrections require HOD approval.',
      });
      return;
    }

    const now = new Date().toISOString();
    let presentCount = 0;
    let absentCount = 0;
    let leaveCount = 0;
    let newFollowupsCreated = 0;

    for (const item of entries) {
      if (item.status === 'present') presentCount++;
      else if (item.status === 'absent') absentCount++;
      else if (item.status === 'leave') leaveCount++;

    
const attId = `att-${item.studentId}-${date}`;

const attendanceRef = firestore.collection('attendance').doc(attId);
const existingDoc = await attendanceRef.get();

const attendanceData: AttendanceRecord = {
  id: attId,
  studentId: item.studentId,
  courseId,
  branchId,
  year: numericYear,
  date,
  status: item.status,
  markedBy: req.currentUser!.id,
  markedByName: req.currentUser!.name,
  markedAt: existingDoc.exists
    ? (existingDoc.data()?.markedAt as string) || now
    : now,
  updatedAt: now,
};

await attendanceRef.set(attendanceData, { merge: true });



      // Sync absentFollowups record
      const existingFollowup = dbStore.absentFollowups.find(
        (f) => f.studentId === item.studentId && f.date === date
      );

      if (item.status === 'absent') {
        if (!existingFollowup) {
          const stu = dbStore.students.find((s) => s.id === item.studentId);
          if (stu) {
            const target = dbStore.schedulerConfig.defaultContactTarget;
            dbStore.absentFollowups.push({
              id: `fol-${stu.id}-${date}`,
              attendanceId: attId,
              studentId: stu.id,
              courseId,
              branchId,
              year: numericYear,
              date,
              phoneToCall: target === 'guardian' ? stu.guardianMobile : stu.mobile,
              contactTarget: target,
              callStatus: 'pending',
              attempts: 0,
              maxAttempts: dbStore.schedulerConfig.maxRetries + 1,
              lastAttemptAt: null,
              nextRetryAt: `${date}T${dbStore.schedulerConfig.firstPassTime}:00.000Z`,
              reasonText: '',
              reasonCategory: 'none',
              transcript: '',
              summary: '',
              language: dbStore.schedulerConfig.defaultLanguage,
              overriddenByTeacher: false,
              consentRecorded: false,
              updatedAt: now,
            });
            newFollowupsCreated++;
          }
        }
      } else if (existingFollowup && existingFollowup.callStatus === 'pending') {
        // Student was changed from absent to present/leave before being called -> remove pending followup
        const fIdx = dbStore.absentFollowups.findIndex((f) => f.id === existingFollowup.id);
        if (fIdx !== -1) dbStore.absentFollowups.splice(fIdx, 1);
      }
    }

    const branchObj = dbStore.branches.find((b) => b.id === branchId);
    recordAudit(
      { id: req.currentUser!.id, name: req.currentUser!.name, role: req.session!.activeRole },
      'SAVE_ATTENDANCE',
      'attendance',
      `${branchId}-${date}`,
      null,
      {
        date,
        branch: branchObj?.code || branchId,
        year: numericYear,
        present: presentCount,
        absent: absentCount,
        leave: leaveCount,
        queuedFollowups: newFollowupsCreated,
      },
      `Saved attendance for ${branchObj?.code || branchId} Year ${numericYear} (${date}): ${presentCount} Present, ${absentCount} Absent, ${leaveCount} Leave`
    );

    res.json({
      ok: true,
      summary: {
        total: entries.length,
        present: presentCount,
        absent: absentCount,
        leave: leaveCount,
        newFollowupsCreated,
      },
    });
  });

  // Teacher requests HOD approval to edit past-date attendance
  app.post('/api/attendance/request-approval', requireAuth, (req: AuthedRequest, res: Response) => {
    const { courseId, branchId, year, date, reason } = req.body as {
      courseId?: string;
      branchId?: string;
      year?: number;
      date?: string;
      reason?: string;
    };
    if (!courseId || !branchId || !year || !date) {
      res.status(400).json({ error: 'Missing required class/date parameters.' });
      return;
    }

    const existing = dbStore.approvalRequests.find(
      (r) =>
        r.courseId === courseId &&
        r.branchId === branchId &&
        r.year === Number(year) &&
        r.date === date
    );
    if (existing) {
      res.json({ request: existing });
      return;
    }

    const reqObj: PastDateApprovalRequest = {
      id: `apr-${Date.now()}`,
      courseId,
      branchId,
      year: Number(year),
      date,
      requestedById: req.currentUser!.id,
      requestedByName: req.currentUser!.name,
      reason: (reason || 'Late medical leave certificate submitted by student').trim(),
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    dbStore.approvalRequests.unshift(reqObj);

    recordAudit(
      { id: req.currentUser!.id, name: req.currentUser!.name, role: req.session!.activeRole },
      'REQUEST_PAST_EDIT_APPROVAL',
      'attendance',
      reqObj.id,
      null,
      { date, branchId, year },
      `${req.currentUser!.name} requested HOD approval to edit attendance for ${date}`
    );

    res.status(201).json({ request: reqObj });
  });

  app.get('/api/attendance/approval-requests', requireAuth, requireRole(['hod', 'admin']), (_req: AuthedRequest, res: Response) => {
    res.json({ requests: dbStore.approvalRequests });
  });

  app.patch('/api/attendance/approval-requests/:id', requireAuth, requireRole(['hod', 'admin']), (req: AuthedRequest, res: Response) => {
    const item = dbStore.approvalRequests.find((r) => r.id === req.params.id);
    if (!item) {
      res.status(404).json({ error: 'Approval request not found.' });
      return;
    }
    const { status } = req.body as { status?: 'approved' | 'rejected' };
    if (status === 'approved' || status === 'rejected') {
      item.status = status;
    }
    recordAudit(
      { id: req.currentUser!.id, name: req.currentUser!.name, role: req.session!.activeRole },
      'RESOLVE_PAST_EDIT_APPROVAL',
      'attendance',
      item.id,
      { status: 'pending' },
      { status: item.status, date: item.date },
      `HOD ${req.currentUser!.name} ${item.status} past-date attendance correction for ${item.date}`
    );
    res.json({ request: item });
  });

  // Attendance Summary Analytics per Student (with date range / month filter)
  app.get('/api/attendance/summary', requireAuth, (req: AuthedRequest, res: Response) => {
    const { courseId, branchId, year, fromDate, toDate } = req.query as {
      courseId?: string;
      branchId?: string;
      year?: string;
      fromDate?: string;
      toDate?: string;
    };

    if (!courseId || !branchId || !year) {
      res.status(400).json({ error: 'courseId, branchId, and year are required.' });
      return;
    }

    const numericYear = Number(year);
    if (!canUserAccessClass(req.currentUser!, req.session!.activeRole, courseId, branchId, numericYear)) {
      res.status(403).json({ error: 'Access denied to this class.' });
      return;
    }

    const students = dbStore.students
      .filter(
        (s) =>
          s.courseId === courseId &&
          s.branchId === branchId &&
          s.year === numericYear &&
          s.status !== 'deleted'
      )
      .sort((a, b) => a.rollNo.localeCompare(b.rollNo));

    const classRecords = dbStore.attendance.filter((a) => {
      if (a.courseId !== courseId || a.branchId !== branchId || a.year !== numericYear) return false;
      if (fromDate && a.date < fromDate) return false;
      if (toDate && a.date > toDate) return false;
      return true;
    });

    const summaryRows = students.map((stu) => {
      const stuRecords = classRecords.filter((r) => r.studentId === stu.id);
      const totalDays = stuRecords.length;
      const present = stuRecords.filter((r) => r.status === 'present').length;
      const absent = stuRecords.filter((r) => r.status === 'absent').length;
      const leave = stuRecords.filter((r) => r.status === 'leave').length;
      const percentage = totalDays > 0 ? Math.round((present / totalDays) * 100) : 0;

      return {
        studentId: stu.id,
        rollNo: stu.rollNo,
        name: stu.name,
        mobile: stu.mobile,
        guardianMobile: stu.guardianMobile,
        status: stu.status,
        totalDays,
        present,
        absent,
        leave,
        percentage,
      };
    });

    res.json({
      summaryRows,
      availableDates: Array.from(new Set(classRecords.map((r) => r.date))).sort(),
    });
  });

  // ============================================================================
  // 6. PHASE 2: ABSENT & AI CALLING SYSTEM (Gemini API + Telephony Engine)
  // ============================================================================

  app.get('/api/ai-calls', requireAuth, (req: AuthedRequest, res: Response) => {
    const { courseId, branchId, year, date } = req.query as {
      courseId?: string;
      branchId?: string;
      year?: string;
      date?: string;
    };

    const targetDate = date || TODAY_DATE;
    let followups = dbStore.absentFollowups.filter((f) => f.date === targetDate);

    if (courseId) followups = followups.filter((f) => f.courseId === courseId);
    if (branchId) followups = followups.filter((f) => f.branchId === branchId);
    if (year) followups = followups.filter((f) => f.year === Number(year));

    // Filter by user's department/class permissions
    followups = followups.filter((f) =>
      canUserAccessClass(req.currentUser!, req.session!.activeRole, f.courseId, f.branchId, f.year)
    );

    const enriched = followups.map((f) => {
      const stu = dbStore.students.find((s) => s.id === f.studentId);
      const br = dbStore.branches.find((b) => b.id === f.branchId);
      const crs = dbStore.courses.find((c) => c.id === f.courseId);
      return {
        ...f,
        studentName: stu?.name || 'Unknown Student',
        rollNo: stu?.rollNo || 'N/A',
        studentMobile: stu?.mobile || f.phoneToCall,
        guardianMobile: stu?.guardianMobile || f.phoneToCall,
        branchCode: br?.code || 'N/A',
        courseCode: crs?.code || 'N/A',
      };
    });

    res.json({
      date: targetDate,
      schedulerConfig: dbStore.schedulerConfig,
      followups: enriched,
    });
  });

  // Helper function to execute an AI Call & Structured Extraction using Gemini 3.8 Flash
  async function executeGeminiAiCall(
    followup: AbsentFollowup,
    student: Student,
    branchCode: string,
    language: CallLanguage,
    contactTarget: 'student' | 'guardian',
    simulatedOutcome: 'answered' | 'no_answer' | 'opted_out'
  ): Promise<AbsentFollowup> {
    const now = new Date().toISOString();
    followup.language = language;
    followup.contactTarget = contactTarget;
    followup.phoneToCall = contactTarget === 'guardian' ? student.guardianMobile : student.mobile;
    followup.attempts += 1;
    followup.lastAttemptAt = now;
    followup.updatedAt = now;

    if (simulatedOutcome === 'no_answer') {
      const attemptLine = `Attempt ${followup.attempts} (${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}): Dialed ${followup.phoneToCall} — Ringing, No Answer.`;
      followup.transcript = followup.transcript
        ? `${followup.transcript}\n${attemptLine}`
        : attemptLine;

      if (followup.attempts >= followup.maxAttempts) {
        followup.callStatus = 'unanswered';
        followup.nextRetryAt = null;
        followup.reasonText = '';
        followup.reasonCategory = 'none';
        followup.summary = `Unanswered after ${followup.attempts} attempts (initial call + ${followup.attempts - 1} retries).`;
      } else {
        // Remains pending for next retry in 30-60 mins, or mark unanswered if exhausted
        followup.callStatus = 'unanswered';
        const nextTime = new Date(Date.now() + dbStore.schedulerConfig.retryGapMinutes * 60_000);
        followup.nextRetryAt = nextTime.toISOString();
        followup.summary = `No answer on attempt ${followup.attempts}/${followup.maxAttempts}. Next retry scheduled at ${nextTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}.`;
      }
      return followup;
    }

    if (simulatedOutcome === 'opted_out') {
      followup.callStatus = 'opted_out';
      followup.nextRetryAt = null;
      followup.reasonCategory = 'other';
      followup.reasonText = 'Recipient requested not to receive automated calls / wrong contact.';
      followup.transcript =
        language === 'hi-IN'
          ? `AI Agent (ATTEND AI): नमस्ते, यह कॉलेज उपस्थिति विभाग से एक स्वचालित कॉल है। आज छात्र ${student.name} कक्षा में अनुपस्थित हैं।\nRecipient: यह गलत नंबर है / कृपया इस नंबर पर ऑटोमेटेड कॉल न करें।\nAI Agent (ATTEND AI): क्षमा करें, हमने आपके नंबर को डू-नॉट-कॉल (Opted Out) सूची में दर्ज कर लिया है। धन्यवाद।`
          : `AI Agent (ATTEND AI): Hello, this is an automated attendance call from the college regarding ${student.name}.\nRecipient: Please do not call this number again, I am at work.\nAI Agent (ATTEND AI): Understood. We have marked your number as opted out from future automated calls. Thank you.`;
      followup.summary = 'Recipient asked not to be called; marked as Opted Out.';
      return followup;
    }

    // Outcome === 'answered': Use Gemini API to generate realistic conversation + extract structured JSON!
    const ai = getGeminiClient();
    const scenarios = [
      { hint: 'Student has viral fever and visited the family doctor today morning', category: 'medical' as ReasonCategory },
      { hint: 'Family function / urgent wedding ceremony in hometown, returning tomorrow', category: 'family' as ReasonCategory },
      { hint: 'College bus breakdown / punctured tire near highway crossing', category: 'transport' as ReasonCategory },
      { hint: 'Severe migraine and stomach infection, resting at home', category: 'medical' as ReasonCategory },
      { hint: 'Went to Passport Seva Kendra for document verification appointment', category: 'personal' as ReasonCategory },
    ];
    const chosenScenario = scenarios[(student.rollNo.charCodeAt(student.rollNo.length - 1) + followup.attempts) % scenarios.length];

    let generatedTranscript = '';
    if (ai) {
      try {
        const scriptPrompt =
          language === 'hi-IN'
            ? `Generate a realistic, polite, concise 3-turn phone call transcript in Hindi (Devanagari script) between "AI Agent (ATTEND AI)" and "${contactTarget === 'guardian' ? 'Guardian' : 'Student'}" for college student ${student.name} (Roll No: ${student.rollNo}, Branch: ${branchCode}).
Follow this exact script structure:
1. AI Agent greets in Hindi, states this is an automated call from the college and is recorded for attendance consent, states student ${student.name} was marked absent today (${followup.date}), and politely asks the reason for absence.
2. ${contactTarget === 'guardian' ? 'Guardian' : 'Student'} explains the reason naturally in Hindi based on: "${chosenScenario.hint}".
3. AI Agent confirms the exact reason back in Hindi, thanks them politely, and ends the call.`
            : `Generate a realistic, polite, concise 3-turn phone call transcript in English between "AI Agent (ATTEND AI)" and "${contactTarget === 'guardian' ? 'Guardian' : 'Student'}" for college student ${student.name} (Roll No: ${student.rollNo}, Branch: ${branchCode}).
Follow this exact script structure:
1. AI Agent greets, states this is an automated call from the college (recorded for attendance records), states student ${student.name} was marked absent today (${followup.date}), and asks the reason for absence.
2. ${contactTarget === 'guardian' ? 'Guardian' : 'Student'} explains the reason naturally based on: "${chosenScenario.hint}".
3. AI Agent confirms the reason back, thanks them politely, and ends the call.`;

        const convRes = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: scriptPrompt,
        });
        generatedTranscript = (convRes.text || '').trim();

        // Step 2: Ask Gemini to extract structured JSON {reasonText, reasonCategory, language, summary} from the transcript
        const extractionRes = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: `Extract the structured absence reason from the following college attendance phone call transcript:\n\n${generatedTranscript}`,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                reasonText: {
                  type: Type.STRING,
                  description: 'Concise reason for the student absence in clear English (max 140 chars).',
                },
                reasonCategory: {
                  type: Type.STRING,
                  description: 'One of: medical, family, transport, personal, other',
                },
                language: {
                  type: Type.STRING,
                  description: 'Language code of the call: hi-IN or en-IN',
                },
                summary: {
                  type: Type.STRING,
                  description: 'One-line summary of the call outcome and confirmation.',
                },
              },
              required: ['reasonText', 'reasonCategory', 'language', 'summary'],
            },
          },
        });

        const parsed = JSON.parse((extractionRes.text || '{}').trim());
        const validCategories: ReasonCategory[] = ['medical', 'family', 'transport', 'personal', 'other'];
        const cat = validCategories.includes(parsed.reasonCategory) ? parsed.reasonCategory : chosenScenario.category;

        followup.callStatus = 'answered';
        followup.nextRetryAt = null;
        followup.consentRecorded = true;
        followup.transcript = generatedTranscript;
        followup.reasonText = parsed.reasonText || chosenScenario.hint;
        followup.reasonCategory = cat;
        followup.summary = parsed.summary || `Confirmed absence reason (${cat}): ${followup.reasonText}`;
        followup.overriddenByTeacher = false;
        return followup;
      } catch (err) {
        console.warn('Gemini call fallback used:', err);
      }
    }

    // Deterministic fallback if API key is not configured or rate-limited
    followup.callStatus = 'answered';
    followup.nextRetryAt = null;
    followup.consentRecorded = true;
    followup.overriddenByTeacher = false;
    followup.reasonCategory = chosenScenario.category;
    followup.reasonText = chosenScenario.hint;
    followup.transcript =
      language === 'hi-IN'
        ? `AI Agent (ATTEND AI): नमस्ते, यह कॉलेज उपस्थिति विभाग से एक स्वचालित कॉल है। यह कॉल उपस्थिति रिकॉर्ड की सहमति के साथ दर्ज की जा रही है। आज छात्र ${student.name} (${student.rollNo}) कक्षा में अनुपस्थित दर्ज किए गए हैं। कृपया अनुपस्थिति का कारण बताएं।\n${contactTarget === 'guardian' ? 'Guardian' : 'Student'}: नमस्ते, आज ${chosenScenario.hint} के कारण कॉलेज नहीं आ सके हैं, कल से नियमित कक्षा में आएंगे।\nAI Agent (ATTEND AI): जानकारी के लिए धन्यवाद। मैंने उपस्थिति रिकॉर्ड में कारण दर्ज कर लिया है। शुभ दिन, नमस्ते।`
        : `AI Agent (ATTEND AI): Hello, this is an automated call from the college attendance office. This call is recorded with consent for attendance logs. Student ${student.name} (${student.rollNo}) was marked absent today. Could you please tell us the reason for the absence?\n${contactTarget === 'guardian' ? 'Guardian' : 'Student'}: Hello, ${student.name} could not attend today because: ${chosenScenario.hint}. Will attend regularly from tomorrow.\nAI Agent (ATTEND AI): Thank you for confirming. I have recorded this reason in the attendance portal. Have a good day.`;
    followup.summary = `AI Call answered (${language === 'hi-IN' ? 'Hindi' : 'English'}): ${chosenScenario.hint}`;
    return followup;
  }

  // Trigger Single Automated AI Call (with Language, Contact Target, and Simulated Outcome for Test Mode)
  app.post('/api/ai-calls/:id/call', requireAuth, async (req: AuthedRequest, res: Response) => {
    const followup = dbStore.absentFollowups.find((f) => f.id === req.params.id);
    if (!followup) {
      res.status(404).json({ error: 'Absent follow-up record not found.' });
      return;
    }

    if (!canUserAccessClass(req.currentUser!, req.session!.activeRole, followup.courseId, followup.branchId, followup.year)) {
      res.status(403).json({ error: 'Permission denied for this department/class.' });
      return;
    }

    if (followup.callStatus === 'opted_out') {
      res.status(400).json({ error: 'Cannot call this contact: Recipient previously opted out of automated calls.' });
      return;
    }

    const { language, contactTarget, simulatedOutcome } = req.body as {
      language?: CallLanguage;
      contactTarget?: 'student' | 'guardian';
      simulatedOutcome?: 'answered' | 'no_answer' | 'opted_out';
    };

    const stu = dbStore.students.find((s) => s.id === followup.studentId);
    if (!stu) {
      res.status(404).json({ error: 'Student record not found.' });
      return;
    }
    const br = dbStore.branches.find((b) => b.id === followup.branchId);

    const updated = await executeGeminiAiCall(
      followup,
      stu,
      br?.code || 'CSE',
      language || followup.language || dbStore.schedulerConfig.defaultLanguage,
      contactTarget || followup.contactTarget || dbStore.schedulerConfig.defaultContactTarget,
      simulatedOutcome || 'answered'
    );

    recordAudit(
      { id: req.currentUser!.id, name: req.currentUser!.name, role: req.session!.activeRole },
      'AI_CALL_PLACED',
      'absentFollowups',
      updated.id,
      null,
      {
        student: stu.name,
        rollNo: stu.rollNo,
        callStatus: updated.callStatus,
        reasonCategory: updated.reasonCategory,
        language: updated.language,
      },
      `Placed AI Attendance Call to ${stu.name} (${stu.rollNo}) [${updated.language}] -> ${updated.callStatus.toUpperCase()}`
    );

    res.json({
      followup: {
        ...updated,
        studentName: stu.name,
        rollNo: stu.rollNo,
        studentMobile: stu.mobile,
        guardianMobile: stu.guardianMobile,
        branchCode: br?.code || 'CSE',
      },
    });
  });

  // Trigger Batch Scheduled AI Call Pass (calls all pending / retryable records)
  app.post('/api/ai-calls/batch-pass', requireAuth, async (req: AuthedRequest, res: Response) => {
    const { date, courseId, branchId, year, language } = req.body as {
      date?: string;
      courseId?: string;
      branchId?: string;
      year?: number;
      language?: CallLanguage;
    };

    const targetDate = date || TODAY_DATE;
    let queue = dbStore.absentFollowups.filter(
      (f) =>
        f.date === targetDate &&
        (f.callStatus === 'pending' || (f.callStatus === 'unanswered' && f.attempts < f.maxAttempts))
    );

    if (courseId) queue = queue.filter((f) => f.courseId === courseId);
    if (branchId) queue = queue.filter((f) => f.branchId === branchId);
    if (year) queue = queue.filter((f) => f.year === Number(year));

    queue = queue.filter((f) =>
      canUserAccessClass(req.currentUser!, req.session!.activeRole, f.courseId, f.branchId, f.year)
    );

    let answeredCount = 0;
    let unansweredCount = 0;

    for (let i = 0; i < queue.length; i++) {
      const f = queue[i];
      const stu = dbStore.students.find((s) => s.id === f.studentId);
      if (!stu) continue;
      const br = dbStore.branches.find((b) => b.id === f.branchId);
      // Make ~80% answer and ~20% no_answer to demonstrate realistic batch outcomes
      const outcome: 'answered' | 'no_answer' = i % 5 === 4 ? 'no_answer' : 'answered';
      await executeGeminiAiCall(
        f,
        stu,
        br?.code || 'CSE',
        language || f.language || dbStore.schedulerConfig.defaultLanguage,
        f.contactTarget,
        outcome
      );
      if (f.callStatus === 'answered') answeredCount++;
      else unansweredCount++;
    }

    dbStore.schedulerConfig.lastRunAt = new Date().toISOString();

    recordAudit(
      { id: req.currentUser!.id, name: req.currentUser!.name, role: req.session!.activeRole },
      'BATCH_AI_CALL_PASS',
      'absentFollowups',
      targetDate,
      null,
      { processed: queue.length, answeredCount, unansweredCount },
      `Executed automated AI Call Pass for ${queue.length} absent students (${answeredCount} answered, ${unansweredCount} unanswered)`
    );

    res.json({
      processed: queue.length,
      answeredCount,
      unansweredCount,
      lastRunAt: dbStore.schedulerConfig.lastRunAt,
    });
  });

  // Manual Reason Override by Teacher or HOD
  app.patch('/api/ai-calls/:id/manual-reason', requireAuth, (req: AuthedRequest, res: Response) => {
    const followup = dbStore.absentFollowups.find((f) => f.id === req.params.id);
    if (!followup) {
      res.status(404).json({ error: 'Follow-up record not found.' });
      return;
    }

    if (!canUserAccessClass(req.currentUser!, req.session!.activeRole, followup.courseId, followup.branchId, followup.year)) {
      res.status(403).json({ error: 'Permission denied.' });
      return;
    }

    const { reasonText, reasonCategory } = req.body as {
      reasonText?: string;
      reasonCategory?: ReasonCategory;
    };

    if (!reasonText || !reasonText.trim()) {
      res.status(400).json({ error: 'Reason text cannot be empty.' });
      return;
    }

    const before = { reasonText: followup.reasonText, reasonCategory: followup.reasonCategory };
    followup.reasonText = reasonText.trim();
    followup.reasonCategory = reasonCategory || 'other';
    followup.overriddenByTeacher = true;
    followup.overriddenByName = req.currentUser!.name;
    if (followup.callStatus === 'pending' || followup.callStatus === 'unanswered') {
      followup.callStatus = 'answered';
    }
    followup.summary = `Manually recorded by ${req.currentUser!.name}: ${followup.reasonText}`;
    followup.updatedAt = new Date().toISOString();

    const stu = dbStore.students.find((s) => s.id === followup.studentId);
    recordAudit(
      { id: req.currentUser!.id, name: req.currentUser!.name, role: req.session!.activeRole },
      'MANUAL_ABSENCE_REASON',
      'absentFollowups',
      followup.id,
      before,
      { reasonText: followup.reasonText, reasonCategory: followup.reasonCategory },
      `${req.currentUser!.name} manually entered absence reason for ${stu?.name || followup.studentId}`
    );

    res.json({ followup });
  });

  // Delete Transcript (Privacy control for HOD / Admin)
  app.delete('/api/ai-calls/:id/transcript', requireAuth, requireRole(['hod', 'admin']), (req: AuthedRequest, res: Response) => {
    const followup = dbStore.absentFollowups.find((f) => f.id === req.params.id);
    if (!followup) {
      res.status(404).json({ error: 'Follow-up record not found.' });
      return;
    }

    followup.transcript = '';
    followup.updatedAt = new Date().toISOString();

    recordAudit(
      { id: req.currentUser!.id, name: req.currentUser!.name, role: req.session!.activeRole },
      'DELETE_CALL_TRANSCRIPT',
      'absentFollowups',
      followup.id,
      { hadTranscript: true },
      { hadTranscript: false },
      `Deleted call recording transcript for follow-up ${followup.id} (Privacy compliance)`
    );

    res.json({ followup });
  });

  // Synthesize Voice Call Audio using Gemini 3.8 Flash Lite TTS
  app.post('/api/ai-calls/:id/tts', requireAuth, async (req: AuthedRequest, res: Response) => {
    const followup = dbStore.absentFollowups.find((f) => f.id === req.params.id);
    if (!followup || !followup.transcript) {
      res.status(404).json({ error: 'No transcript available to synthesize.' });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({ error: 'Gemini TTS unavailable, using browser speech synthesis fallback.' });
      return;
    }

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: followup.transcript.slice(0, 900),
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) {
        res.status(500).json({ error: 'No audio returned from TTS model.' });
        return;
      }

      res.json({ audioBase64: base64Audio, mimeType: 'audio/wav' });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'TTS generation failed',
      });
    }
  });

  // Update Scheduler Configuration (Admin / HOD)
  app.put('/api/scheduler/config', requireAuth, requireRole(['admin', 'hod']), (req: AuthedRequest, res: Response) => {
    const incoming = req.body as Partial<SchedulerConfig>;
    const before = { ...dbStore.schedulerConfig };

    dbStore.schedulerConfig = {
      ...dbStore.schedulerConfig,
      ...incoming,
    };

    recordAudit(
      { id: req.currentUser!.id, name: req.currentUser!.name, role: req.session!.activeRole },
      'UPDATE_SCHEDULER_CONFIG',
      'schedulerConfig',
      'global',
      before,
      { ...dbStore.schedulerConfig },
      `Updated AI Calling Scheduler settings (Pass 1: ${dbStore.schedulerConfig.firstPassTime}, Pass 2: ${dbStore.schedulerConfig.secondPassTime})`
    );

    res.json({ schedulerConfig: dbStore.schedulerConfig });
  });

  // ============================================================================
  // 7. VITE MIDDLEWARE / STATIC ASSETS
  // ============================================================================
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ATTEND AI server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
