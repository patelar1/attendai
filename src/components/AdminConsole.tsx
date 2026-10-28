import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  UserPlus,
  Users,
  KeyRound,
  Power,
  Clock,
  Activity,
  CheckCircle2,
  AlertCircle,
  LogOut,
  Plus,
  Trash2,
  PhoneCall,
  Search,
  X,
} from 'lucide-react';
import {
  StaffUser,
  Course,
  Branch,
  AuditLogEntry,
  SchedulerConfig,
  ClassAssignment,
  CallLanguage,
} from '../types.ts';
import { apiRequest } from '../api.ts';

interface AdminConsoleProps {
  currentUser: StaffUser;
  courses: Course[];
  branches: Branch[];
  onLogout: () => void;
}

export const AdminConsole: React.FC<AdminConsoleProps> = ({
  currentUser,
  courses,
  branches,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<'users' | 'scheduler' | 'audit'>('users');
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [scheduler, setScheduler] = useState<SchedulerConfig>({
    enabled: true,
    firstPassTime: '12:00',
    secondPassTime: '13:00',
    allowedStartHour: 9,
    allowedEndHour: 18,
    defaultLanguage: 'hi-IN',
    defaultContactTarget: 'guardian',
    maxRetries: 2,
    retryGapMinutes: 45,
    providerMode: 'test_mock',
    lastRunAt: null,
  });

  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Create HOD / Teacher Account Form State
  const [createRole, setCreateRole] = useState<'hod' | 'teacher'>('hod');
  const [fullName, setFullName] = useState('');
  const [uniqueUserId, setUniqueUserId] = useState('HOD-ME-03');
  const [tempPassword, setTempPassword] = useState('Welcome@123');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('+91 98260 99001');
  const [selectedDepts, setSelectedDepts] = useState<string[]>(['CSE']);
  const [selectedCourses, setSelectedCourses] = useState<string[]>(['course-btech']);

  // Teacher Class Assignment Builder
  const [draftCourseId, setDraftCourseId] = useState<string>('course-btech');
  const [draftBranchId, setDraftBranchId] = useState<string>('branch-cse');
  const [draftYear, setDraftYear] = useState<number>(2);
  const [teacherAssignments, setTeacherAssignments] = useState<ClassAssignment[]>([
    { courseId: 'course-btech', branchId: 'branch-cse', year: 2 },
  ]);
  const [creatingUser, setCreatingUser] = useState(false);

  // Password Reset Modal State
  const [resetTarget, setResetTarget] = useState<StaffUser | null>(null);
  const [newResetPass, setNewResetPass] = useState('Reset@123');
  const [searchLog, setSearchLog] = useState('');

  const loadAdminData = async () => {
    setLoading(true);
    try {
      const [uRes, lRes, cRes] = await Promise.all([
        apiRequest<{ users: StaffUser[] }>('/api/admin/users'),
        apiRequest<{ logs: AuditLogEntry[] }>('/api/admin/audit-logs'),
        apiRequest<{ schedulerConfig: SchedulerConfig }>('/api/ai-calls?date=2026-10-26'),
      ]);
      setUsers(uRes.users);
      setAuditLogs(lRes.logs);
      if (cRes.schedulerConfig) {
        setScheduler(cRes.schedulerConfig);
      }
    } catch (err) {
      setBanner({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to load admin data',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const handleToggleDept = (code: string) => {
    setSelectedDepts((prev) =>
      prev.includes(code) ? prev.filter((d) => d !== code) : [...prev, code]
    );
  };

  const handleToggleCourse = (cid: string) => {
    setSelectedCourses((prev) =>
      prev.includes(cid) ? prev.filter((c) => c !== cid) : [...prev, cid]
    );
  };

  const handleAddTeacherAssignment = () => {
    if (
      teacherAssignments.some(
        (a) =>
          a.courseId === draftCourseId &&
          a.branchId === draftBranchId &&
          a.year === draftYear
      )
    ) {
      return;
    }
    setTeacherAssignments((prev) => [
      ...prev,
      { courseId: draftCourseId, branchId: draftBranchId, year: draftYear },
    ]);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingUser(true);
    setBanner(null);
    try {
      const res = await apiRequest<{ user: StaffUser }>('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          name: fullName,
          userId: uniqueUserId,
          password: tempPassword,
          email,
          mobile,
          role: createRole,
          departments: selectedDepts,
          assignedCourses: selectedCourses,
          assignments: createRole === 'teacher' ? teacherAssignments : [],
        }),
      });
      setBanner({
        type: 'ok',
        text: `Created ${res.user.role.toUpperCase()} account ${res.user.userId} (${res.user.name}). First-login password change is enforced.`,
      });
      setFullName('');
      setEmail('');
      await loadAdminData();
    } catch (err) {
      setBanner({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to create account',
      });
    } finally {
      setCreatingUser(false);
    }
  };

  const handleToggleUserActive = async (u: StaffUser) => {
    try {
      await apiRequest(`/api/admin/users/${u.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !u.active }),
      });
      await loadAdminData();
      setBanner({
        type: 'ok',
        text: `${u.name} (${u.userId}) is now ${!u.active ? 'Active' : 'Deactivated'}.`,
      });
    } catch (err) {
      setBanner({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to update user status',
      });
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget) return;
    try {
      await apiRequest(`/api/admin/users/${resetTarget.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ resetPassword: newResetPass }),
      });
      setBanner({
        type: 'ok',
        text: `Reset temporary password for ${resetTarget.name} (${resetTarget.userId}). User will be prompted to change it on next login.`,
      });
      setResetTarget(null);
      await loadAdminData();
    } catch (err) {
      setBanner({
        type: 'err',
        text: err instanceof Error ? err.message : 'Password reset failed',
      });
    }
  };

  const handleSaveScheduler = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiRequest<{ schedulerConfig: SchedulerConfig }>(
        '/api/scheduler/config',
        {
          method: 'PUT',
          body: JSON.stringify(scheduler),
        }
      );
      setScheduler(res.schedulerConfig);
      setBanner({
        type: 'ok',
        text: `Saved AI Calling Scheduler configuration (Pass 1: ${res.schedulerConfig.firstPassTime}, Pass 2: ${res.schedulerConfig.secondPassTime}).`,
      });
      await loadAdminData();
    } catch (err) {
      setBanner({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to update scheduler config',
      });
    }
  };

  const filteredLogs = auditLogs.filter((l) => {
    if (!searchLog.trim()) return true;
    const q = searchLog.toLowerCase();
    return (
      l.actorName.toLowerCase().includes(q) ||
      l.action.toLowerCase().includes(q) ||
      l.summary.toLowerCase().includes(q) ||
      l.entity.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      {/* Top Admin Header */}
      <header className="bg-[#0f172a] text-white px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[12px] bg-[#2563eb] flex items-center justify-center text-white">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <span className="text-base font-bold tracking-tight">ATTEND AI · ADMIN CONSOLE</span>
              <p className="text-xs text-[#94a3b8]">
                Provision HOD & Teacher Accounts · AI Calling Scheduler · Security Audit Trail
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-semibold text-white">{currentUser.name}</div>
              <div className="text-[11px] font-mono-num text-[#94a3b8]">{currentUser.userId}</div>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="px-3.5 py-2 rounded-[10px] bg-white/10 hover:bg-white/20 text-xs font-semibold text-white flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-[#e2e8f0] px-6">
        <div className="max-w-7xl mx-auto flex items-center gap-2 py-2.5 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-[10px] text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'users'
                ? 'bg-[#2563eb] text-white shadow-xs'
                : 'text-[#64748b] hover:text-[#0f172a]'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>HOD & Teacher Accounts ({users.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('scheduler')}
            className={`px-4 py-2 rounded-[10px] text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'scheduler'
                ? 'bg-[#2563eb] text-white shadow-xs'
                : 'text-[#64748b] hover:text-[#0f172a]'
            }`}
          >
            <PhoneCall className="w-4 h-4" />
            <span>AI Calling Scheduler & Telephony</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            className={`px-4 py-2 rounded-[10px] text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'audit'
                ? 'bg-[#2563eb] text-white shadow-xs'
                : 'text-[#64748b] hover:text-[#0f172a]'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Security Audit Logs ({auditLogs.length})</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-7 space-y-6">
        {banner && (
          <div
            className={`p-4 rounded-[12px] text-xs font-semibold flex items-center justify-between ${
              banner.type === 'ok'
                ? 'bg-[#dcfce7] text-[#16a34a]'
                : 'bg-[#fee2e2] text-[#dc2626]'
            }`}
          >
            <span className="flex items-center gap-2">
              {banner.type === 'ok' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              {banner.text}
            </span>
            <button type="button" onClick={() => setBanner(null)}>
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* TAB 1: STAFF USER MANAGEMENT */}
        {activeTab === 'users' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Create HOD or Teacher Account */}
            <div className="lg:col-span-5 bg-white border border-[#e2e8f0] rounded-[16px] p-6 shadow-xs self-start">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 rounded-[10px] bg-[#eff6ff] text-[#2563eb] flex items-center justify-center">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#0f172a]">Create Staff Account</h2>
                  <p className="text-xs text-[#64748b]">
                    Provision HOD or Teacher credentials
                  </p>
                </div>
              </div>

              {/* Role Switcher */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-[#f8fafc] border border-[#e2e8f0] rounded-[10px] mb-4">
                <button
                  type="button"
                  onClick={() => {
                    setCreateRole('hod');
                    setUniqueUserId(`HOD-DEPT-0${users.length}`);
                  }}
                  className={`py-2 rounded-[8px] text-xs font-semibold transition-colors cursor-pointer ${
                    createRole === 'hod'
                      ? 'bg-[#2563eb] text-white shadow-xs'
                      : 'text-[#64748b] hover:text-[#0f172a]'
                  }`}
                >
                  Create HOD Account
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCreateRole('teacher');
                    setUniqueUserId(`TCH-FAC-0${users.length}`);
                  }}
                  className={`py-2 rounded-[8px] text-xs font-semibold transition-colors cursor-pointer ${
                    createRole === 'teacher'
                      ? 'bg-[#2563eb] text-white shadow-xs'
                      : 'text-[#64748b] hover:text-[#0f172a]'
                  }`}
                >
                  Create Teacher Account
                </button>
              </div>

              <form onSubmit={handleCreateUser} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-[#0f172a] mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g., Dr. Alok Nath Mishra"
                    className="w-full px-3.5 py-2 text-xs border border-[#e2e8f0] rounded-[10px]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#0f172a] mb-1">
                      Unique User ID *
                    </label>
                    <input
                      type="text"
                      required
                      value={uniqueUserId}
                      onChange={(e) => setUniqueUserId(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs font-mono-num border border-[#e2e8f0] rounded-[10px]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#0f172a] mb-1">
                      Temporary Password *
                    </label>
                    <input
                      type="text"
                      required
                      value={tempPassword}
                      onChange={(e) => setTempPassword(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs font-mono-num border border-[#e2e8f0] rounded-[10px]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#0f172a] mb-1">
                      Email (for Google Sign-In) *
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="faculty@attendai.edu.in"
                      className="w-full px-3.5 py-2 text-xs border border-[#e2e8f0] rounded-[10px]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#0f172a] mb-1">
                      Mobile Number *
                    </label>
                    <input
                      type="text"
                      required
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs font-mono-num border border-[#e2e8f0] rounded-[10px]"
                    />
                  </div>
                </div>

                {createRole === 'hod' ? (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-[#0f172a] mb-1.5">
                        Assigned Courses
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {courses.map((c) => {
                          const active = selectedCourses.includes(c.id);
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => handleToggleCourse(c.id)}
                              className={`px-2.5 py-1 rounded-[8px] text-xs font-semibold border cursor-pointer ${
                                active
                                  ? 'bg-[#eff6ff] border-[#2563eb] text-[#2563eb]'
                                  : 'border-[#e2e8f0] text-[#64748b]'
                              }`}
                            >
                              {c.code}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#0f172a] mb-1.5">
                        Assigned Department Branches
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {branches.map((b) => {
                          const active = selectedDepts.includes(b.code);
                          return (
                            <button
                              key={b.id}
                              type="button"
                              onClick={() => handleToggleDept(b.code)}
                              className={`px-2.5 py-1 rounded-[8px] text-xs font-semibold border cursor-pointer ${
                                active
                                  ? 'bg-[#2563eb] border-[#2563eb] text-white'
                                  : 'border-[#e2e8f0] text-[#64748b]'
                              }`}
                            >
                              {b.code}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="p-3.5 rounded-[12px] bg-[#f8fafc] border border-[#e2e8f0] space-y-3">
                    <label className="block text-xs font-bold text-[#0f172a]">
                      Assign Course + Branch + Year Combinations
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <select
                        value={draftCourseId}
                        onChange={(e) => {
                          const cid = e.target.value;
                          setDraftCourseId(cid);
                          const firstBr = branches.find((b) => b.courseId === cid);
                          if (firstBr) setDraftBranchId(firstBr.id);
                        }}
                        className="px-2 py-1.5 text-xs bg-white border border-[#e2e8f0] rounded-[8px]"
                      >
                        {courses.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.code}
                          </option>
                        ))}
                      </select>
                      <select
                        value={draftBranchId}
                        onChange={(e) => setDraftBranchId(e.target.value)}
                        className="px-2 py-1.5 text-xs bg-white border border-[#e2e8f0] rounded-[8px]"
                      >
                        {branches
                          .filter((b) => b.courseId === draftCourseId)
                          .map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.code}
                            </option>
                          ))}
                      </select>
                      <select
                        value={draftYear}
                        onChange={(e) => setDraftYear(Number(e.target.value))}
                        className="px-2 py-1.5 text-xs bg-white border border-[#e2e8f0] rounded-[8px]"
                      >
                        {[1, 2, 3, 4].map((y) => (
                          <option key={y} value={y}>
                            Year {y}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddTeacherAssignment}
                      className="w-full py-1.5 rounded-[8px] border border-[#2563eb] text-[#2563eb] text-xs font-semibold hover:bg-[#eff6ff] flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Class Combination
                    </button>

                    <div className="space-y-1.5 pt-1">
                      {teacherAssignments.map((a, idx) => {
                        const c = courses.find((x) => x.id === a.courseId);
                        const b = branches.find((x) => x.id === a.branchId);
                        return (
                          <div
                            key={`${a.courseId}-${a.branchId}-${a.year}`}
                            className="flex items-center justify-between px-2.5 py-1.5 rounded-[8px] bg-white border border-[#e2e8f0] text-xs"
                          >
                            <span className="font-semibold text-[#0f172a]">
                              {c?.code} · {b?.code} · Year {a.year}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setTeacherAssignments((prev) =>
                                  prev.filter((_, i) => i !== idx)
                                )
                              }
                              className="text-[#dc2626]"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={creatingUser}
                  className="w-full py-2.5 px-4 rounded-[10px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  {creatingUser
                    ? 'Creating Account...'
                    : `Create ${createRole.toUpperCase()} Account`}
                </button>
              </form>
            </div>

            {/* Right Column: All Provisioned Users Table */}
            <div className="lg:col-span-7 bg-white border border-[#e2e8f0] rounded-[16px] overflow-hidden shadow-xs self-start">
              <div className="p-5 border-b border-[#e2e8f0] flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-[#0f172a]">
                    All Provisioned Staff Accounts
                  </h2>
                  <p className="text-xs text-[#64748b]">
                    Reset passwords, force first-login password change, or deactivate accounts
                  </p>
                </div>
              </div>

              {loading ? (
                <div className="p-6 space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-12 bg-[#f1f5f9] rounded-[8px] animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#f8fafc] border-b border-[#e2e8f0] text-[11px] font-semibold text-[#64748b] uppercase">
                        <th className="py-3 px-4">User ID & Name</th>
                        <th className="py-3 px-4">Role</th>
                        <th className="py-3 px-4">Assigned Scope</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e2e8f0]">
                      {users.map((u) => (
                        <tr key={u.id} className="hover:bg-[#f8fafc]">
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-[#0f172a]">{u.name}</div>
                            <div className="font-mono-num text-[11px] text-[#64748b]">
                              {u.userId} · {u.email}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 uppercase font-bold">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[11px] ${
                                u.role === 'admin'
                                  ? 'bg-[#0f172a] text-white'
                                  : u.role === 'hod'
                                  ? 'bg-[#eff6ff] text-[#2563eb]'
                                  : 'bg-[#dcfce7] text-[#16a34a]'
                              }`}
                            >
                              {u.role}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex flex-wrap gap-1">
                              {u.departments.map((d) => (
                                <span
                                  key={d}
                                  className="px-2 py-0.5 rounded bg-[#f1f5f9] text-[#0f172a] text-[10px] font-semibold"
                                >
                                  {d}
                                </span>
                              ))}
                            </div>
                            {u.mustChangePassword && (
                              <span className="inline-block mt-1 text-[10px] font-semibold text-[#b45309]">
                                Must Change Password on Login
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            {u.active ? (
                              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#dcfce7] text-[#16a34a]">
                                Active
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#fee2e2] text-[#dc2626]">
                                Deactivated
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setResetTarget(u);
                                  setNewResetPass('Reset@123');
                                }}
                                className="px-2.5 py-1.5 rounded-[8px] border border-[#e2e8f0] text-[#0f172a] hover:border-[#2563eb] text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                              >
                                <KeyRound className="w-3 h-3 text-[#2563eb]" />
                                <span>Reset Pass</span>
                              </button>

                              {u.id !== currentUser.id && (
                                <button
                                  type="button"
                                  onClick={() => handleToggleUserActive(u)}
                                  className={`px-2.5 py-1.5 rounded-[8px] text-[11px] font-semibold flex items-center gap-1 cursor-pointer ${
                                    u.active
                                      ? 'bg-[#fee2e2] text-[#dc2626]'
                                      : 'bg-[#dcfce7] text-[#16a34a]'
                                  }`}
                                >
                                  <Power className="w-3 h-3" />
                                  <span>{u.active ? 'Deactivate' : 'Activate'}</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: AI CALLING SCHEDULER & TELEPHONY CONFIG */}
        {activeTab === 'scheduler' && (
          <div className="bg-white border border-[#e2e8f0] rounded-[16px] p-6 max-w-3xl shadow-xs">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-[12px] bg-[#eff6ff] text-[#2563eb] flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#0f172a]">
                  Automated AI Calling Scheduler Configuration
                </h2>
                <p className="text-xs text-[#64748b]">
                  Configure daily calling passes, allowed privacy window, retry policy, and default language
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveScheduler} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#0f172a] mb-1">
                    First Automated Pass Time (Default 12:00 PM)
                  </label>
                  <input
                    type="time"
                    value={scheduler.firstPassTime}
                    onChange={(e) =>
                      setScheduler({ ...scheduler, firstPassTime: e.target.value })
                    }
                    className="w-full px-3.5 py-2 text-xs font-mono-num border border-[#e2e8f0] rounded-[10px]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#0f172a] mb-1">
                    Second Pass / Retry Pass Time (Default 01:00 PM)
                  </label>
                  <input
                    type="time"
                    value={scheduler.secondPassTime}
                    onChange={(e) =>
                      setScheduler({ ...scheduler, secondPassTime: e.target.value })
                    }
                    className="w-full px-3.5 py-2 text-xs font-mono-num border border-[#e2e8f0] rounded-[10px]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#0f172a] mb-1">
                    Default Call Language
                  </label>
                  <select
                    value={scheduler.defaultLanguage}
                    onChange={(e) =>
                      setScheduler({
                        ...scheduler,
                        defaultLanguage: e.target.value as CallLanguage,
                      })
                    }
                    className="w-full px-3.5 py-2 text-xs border border-[#e2e8f0] rounded-[10px] bg-white"
                  >
                    <option value="hi-IN">Hindi (hi-IN) — Default</option>
                    <option value="en-IN">English (en-IN)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#0f172a] mb-1">
                    Default Phone Number to Call
                  </label>
                  <select
                    value={scheduler.defaultContactTarget}
                    onChange={(e) =>
                      setScheduler({
                        ...scheduler,
                        defaultContactTarget: e.target.value as 'student' | 'guardian',
                      })
                    }
                    className="w-full px-3.5 py-2 text-xs border border-[#e2e8f0] rounded-[10px] bg-white"
                  >
                    <option value="guardian">Parent / Guardian Mobile</option>
                    <option value="student">Student Mobile</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#0f172a] mb-1">
                    Max Retries on No Answer
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={scheduler.maxRetries}
                    onChange={(e) =>
                      setScheduler({ ...scheduler, maxRetries: Number(e.target.value) })
                    }
                    className="w-full px-3.5 py-2 text-xs font-mono-num border border-[#e2e8f0] rounded-[10px]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#0f172a] mb-1">
                    Retry Gap (Minutes)
                  </label>
                  <input
                    type="number"
                    min={15}
                    max={120}
                    value={scheduler.retryGapMinutes}
                    onChange={(e) =>
                      setScheduler({ ...scheduler, retryGapMinutes: Number(e.target.value) })
                    }
                    className="w-full px-3.5 py-2 text-xs font-mono-num border border-[#e2e8f0] rounded-[10px]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#0f172a] mb-1">
                    Telephony Mode
                  </label>
                  <select
                    value={scheduler.providerMode}
                    onChange={(e) =>
                      setScheduler({
                        ...scheduler,
                        providerMode: e.target.value as 'test_mock' | 'twilio_live',
                      })
                    }
                    className="w-full px-3.5 py-2 text-xs border border-[#e2e8f0] rounded-[10px] bg-white"
                  >
                    <option value="test_mock">Test Mode (Mock Telephony + Live Gemini AI)</option>
                    <option value="twilio_live">Twilio Voice Provider + Gemini AI</option>
                  </select>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-[10px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-semibold cursor-pointer"
                >
                  Save Scheduler Settings
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TAB 3: AUDIT LOGS */}
        {activeTab === 'audit' && (
          <div className="bg-white border border-[#e2e8f0] rounded-[16px] overflow-hidden shadow-xs">
            <div className="p-5 border-b border-[#e2e8f0] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-[#0f172a]">
                  Immutable System Audit Log
                </h2>
                <p className="text-xs text-[#64748b]">
                  Tracks who did what and when across Admin, HOD, Teacher, and AI Calling actions
                </p>
              </div>

              <div className="relative max-w-xs w-full">
                <Search className="w-4 h-4 text-[#64748b] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchLog}
                  onChange={(e) => setSearchLog(e.target.value)}
                  placeholder="Filter by actor, action, or entity..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#f8fafc] border border-[#e2e8f0] rounded-[10px]"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#f8fafc] border-b border-[#e2e8f0] text-[11px] font-semibold text-[#64748b] uppercase">
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Actor & Role</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Entity</th>
                    <th className="py-3 px-4">Summary & State Diff</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e2e8f0]">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-[#f8fafc]">
                      <td className="py-3 px-4 font-mono-num text-[11px] text-[#64748b] whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-semibold text-[#0f172a]">{log.actorName}</div>
                        <span className="text-[10px] uppercase font-bold text-[#2563eb]">
                          {log.actorRole}
                        </span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-[#eff6ff] text-[#2563eb] font-mono-num text-[11px] font-semibold">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono-num text-[#64748b] whitespace-nowrap">
                        {log.entity}
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-[#0f172a] font-medium">{log.summary}</div>
                        {(log.before || log.after) && (
                          <div className="text-[11px] font-mono-num text-[#64748b] mt-0.5 truncate max-w-xl">
                            {log.before ? `Before: ${JSON.stringify(log.before)} → ` : ''}
                            {log.after ? `After: ${JSON.stringify(log.after)}` : ''}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Password Reset Modal */}
      {resetTarget && (
        <div className="fixed inset-0 z-50 bg-[#0f172a]/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#e2e8f0] rounded-[22px] max-w-md w-full p-6 shadow-xl">
            <h3 className="text-base font-bold text-[#0f172a] mb-1">
              Reset Password for {resetTarget.name}
            </h3>
            <p className="text-xs text-[#64748b] mb-4">
              Account ID: <span className="font-mono-num font-semibold">{resetTarget.userId}</span>. Setting a temporary password will require the user to change it on their next sign-in.
            </p>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#0f172a] mb-1">
                  New Temporary Password
                </label>
                <input
                  type="text"
                  required
                  value={newResetPass}
                  onChange={(e) => setNewResetPass(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs font-mono-num border border-[#e2e8f0] rounded-[10px]"
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setResetTarget(null)}
                  className="px-4 py-2 rounded-[10px] border border-[#e2e8f0] text-xs font-medium text-[#64748b]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-[10px] bg-[#2563eb] text-white text-xs font-semibold cursor-pointer"
                >
                  Confirm Password Reset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
