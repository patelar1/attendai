import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Lock,
  BookOpen,
  GitBranch,
  Calendar,
  ArrowRight,
  Settings,
  GraduationCap,
  LogOut,
  Shield,
} from 'lucide-react';
import { StaffUser, UserRole, Course, Branch } from '../types.ts';

interface CourseWithCount extends Course {
  studentCount?: number;
}
interface BranchWithCount extends Branch {
  studentCount?: number;
}

interface CourseBranchSelectProps {
  user: StaffUser;
  activeRole: UserRole;
  activeDepartment: string | null;
  courses: CourseWithCount[];
  branches: BranchWithCount[];
  initialSelection: { courseId: string; branchId: string; year: number } | null;
  onOpenRoleModal: () => void;
  onOpenCourseBranchManager?: () => void;
  onConfirmSelection: (selection: { courseId: string; branchId: string; year: number }) => void;
  onLogout: () => void;
}

export const CourseBranchSelectScreen: React.FC<CourseBranchSelectProps> = ({
  user,
  activeRole,
  activeDepartment,
  courses,
  branches,
  initialSelection,
  onOpenRoleModal,
  onOpenCourseBranchManager,
  onConfirmSelection,
  onLogout,
}) => {
  // Helper: Check if a course is unlocked for this user
  const isCourseUnlocked = (courseId: string): boolean => {
    if (activeRole === 'admin') return true;
    if (activeRole === 'hod') {
      // Unlocked if course has a branch in user's departments or is in assignedCourses
      return (
        user.assignedCourses.includes(courseId) ||
        branches.some((b) => b.courseId === courseId && user.departments.includes(b.code))
      );
    }
    return user.assignments.some((a) => a.courseId === courseId);
  };

  // Helper: Check if a branch is unlocked for this user
  const isBranchUnlocked = (branch: BranchWithCount): boolean => {
    if (activeRole === 'admin') return true;
    if (activeRole === 'hod') {
      return user.departments.includes(branch.code);
    }
    return user.assignments.some(
      (a) => a.courseId === branch.courseId && a.branchId === branch.id
    );
  };

  // Helper: Check if a year is unlocked for this user
  const isYearUnlocked = (courseId: string, branchId: string, year: number): boolean => {
    if (activeRole === 'admin' || activeRole === 'hod') {
      const br = branches.find((b) => b.id === branchId);
      return br ? isBranchUnlocked(br) : false;
    }
    return user.assignments.some(
      (a) => a.courseId === courseId && a.branchId === branchId && a.year === year
    );
  };

  const [selectedCourseId, setSelectedCourseId] = useState<string>(
    initialSelection?.courseId || ''
  );
  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    initialSelection?.branchId || ''
  );
  const [selectedYear, setSelectedYear] = useState<number | null>(
    initialSelection?.year || null
  );

  // Auto-select first unlocked course if none chosen
  useEffect(() => {
    if (!selectedCourseId && courses.length > 0) {
      // Prefer course containing activeDepartment
      const deptBranch = branches.find((b) => b.code === activeDepartment && isBranchUnlocked(b));
      if (deptBranch && isCourseUnlocked(deptBranch.courseId)) {
        setSelectedCourseId(deptBranch.courseId);
        setSelectedBranchId(deptBranch.id);
        const unlockedYrs = [1, 2, 3, 4].filter((y) =>
          isYearUnlocked(deptBranch.courseId, deptBranch.id, y)
        );
        if (unlockedYrs.length > 0) {
          setSelectedYear(unlockedYrs.includes(2) ? 2 : unlockedYrs[0]);
        }
      } else {
        const firstUnlockedCourse = courses.find((c) => isCourseUnlocked(c.id));
        if (firstUnlockedCourse) {
          setSelectedCourseId(firstUnlockedCourse.id);
        }
      }
    }
  }, [courses, branches, activeDepartment]);

  const selectedCourse = courses.find((c) => c.id === selectedCourseId);
  const courseBranches = branches.filter((b) => b.courseId === selectedCourseId);
  const selectedBranch = branches.find((b) => b.id === selectedBranchId);
  const maxYears = selectedCourse?.durationYears || 4;

  const canProceed =
    Boolean(selectedCourseId) &&
    Boolean(selectedBranchId) &&
    selectedYear !== null &&
    isYearUnlocked(selectedCourseId, selectedBranchId, selectedYear);

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-[#e2e8f0] px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[10px] bg-[#2563eb] text-white flex items-center justify-center">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <span className="text-base font-bold text-[#0f172a]">ATTEND AI</span>
              <span className="hidden sm:inline-block mx-2 text-[#cbd5e1]">·</span>
              <span className="hidden sm:inline-block text-xs text-[#64748b]">
                {activeRole === 'hod' ? 'HOD Portal' : 'Teacher Portal'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onOpenRoleModal}
              className="px-3 py-1.5 rounded-[10px] bg-[#eff6ff] text-[#2563eb] text-xs font-semibold hover:bg-[#dbeafe] transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>
                {activeRole.toUpperCase()} · {activeDepartment || user.departments[0]}
              </span>
            </button>

            <div className="text-right hidden sm:block">
              <div className="text-xs font-semibold text-[#0f172a]">{user.name}</div>
              <div className="text-[11px] font-mono-num text-[#64748b]">{user.userId}</div>
            </div>

            <button
              type="button"
              onClick={onLogout}
              className="px-3 py-1.5 rounded-[10px] border border-[#e2e8f0] text-xs font-medium text-[#64748b] hover:text-[#dc2626] hover:border-[#dc2626]/30 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </header>

      {/* 4-Step Progress Stepper */}
      <div className="bg-white border-b border-[#e2e8f0] px-6 py-3.5">
        <div className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="flex items-center gap-2.5 text-xs font-semibold text-[#16a34a]">
            <span className="w-6 h-6 rounded-full bg-[#dcfce7] text-[#16a34a] flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </span>
            <span>1. Sign In</span>
          </div>

          <button
            type="button"
            onClick={onOpenRoleModal}
            className="flex items-center gap-2.5 text-xs font-semibold text-[#16a34a] hover:underline text-left cursor-pointer"
          >
            <span className="w-6 h-6 rounded-full bg-[#dcfce7] text-[#16a34a] flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </span>
            <span>2. Role & Dept ({activeDepartment})</span>
          </button>

          <div className="flex items-center gap-2.5 text-xs font-bold text-[#2563eb]">
            <span className="w-6 h-6 rounded-full bg-[#2563eb] text-white flex items-center justify-center font-mono-num">
              3
            </span>
            <span>3. Course & Branch</span>
          </div>

          <div
            className={`flex items-center gap-2.5 text-xs font-medium ${
              canProceed ? 'text-[#0f172a]' : 'text-[#64748b]'
            }`}
          >
            <span className="w-6 h-6 rounded-full bg-[#f1f5f9] border border-[#e2e8f0] text-[#64748b] flex items-center justify-center font-mono-num">
              4
            </span>
            <span>4. Student Data</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8 space-y-7">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#0f172a]">Select Course, Branch & Year</h1>
            <p className="text-xs text-[#64748b] mt-1">
              Courses, branches, and academic years not assigned to your account are shown locked. Student data opens once all three are selected.
            </p>
          </div>

          {activeRole === 'hod' && onOpenCourseBranchManager && (
            <button
              type="button"
              onClick={onOpenCourseBranchManager}
              className="px-4 py-2.5 rounded-[10px] bg-white border border-[#e2e8f0] hover:border-[#2563eb] text-xs font-semibold text-[#0f172a] flex items-center gap-2 shadow-xs transition-colors cursor-pointer self-start"
            >
              <Settings className="w-4 h-4 text-[#2563eb]" />
              <span>HOD Course & Branch Management</span>
            </button>
          )}
        </div>

        {/* Step A: Select Course */}
        <section className="bg-white border border-[#e2e8f0] rounded-[16px] p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#2563eb]" />
              <h2 className="text-sm font-bold text-[#0f172a]">Step 1: Select Course</h2>
            </div>
            <span className="text-xs text-[#64748b]">
              {courses.filter((c) => isCourseUnlocked(c.id)).length} of {courses.length} unlocked
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
            {courses.map((course) => {
              const unlocked = isCourseUnlocked(course.id);
              const isSelected = selectedCourseId === course.id;
              return (
                <button
                  key={course.id}
                  type="button"
                  disabled={!unlocked}
                  onClick={() => {
                    setSelectedCourseId(course.id);
                    const cBranches = branches.filter((b) => b.courseId === course.id);
                    const firstUnlockedBr = cBranches.find((b) => isBranchUnlocked(b));
                    if (firstUnlockedBr) {
                      setSelectedBranchId(firstUnlockedBr.id);
                      const validYr = [1, 2, 3, 4].find((y) =>
                        isYearUnlocked(course.id, firstUnlockedBr.id, y)
                      );
                      setSelectedYear(validYr || null);
                    } else {
                      setSelectedBranchId('');
                      setSelectedYear(null);
                    }
                  }}
                  className={`p-4 rounded-[14px] border text-left transition-all flex flex-col justify-between ${
                    !unlocked
                      ? 'bg-[#f1f5f9] border-[#e2e8f0] text-[#64748b] opacity-65 cursor-not-allowed'
                      : isSelected
                      ? 'bg-[#eff6ff] border-[#2563eb] ring-2 ring-[#2563eb]/15 cursor-pointer'
                      : 'bg-white border-[#e2e8f0] hover:border-[#2563eb]/50 cursor-pointer'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-2">
                    <span
                      className={`text-base font-bold ${
                        !unlocked
                          ? 'text-[#64748b]'
                          : isSelected
                          ? 'text-[#2563eb]'
                          : 'text-[#0f172a]'
                      }`}
                    >
                      {course.code}
                    </span>
                    {!unlocked ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#e2e8f0] text-[#64748b]">
                        <Lock className="w-3 h-3" /> Locked
                      </span>
                    ) : isSelected ? (
                      <CheckCircle2 className="w-4 h-4 text-[#2563eb]" />
                    ) : null}
                  </div>
                  <div className="text-xs text-[#64748b] line-clamp-1">{course.name}</div>
                  <div className="mt-3 pt-2 border-t border-[#e2e8f0]/70 flex items-center justify-between text-[11px] text-[#64748b] font-mono-num">
                    <span>{course.durationYears} Years</span>
                    <span>{course.studentCount || 0} Students</span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Step B: Select Branch */}
        <section className="bg-white border border-[#e2e8f0] rounded-[16px] p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-[#2563eb]" />
              <h2 className="text-sm font-bold text-[#0f172a]">
                Step 2: Select Branch {selectedCourse ? `(${selectedCourse.code})` : ''}
              </h2>
            </div>
            <span className="text-xs text-[#64748b]">
              Only assigned department branches are unlocked
            </span>
          </div>

          {courseBranches.length === 0 ? (
            <div className="p-6 text-center text-xs text-[#64748b] bg-[#f8fafc] rounded-[12px] border border-dashed border-[#e2e8f0]">
              Select a course above to view its branches.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
              {courseBranches.map((branch) => {
                const unlocked = isBranchUnlocked(branch);
                const isSelected = selectedBranchId === branch.id;
                return (
                  <button
                    key={branch.id}
                    type="button"
                    disabled={!unlocked}
                    onClick={() => {
                      setSelectedBranchId(branch.id);
                      const validYr = [1, 2, 3, 4].find((y) =>
                        isYearUnlocked(selectedCourseId, branch.id, y)
                      );
                      if (
                        selectedYear === null ||
                        !isYearUnlocked(selectedCourseId, branch.id, selectedYear)
                      ) {
                        setSelectedYear(validYr || null);
                      }
                    }}
                    className={`p-4 rounded-[14px] border text-left transition-all flex flex-col justify-between ${
                      !unlocked
                        ? 'bg-[#f1f5f9] border-[#e2e8f0] text-[#64748b] opacity-65 cursor-not-allowed'
                        : isSelected
                        ? 'bg-[#eff6ff] border-[#2563eb] ring-2 ring-[#2563eb]/15 cursor-pointer'
                        : 'bg-white border-[#e2e8f0] hover:border-[#2563eb]/50 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1.5">
                      <span
                        className={`text-sm font-bold ${
                          !unlocked
                            ? 'text-[#64748b]'
                            : isSelected
                            ? 'text-[#2563eb]'
                            : 'text-[#0f172a]'
                        }`}
                      >
                        {branch.code}
                      </span>
                      {!unlocked ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#e2e8f0] text-[#64748b]">
                          <Lock className="w-3 h-3" /> Locked
                        </span>
                      ) : isSelected ? (
                        <CheckCircle2 className="w-4 h-4 text-[#2563eb]" />
                      ) : null}
                    </div>
                    <div className="text-xs text-[#64748b] line-clamp-2">{branch.name}</div>
                    <div className="mt-3 pt-2 border-t border-[#e2e8f0]/70 text-[11px] font-mono-num text-[#64748b]">
                      {branch.studentCount || 0} Active Students
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Step C: Select Academic Year */}
        <section className="bg-white border border-[#e2e8f0] rounded-[16px] p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#2563eb]" />
              <h2 className="text-sm font-bold text-[#0f172a]">
                Step 3: Select Academic Year
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            {Array.from({ length: maxYears }, (_, idx) => idx + 1).map((yr) => {
              const unlocked =
                Boolean(selectedCourseId) &&
                Boolean(selectedBranchId) &&
                isYearUnlocked(selectedCourseId, selectedBranchId, yr);
              const isSelected = selectedYear === yr && unlocked;
              const suffix = yr === 1 ? 'st' : yr === 2 ? 'nd' : yr === 3 ? 'rd' : 'th';
              return (
                <button
                  key={yr}
                  type="button"
                  disabled={!unlocked}
                  onClick={() => setSelectedYear(yr)}
                  className={`p-4 rounded-[14px] border text-left transition-all flex items-center justify-between ${
                    !unlocked
                      ? 'bg-[#f1f5f9] border-[#e2e8f0] text-[#64748b] opacity-65 cursor-not-allowed'
                      : isSelected
                      ? 'bg-[#eff6ff] border-[#2563eb] ring-2 ring-[#2563eb]/15 cursor-pointer'
                      : 'bg-white border-[#e2e8f0] hover:border-[#2563eb]/50 cursor-pointer'
                  }`}
                >
                  <div>
                    <div
                      className={`text-sm font-bold ${
                        !unlocked
                          ? 'text-[#64748b]'
                          : isSelected
                          ? 'text-[#2563eb]'
                          : 'text-[#0f172a]'
                      }`}
                    >
                      {yr}
                      {suffix} Year
                    </div>
                    <div className="text-[11px] text-[#64748b]">
                      Semester {yr * 2 - 1} / {yr * 2}
                    </div>
                  </div>
                  {!unlocked ? (
                    <Lock className="w-4 h-4 text-[#64748b]" />
                  ) : isSelected ? (
                    <CheckCircle2 className="w-5 h-5 text-[#2563eb]" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </section>

        {/* Footer CTA Bar */}
        <div className="bg-white border border-[#e2e8f0] rounded-[16px] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
          <div>
            <div className="text-xs text-[#64748b]">Current Class Selection</div>
            {canProceed && selectedCourse && selectedBranch ? (
              <div className="text-sm font-bold text-[#0f172a] mt-0.5">
                {selectedCourse.code} · {selectedBranch.code} ({selectedBranch.name}) · Year {selectedYear}
              </div>
            ) : (
              <div className="text-sm font-medium text-[#64748b] mt-0.5 flex items-center gap-1.5">
                <Lock className="w-4 h-4" />
                Select an unlocked Course, Branch, and Year to open Student Data
              </div>
            )}
          </div>

          <button
            type="button"
            disabled={!canProceed}
            onClick={() => {
              if (canProceed && selectedYear !== null) {
                onConfirmSelection({
                  courseId: selectedCourseId,
                  branchId: selectedBranchId,
                  year: selectedYear,
                });
              }
            }}
            className="px-6 py-3 rounded-[10px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:bg-[#cbd5e1] disabled:text-[#64748b] disabled:cursor-not-allowed"
          >
            <span>Open Student Data & Attendance Workspace</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </main>
    </div>
  );
};
