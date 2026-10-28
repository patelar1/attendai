import React, { useState, useEffect } from 'react';
import {
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  Users,
  Save,
  CheckCheck,
  Lock,
  Unlock,
  Download,
  Search,
  AlertCircle,
  Filter,
} from 'lucide-react';
import {
  Student,
  Course,
  Branch,
  UserRole,
  AttendanceRecord,
  AttendanceStatus,
  PastDateApprovalRequest,
} from '../types.ts';
import { apiRequest } from '../api.ts';

interface TakeAttendanceProps {
  activeRole: UserRole;
  course: Course;
  branch: Branch;
  year: number;
  onAttendanceSaved?: () => void;
}

const RECENT_DATES = [
  '2026-10-26',
  '2026-10-24',
  '2026-10-23',
  '2026-10-22',
  '2026-10-21',
  '2026-10-20',
  '2026-10-19',
];

export const TakeAttendanceView: React.FC<TakeAttendanceProps> = ({
  activeRole,
  course,
  branch,
  year,
  onAttendanceSaved,
}) => {
  const [selectedDate, setSelectedDate] = useState<string>('2026-10-26');
  const [students, setStudents] = useState<Student[]>([]);
  const [statusMap, setStatusMap] = useState<Record<string, AttendanceStatus>>({});
  const [canEditDate, setCanEditDate] = useState<boolean>(true);
  const [isSameDay, setIsSameDay] = useState<boolean>(true);
  const [approvalStatus, setApprovalStatus] = useState<'pending' | 'approved' | 'rejected' | null>(null);
  const [pendingRequests, setPendingRequests] = useState<PastDateApprovalRequest[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [search, setSearch] = useState<string>('');
  const [banner, setBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const loadData = async () => {
    setLoading(true);
    setBanner(null);
    try {
      const [stuRes, attRes] = await Promise.all([
        apiRequest<{ students: Student[] }>(
          `/api/students?courseId=${encodeURIComponent(course.id)}&branchId=${encodeURIComponent(
            branch.id
          )}&year=${year}`
        ),
        apiRequest<{
          date: string;
          todayDate: string;
          isSameDay: boolean;
          canEdit: boolean;
          approvalStatus: 'pending' | 'approved' | 'rejected' | null;
          records: AttendanceRecord[];
        }>(
          `/api/attendance/daily?courseId=${encodeURIComponent(
            course.id
          )}&branchId=${encodeURIComponent(branch.id)}&year=${year}&date=${selectedDate}`
        ),
      ]);

      const activeStus = stuRes.students.filter((s) => s.status === 'active');
      setStudents(activeStus);
      setCanEditDate(attRes.canEdit);
      setIsSameDay(attRes.isSameDay);
      setApprovalStatus(attRes.approvalStatus);

      const map: Record<string, AttendanceStatus> = {};
      for (const s of activeStus) {
        const rec = attRes.records.find((r) => r.studentId === s.id);
        map[s.id] = rec ? rec.status : 'present';
      }
      setStatusMap(map);

      if (activeRole === 'hod' || activeRole === 'admin') {
        const reqRes = await apiRequest<{ requests: PastDateApprovalRequest[] }>(
          '/api/attendance/approval-requests'
        );
        setPendingRequests(reqRes.requests.filter((r) => r.status === 'pending'));
      }
    } catch (err) {
      setBanner({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to load attendance data',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [course.id, branch.id, year, selectedDate]);

  const handleToggleStatus = (studentId: string, newStatus: AttendanceStatus) => {
    if (!canEditDate) return;
    setStatusMap((prev) => ({
      ...prev,
      [studentId]: newStatus,
    }));
  };

  const handleMarkAllPresent = () => {
    if (!canEditDate) return;
    const next: Record<string, AttendanceStatus> = {};
    for (const s of students) {
      next[s.id] = 'present';
    }
    setStatusMap(next);
  };

  const handleSaveAttendance = async () => {
    if (!canEditDate) return;
    setSaving(true);
    setBanner(null);
    try {
      const entries = students.map((s) => ({
        studentId: s.id,
        status: statusMap[s.id] || 'present',
      }));

      const res = await apiRequest<{
        ok: boolean;
        summary: {
          total: number;
          present: number;
          absent: number;
          leave: number;
          newFollowupsCreated: number;
        };
      }>('/api/attendance/daily', {
        method: 'POST',
        body: JSON.stringify({
          courseId: course.id,
          branchId: branch.id,
          year,
          date: selectedDate,
          entries,
        }),
      });

      setBanner({
        type: 'ok',
        text: `Attendance saved for ${selectedDate}: ${res.summary.present} Present, ${res.summary.absent} Absent, ${res.summary.leave} Leave. (${res.summary.absent} absent students queued in Absent & AI Calls)`,
      });
      onAttendanceSaved?.();
    } catch (err) {
      setBanner({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to save attendance',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRequestPastApproval = async () => {
    try {
      await apiRequest('/api/attendance/request-approval', {
        method: 'POST',
        body: JSON.stringify({
          courseId: course.id,
          branchId: branch.id,
          year,
          date: selectedDate,
          reason: 'Late medical/leave update requested by class teacher',
        }),
      });
      setApprovalStatus('pending');
      setBanner({
        type: 'ok',
        text: `Sent approval request to HOD to unlock attendance for ${selectedDate}.`,
      });
    } catch (err) {
      setBanner({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to request HOD approval',
      });
    }
  };

  const handleHodResolveRequest = async (reqId: string, status: 'approved' | 'rejected') => {
    try {
      await apiRequest(`/api/attendance/approval-requests/${reqId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await loadData();
    } catch {
      // ignore
    }
  };

  const totalCount = students.length;
  const presentCount = students.filter((s) => statusMap[s.id] === 'present').length;
  const absentCount = students.filter((s) => statusMap[s.id] === 'absent').length;
  const leaveCount = students.filter((s) => statusMap[s.id] === 'leave').length;

  const filteredStudents = students.filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return s.rollNo.toLowerCase().includes(q) || s.name.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-5">
      {/* HOD Pending Past-Date Approval Requests Banner */}
      {(activeRole === 'hod' || activeRole === 'admin') && pendingRequests.length > 0 && (
        <div className="bg-[#eff6ff] border border-[#2563eb]/30 rounded-[14px] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold text-[#2563eb]">
              Pending Teacher Requests for Past-Date Attendance Correction ({pendingRequests.length})
            </div>
            <div className="text-xs text-[#0f172a] mt-0.5">
              {pendingRequests[0].requestedByName} requested unlock for{' '}
              <span className="font-mono-num font-semibold">{pendingRequests[0].date}</span> — "{pendingRequests[0].reason}"
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleHodResolveRequest(pendingRequests[0].id, 'approved')}
              className="px-3 py-1.5 rounded-[8px] bg-[#16a34a] text-white text-xs font-semibold cursor-pointer"
            >
              Approve Unlock
            </button>
            <button
              type="button"
              onClick={() => handleHodResolveRequest(pendingRequests[0].id, 'rejected')}
              className="px-3 py-1.5 rounded-[8px] bg-white border border-[#e2e8f0] text-[#dc2626] text-xs font-semibold cursor-pointer"
            >
              Decline
            </button>
          </div>
        </div>
      )}

      {/* Top Controls Card: Date Picker & Action Shortcuts */}
      <div className="bg-white border border-[#e2e8f0] rounded-[16px] p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-bold text-[#0f172a]">Daily Attendance Register</h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#eff6ff] text-[#2563eb]">
                {course.code} · {branch.code} · Year {year}
              </span>
            </div>
            <p className="text-xs text-[#64748b] mt-1">
              One attendance record per student per date. Students marked Absent are automatically queued for AI Follow-up Calls.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2 bg-[#f8fafc] border border-[#e2e8f0] px-3 py-2 rounded-[10px]">
              <Calendar className="w-4 h-4 text-[#2563eb]" />
              <label className="text-xs font-semibold text-[#64748b]">Date:</label>
              <input
                type="date"
                value={selectedDate}
                max="2026-10-26"
                onChange={(e) => setSelectedDate(e.target.value)}
                className="text-xs font-mono-num font-semibold text-[#0f172a] bg-transparent focus:outline-none"
              />
            </div>

            <button
              type="button"
              disabled={!canEditDate}
              onClick={handleMarkAllPresent}
              className={`px-3.5 py-2.5 rounded-[10px] border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                canEditDate
                  ? 'bg-white border-[#e2e8f0] text-[#0f172a] hover:border-[#16a34a] hover:text-[#16a34a] cursor-pointer'
                  : 'bg-[#f1f5f9] border-[#e2e8f0] text-[#64748b] opacity-65 cursor-not-allowed'
              }`}
            >
              <CheckCheck className="w-4 h-4" />
              <span>Mark All Present</span>
            </button>

            <button
              type="button"
              disabled={!canEditDate || saving}
              onClick={handleSaveAttendance}
              className={`px-5 py-2.5 rounded-[10px] text-xs font-semibold flex items-center gap-2 transition-colors ${
                canEditDate
                  ? 'bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-xs cursor-pointer'
                  : 'bg-[#e2e8f0] text-[#64748b] cursor-not-allowed'
              }`}
            >
              {canEditDate ? <Save className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
              <span>{saving ? 'Saving...' : 'Save Attendance'}</span>
            </button>
          </div>
        </div>

        {/* Quick Date Pills */}
        <div className="mt-4 pt-3.5 border-t border-[#e2e8f0] flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold text-[#64748b] mr-1">Quick Dates:</span>
            {RECENT_DATES.map((dt) => (
              <button
                key={dt}
                type="button"
                onClick={() => setSelectedDate(dt)}
                className={`px-2.5 py-1 rounded-[8px] text-[11px] font-mono-num font-medium border transition-colors cursor-pointer ${
                  selectedDate === dt
                    ? 'bg-[#2563eb] border-[#2563eb] text-white font-semibold'
                    : 'bg-[#f8fafc] border-[#e2e8f0] text-[#64748b] hover:text-[#0f172a]'
                }`}
              >
                {dt === '2026-10-26' ? `${dt} (Today)` : dt}
              </button>
            ))}
          </div>

          {!isSameDay && activeRole === 'teacher' && (
            <div className="flex items-center gap-2">
              {canEditDate ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#16a34a]">
                  <Unlock className="w-3.5 h-3.5" /> HOD Approved Past-Date Edit
                </span>
              ) : approvalStatus === 'pending' ? (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-[8px] bg-[#fef3c7] text-[#b45309] text-xs font-semibold">
                  <Clock className="w-3.5 h-3.5" /> Pending HOD Approval
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleRequestPastApproval}
                  className="px-3 py-1 rounded-[8px] bg-[#fef3c7] hover:bg-[#fde68a] text-[#b45309] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Past Date Locked · Request HOD Approval</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 4 Summary Cards: Total, Present, Absent, On Leave */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#e2e8f0] rounded-[14px] p-4 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-[#64748b]">Total Students</div>
            <div className="text-2xl font-bold font-mono-num text-[#0f172a] mt-1">{totalCount}</div>
          </div>
          <div className="w-10 h-10 rounded-[10px] bg-[#eff6ff] text-[#2563eb] flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-[#e2e8f0] rounded-[14px] p-4 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-[#64748b]">Present Today</div>
            <div className="text-2xl font-bold font-mono-num text-[#16a34a] mt-1">
              {presentCount}
            </div>
          </div>
          <div className="w-10 h-10 rounded-[10px] bg-[#dcfce7] text-[#16a34a] flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-[#e2e8f0] rounded-[14px] p-4 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-[#64748b]">Absent (AI Call Queue)</div>
            <div className="text-2xl font-bold font-mono-num text-[#dc2626] mt-1">
              {absentCount}
            </div>
          </div>
          <div className="w-10 h-10 rounded-[10px] bg-[#fee2e2] text-[#dc2626] flex items-center justify-center">
            <XCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-[#e2e8f0] rounded-[14px] p-4 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-[#64748b]">On Approved Leave</div>
            <div className="text-2xl font-bold font-mono-num text-[#b45309] mt-1">{leaveCount}</div>
          </div>
          <div className="w-10 h-10 rounded-[10px] bg-[#fef3c7] text-[#b45309] flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {banner && (
        <div
          className={`p-4 rounded-[12px] text-xs font-semibold flex items-center gap-2.5 ${
            banner.type === 'ok'
              ? 'bg-[#dcfce7] text-[#16a34a] border border-[#16a34a]/20'
              : 'bg-[#fee2e2] text-[#dc2626] border border-[#dc2626]/20'
          }`}
        >
          {banner.type === 'ok' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{banner.text}</span>
        </div>
      )}

      {/* Attendance Marking Table */}
      <div className="bg-white border border-[#e2e8f0] rounded-[16px] overflow-hidden shadow-xs">
        <div className="p-4 border-b border-[#e2e8f0] flex items-center justify-between gap-4">
          <div className="relative max-w-sm w-full">
            <Search className="w-4 h-4 text-[#64748b] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter students by Roll No or Name..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#f8fafc] border border-[#e2e8f0] rounded-[10px] focus:outline-none focus:bg-white focus:border-[#2563eb]"
            />
          </div>
          <span className="text-xs text-[#64748b] font-mono-num">
            Showing {filteredStudents.length} active students
          </span>
        </div>

        {loading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-10 bg-[#f1f5f9] rounded-[8px] animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f8fafc] border-b border-[#e2e8f0] text-[11px] font-semibold text-[#64748b] uppercase tracking-wider">
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">Roll No</th>
                  <th className="py-3 px-4">Student Name</th>
                  <th className="py-3 px-4">Guardian Mobile</th>
                  <th className="py-3 px-4">Current Status</th>
                  <th className="py-3 px-4 text-right">Mark Attendance (Present / Absent / Leave)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e2e8f0] text-xs">
                {filteredStudents.map((stu, idx) => {
                  const st = statusMap[stu.id] || 'present';
                  return (
                    <tr key={stu.id} className="hover:bg-[#f8fafc] transition-colors">
                      <td className="py-3 px-4 font-mono-num text-[#64748b]">{idx + 1}</td>
                      <td className="py-3 px-4 font-mono-num font-semibold text-[#0f172a]">
                        {stu.rollNo}
                      </td>
                      <td className="py-3 px-4 font-semibold text-[#0f172a]">{stu.name}</td>
                      <td className="py-3 px-4 font-mono-num text-[#64748b]">
                        {stu.guardianMobile}
                      </td>
                      <td className="py-3 px-4">
                        {st === 'present' && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#dcfce7] text-[#16a34a]">
                            Present
                          </span>
                        )}
                        {st === 'absent' && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#fee2e2] text-[#dc2626]">
                            Absent
                          </span>
                        )}
                        {st === 'leave' && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#fef3c7] text-[#b45309]">
                            On Leave
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5 bg-[#f8fafc] p-1 rounded-[10px] border border-[#e2e8f0]">
                          <button
                            type="button"
                            disabled={!canEditDate}
                            onClick={() => handleToggleStatus(stu.id, 'present')}
                            className={`px-3 py-1 rounded-[8px] text-xs font-semibold transition-all ${
                              st === 'present'
                                ? 'bg-[#16a34a] text-white shadow-xs'
                                : 'text-[#64748b] hover:text-[#0f172a]'
                            } ${!canEditDate ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                          >
                            Present
                          </button>

                          <button
                            type="button"
                            disabled={!canEditDate}
                            onClick={() => handleToggleStatus(stu.id, 'absent')}
                            className={`px-3 py-1 rounded-[8px] text-xs font-semibold transition-all ${
                              st === 'absent'
                                ? 'bg-[#dc2626] text-white shadow-xs'
                                : 'text-[#64748b] hover:text-[#0f172a]'
                            } ${!canEditDate ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                          >
                            Absent
                          </button>

                          <button
                            type="button"
                            disabled={!canEditDate}
                            onClick={() => handleToggleStatus(stu.id, 'leave')}
                            className={`px-3 py-1 rounded-[8px] text-xs font-semibold transition-all ${
                              st === 'leave'
                                ? 'bg-[#f59e0b] text-white shadow-xs'
                                : 'text-[#64748b] hover:text-[#0f172a]'
                            } ${!canEditDate ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                          >
                            Leave
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// Attendance Data & Analytics View (Progress Bars >= 75% Green, < 75% Red, CSV Export)
// ============================================================================
interface SummaryRow {
  studentId: string;
  rollNo: string;
  name: string;
  mobile: string;
  guardianMobile: string;
  status: string;
  totalDays: number;
  present: number;
  absent: number;
  leave: number;
  percentage: number;
}

interface AttendanceDataProps {
  course: Course;
  branch: Branch;
  year: number;
}

export const AttendanceDataView: React.FC<AttendanceDataProps> = ({ course, branch, year }) => {
  const [rows, setRows] = useState<SummaryRow[]>([]);
  const [fromDate, setFromDate] = useState<string>('2026-10-01');
  const [toDate, setToDate] = useState<string>('2026-10-26');
  const [search, setSearch] = useState<string>('');
  const [shortageOnly, setShortageOnly] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  const loadSummary = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<{ summaryRows: SummaryRow[] }>(
        `/api/attendance/summary?courseId=${encodeURIComponent(
          course.id
        )}&branchId=${encodeURIComponent(
          branch.id
        )}&year=${year}&fromDate=${fromDate}&toDate=${toDate}`
      );
      setRows(res.summaryRows);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, [course.id, branch.id, year, fromDate, toDate]);

  const filtered = rows.filter((r) => {
    if (shortageOnly && r.percentage >= 75) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return r.rollNo.toLowerCase().includes(q) || r.name.toLowerCase().includes(q);
  });

  const handleExportCsv = () => {
    const headers = [
      'Roll No',
      'Student Name',
      'Student Mobile',
      'Guardian Mobile',
      'Total Days',
      'Present',
      'Absent',
      'On Leave',
      'Attendance Percentage',
      'Standing',
    ];
    const csvLines = [
      headers.join(','),
      ...filtered.map((r) =>
        [
          r.rollNo,
          `"${r.name}"`,
          r.mobile,
          r.guardianMobile,
          r.totalDays,
          r.present,
          r.absent,
          r.leave,
          `${r.percentage}%`,
          r.percentage >= 75 ? 'Eligible (>=75%)' : 'Shortage (<75%)',
        ].join(',')
      ),
    ];

    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Attendance_${course.code}_${branch.code}_Yr${year}_${fromDate}_to_${toDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const eligibleCount = rows.filter((r) => r.percentage >= 75).length;
  const shortageCount = rows.filter((r) => r.percentage < 75).length;

  return (
    <div className="space-y-5">
      {/* Header & Filter Controls */}
      <div className="bg-white border border-[#e2e8f0] rounded-[16px] p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-bold text-[#0f172a]">Attendance Analytics & Reports</h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#eff6ff] text-[#2563eb]">
                {course.code} · {branch.code} · Year {year}
              </span>
            </div>
            <p className="text-xs text-[#64748b] mt-1">
              Cumulative attendance breakdown per student. Green indicates 75% or above; red flags attendance shortage below 75%.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2 bg-[#f8fafc] border border-[#e2e8f0] px-3 py-1.5 rounded-[10px] text-xs">
              <Filter className="w-3.5 h-3.5 text-[#64748b]" />
              <span className="text-[#64748b]">From:</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="font-mono-num font-semibold text-[#0f172a] bg-transparent focus:outline-none"
              />
              <span className="text-[#cbd5e1]">—</span>
              <span className="text-[#64748b]">To:</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="font-mono-num font-semibold text-[#0f172a] bg-transparent focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={handleExportCsv}
              className="px-4 py-2 rounded-[10px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-semibold flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-[#e2e8f0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative max-w-sm w-full">
            <Search className="w-4 h-4 text-[#64748b] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search student by Roll No or Name..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#f8fafc] border border-[#e2e8f0] rounded-[10px] focus:outline-none focus:bg-white focus:border-[#2563eb]"
            />
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-[#16a34a] font-semibold">
              &ge; 75% Regular: <strong className="font-mono-num">{eligibleCount}</strong>
            </span>
            <span className="text-[#cbd5e1]">·</span>
            <span className="text-xs text-[#dc2626] font-semibold">
              &lt; 75% Shortage: <strong className="font-mono-num">{shortageCount}</strong>
            </span>
            <button
              type="button"
              onClick={() => setShortageOnly(!shortageOnly)}
              className={`px-3 py-1.5 rounded-[8px] text-xs font-semibold border transition-colors cursor-pointer ${
                shortageOnly
                  ? 'bg-[#fee2e2] border-[#dc2626] text-[#dc2626]'
                  : 'bg-[#f8fafc] border-[#e2e8f0] text-[#64748b] hover:text-[#0f172a]'
              }`}
            >
              {shortageOnly ? 'Showing < 75% Shortage Only' : 'Filter < 75% Shortage'}
            </button>
          </div>
        </div>
      </div>

      {/* Summary Table */}
      <div className="bg-white border border-[#e2e8f0] rounded-[16px] overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-10 bg-[#f1f5f9] rounded-[8px] animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f8fafc] border-b border-[#e2e8f0] text-[11px] font-semibold text-[#64748b] uppercase tracking-wider">
                  <th className="py-3 px-4">Roll No</th>
                  <th className="py-3 px-4">Student Name</th>
                  <th className="py-3 px-4 text-right">Total Days</th>
                  <th className="py-3 px-4 text-right">Present</th>
                  <th className="py-3 px-4 text-right">Absent</th>
                  <th className="py-3 px-4 text-right">Leave</th>
                  <th className="py-3 px-4 w-64">Attendance Percentage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e2e8f0] text-xs">
                {filtered.map((r) => {
                  const isGood = r.percentage >= 75;
                  return (
                    <tr key={r.studentId} className="hover:bg-[#f8fafc] transition-colors">
                      <td className="py-3 px-4 font-mono-num font-semibold text-[#0f172a]">
                        {r.rollNo}
                      </td>
                      <td className="py-3 px-4 font-semibold text-[#0f172a]">{r.name}</td>
                      <td className="py-3 px-4 text-right font-mono-num text-[#0f172a]">
                        {r.totalDays}
                      </td>
                      <td className="py-3 px-4 text-right font-mono-num font-semibold text-[#16a34a]">
                        {r.present}
                      </td>
                      <td className="py-3 px-4 text-right font-mono-num font-semibold text-[#dc2626]">
                        {r.absent}
                      </td>
                      <td className="py-3 px-4 text-right font-mono-num font-semibold text-[#b45309]">
                        {r.leave}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-2.5 bg-[#f1f5f9] rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                isGood ? 'bg-[#16a34a]' : 'bg-[#dc2626]'
                              }`}
                              style={{ width: `${Math.min(100, Math.max(4, r.percentage))}%` }}
                            />
                          </div>
                          <span
                            className={`w-12 text-right font-mono-num font-bold ${
                              isGood ? 'text-[#16a34a]' : 'text-[#dc2626]'
                            }`}
                          >
                            {r.percentage}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
