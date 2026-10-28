/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  GraduationCap,
  Users,
  CalendarCheck,
  BarChart3,
  PhoneCall,
  Settings,
  LogOut,
  Shield,
  ArrowLeftRight,
  CheckCircle2,
} from 'lucide-react';
import { StaffUser, UserRole, Course, Branch } from './types.ts';
import { apiRequest, getStoredToken, setStoredToken } from './api.ts';
import { signOutFirebase } from './firebase.ts';
import {
  LoginScreen,
  ForcePasswordChangeModal,
  RoleDepartmentModal,
} from './components/LoginModals.tsx';
import { CourseBranchSelectScreen } from './components/CourseBranchSelect.tsx';
import {
  StudentDirectoryView,
  HodCourseBranchManager,
} from './components/StudentDirectoryAndHodMgmt.tsx';
import { TakeAttendanceView, AttendanceDataView } from './components/AttendanceViews.tsx';
import { AbsentAiCallsView } from './components/AbsentAiCallsView.tsx';
import { AdminConsole } from './components/AdminConsole.tsx';

interface CourseWithCount extends Course {
  studentCount?: number;
}
interface BranchWithCount extends Branch {
  studentCount?: number;
}

type WorkspaceTab =
  | 'students'
  | 'take_attendance'
  | 'attendance_data'
  | 'ai_calls'
  | 'course_branch_mgmt';

export default function App() {
  const [user, setUser] = useState<StaffUser | null>(null);
  const [activeRole, setActiveRole] = useState<UserRole>('hod');
  const [activeDepartment, setActiveDepartment] = useState<string | null>(null);
  const [bootstrapping, setBootstrapping] = useState<boolean>(true);

  // Flow Modals & Step State
  const [showRoleModal, setShowRoleModal] = useState<boolean>(false);
  const [selectedClass, setSelectedClass] = useState<{
    courseId: string;
    branchId: string;
    year: number;
  } | null>(null);
  const [standaloneCourseMgmt, setStandaloneCourseMgmt] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('students');

  // Catalog Data
  const [courses, setCourses] = useState<CourseWithCount[]>([]);
  const [branches, setBranches] = useState<BranchWithCount[]>([]);

  const loadCatalog = useCallback(async () => {
    try {
      const res = await apiRequest<{
        courses: CourseWithCount[];
        branches: BranchWithCount[];
      }>('/api/catalog');
      setCourses(res.courses);
      setBranches(res.branches);
    } catch {
      // ignore if unauthenticated
    }
  }, []);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setBootstrapping(false);
      return;
    }
    apiRequest<{
      user: StaffUser;
      activeRole: UserRole;
      activeDepartment: string | null;
    }>('/api/auth/me')
      .then((res) => {
        setUser(res.user);
        setActiveRole(res.activeRole);
        setActiveDepartment(res.activeDepartment);
        return loadCatalog();
      })
      .catch(() => {
        setStoredToken(null);
      })
      .finally(() => {
        setBootstrapping(false);
      });
  }, [loadCatalog]);

  const handleLoginSuccess = async (payload: {
    token: string;
    user: StaffUser;
    activeRole: UserRole;
    activeDepartment: string | null;
  }) => {
    setStoredToken(payload.token);
    setUser(payload.user);
    setActiveRole(payload.activeRole);
    setActiveDepartment(payload.activeDepartment);
    setSelectedClass(null);
    setStandaloneCourseMgmt(false);
    setActiveTab('students');
    await loadCatalog();

    // Show Role & Department popup immediately after HOD/Teacher login
    if (payload.activeRole !== 'admin' && !payload.user.mustChangePassword) {
      setShowRoleModal(true);
    }
  };

  const handleLogout = async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    await signOutFirebase();
    setStoredToken(null);
    setUser(null);
    setSelectedClass(null);
    setShowRoleModal(false);
    setStandaloneCourseMgmt(false);
  };

  const handleRoleDeptConfirmed = async (role: UserRole, dept: string) => {
    const res = await apiRequest<{
      user: StaffUser;
      activeRole: UserRole;
      activeDepartment: string | null;
    }>('/api/auth/select-role-dept', {
      method: 'POST',
      body: JSON.stringify({ role, department: dept }),
    });
    setUser(res.user);
    setActiveRole(res.activeRole);
    setActiveDepartment(res.activeDepartment);
    setSelectedClass(null);
    setShowRoleModal(false);
  };

  if (bootstrapping) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="w-10 h-10 rounded-[12px] bg-[#2563eb] text-white flex items-center justify-center mx-auto animate-pulse">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div className="text-sm font-semibold text-[#0f172a]">Loading ATTEND AI...</div>
        </div>
      </div>
    );
  }

  // 1. Not Logged In -> Login Screen
  if (!user) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  // 2. First Login -> Force Password Change Modal
  if (user.mustChangePassword) {
    return (
      <ForcePasswordChangeModal
        user={user}
        onSuccess={(updatedUser) => {
          setUser(updatedUser);
          if (activeRole !== 'admin') {
            setShowRoleModal(true);
          }
        }}
      />
    );
  }

  // 3. System Admin Role -> Dedicated Admin Console
  if (activeRole === 'admin') {
    return (
      <AdminConsole
        currentUser={user}
        courses={courses}
        branches={branches}
        onLogout={handleLogout}
      />
    );
  }

  // 4. HOD / Teacher: If no Course+Branch+Year selected yet (Step 3)
  const currentCourse = courses.find((c) => c.id === selectedClass?.courseId);
  const currentBranch = branches.find((b) => b.id === selectedClass?.branchId);

  if ((!selectedClass || !currentCourse || !currentBranch) && !standaloneCourseMgmt) {
    return (
      <>
        <CourseBranchSelectScreen
          user={user}
          activeRole={activeRole}
          activeDepartment={activeDepartment}
          courses={courses}
          branches={branches}
          initialSelection={selectedClass}
          onOpenRoleModal={() => setShowRoleModal(true)}
          onOpenCourseBranchManager={
            activeRole === 'hod'
              ? () => {
                  setStandaloneCourseMgmt(true);
                  setActiveTab('course_branch_mgmt');
                }
              : undefined
          }
          onConfirmSelection={(sel) => {
            setSelectedClass(sel);
            setActiveTab('students');
          }}
          onLogout={handleLogout}
        />

        {showRoleModal && (
          <RoleDepartmentModal
            user={user}
            initialRole={activeRole}
            initialDept={activeDepartment}
            onConfirm={handleRoleDeptConfirmed}
            onCancel={() => setShowRoleModal(false)}
          />
        )}
      </>
    );
  }

  // 5. HOD / Teacher Main Workspace (Step 4: Student Data, Attendance, Absent & AI Calls)
  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      {/* Top Bar */}
      <header className="bg-white border-b border-[#e2e8f0] px-6 py-3.5 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Brand + Active Context */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[10px] bg-[#2563eb] text-white flex items-center justify-center shrink-0">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-[#0f172a] whitespace-nowrap">
                  ATTEND AI
                </span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold uppercase bg-[#eff6ff] text-[#2563eb]">
                  {activeRole}
                </span>
              </div>
              <div className="text-[11px] text-[#64748b] hidden sm:block">
                {currentCourse && currentBranch && selectedClass
                  ? `${currentCourse.code} · ${currentBranch.code} (${currentBranch.name}) · Year ${selectedClass.year}`
                  : 'Department Course & Branch Management'}
              </div>
            </div>
          </div>

          {/* Right User & Class Switcher Controls */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                setStandaloneCourseMgmt(false);
                setSelectedClass(null);
              }}
              className="px-3 py-1.5 rounded-[10px] bg-[#f8fafc] hover:bg-[#eff6ff] border border-[#e2e8f0] hover:border-[#2563eb] text-xs font-semibold text-[#0f172a] hover:text-[#2563eb] transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span>Change Course / Branch</span>
            </button>

            <button
              type="button"
              onClick={() => setShowRoleModal(true)}
              className="px-3 py-1.5 rounded-[10px] bg-[#eff6ff] text-[#2563eb] text-xs font-semibold hover:bg-[#dbeafe] transition-colors hidden md:flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>
                {activeRole.toUpperCase()} · {activeDepartment || user.departments[0]}
              </span>
            </button>

            <div className="text-right hidden lg:block px-1">
              <div className="text-xs font-semibold text-[#0f172a]">{user.name}</div>
              <div className="text-[11px] font-mono-num text-[#64748b]">{user.userId}</div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="px-3 py-1.5 rounded-[10px] border border-[#e2e8f0] text-xs font-medium text-[#64748b] hover:text-[#dc2626] hover:border-[#dc2626]/30 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      {/* 4-Step Progress Bar + Workspace Navigation Tabs */}
      <div className="bg-white border-b border-[#e2e8f0] px-6">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-3 py-2.5">
          {/* Primary Workspace Tabs */}
          <nav className="flex items-center gap-1.5 overflow-x-auto">
            {currentCourse && currentBranch && selectedClass && (
              <>
                <button
                  type="button"
                  onClick={() => setActiveTab('students')}
                  className={`px-3.5 py-2 rounded-[10px] text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    activeTab === 'students'
                      ? 'bg-[#2563eb] text-white shadow-xs'
                      : 'text-[#64748b] hover:text-[#0f172a] hover:bg-[#f8fafc]'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>
                    {activeRole === 'hod' ? 'Student Management' : 'Student Directory'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('take_attendance')}
                  className={`px-3.5 py-2 rounded-[10px] text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    activeTab === 'take_attendance'
                      ? 'bg-[#2563eb] text-white shadow-xs'
                      : 'text-[#64748b] hover:text-[#0f172a] hover:bg-[#f8fafc]'
                  }`}
                >
                  <CalendarCheck className="w-4 h-4" />
                  <span>Take Attendance</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('attendance_data')}
                  className={`px-3.5 py-2 rounded-[10px] text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    activeTab === 'attendance_data'
                      ? 'bg-[#2563eb] text-white shadow-xs'
                      : 'text-[#64748b] hover:text-[#0f172a] hover:bg-[#f8fafc]'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  <span>Attendance Data</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('ai_calls')}
                  className={`px-3.5 py-2 rounded-[10px] text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    activeTab === 'ai_calls'
                      ? 'bg-[#2563eb] text-white shadow-xs'
                      : 'text-[#64748b] hover:text-[#0f172a] hover:bg-[#f8fafc]'
                  }`}
                >
                  <PhoneCall className="w-4 h-4" />
                  <span>Absent & AI Calls</span>
                </button>
              </>
            )}

            {activeRole === 'hod' && (
              <button
                type="button"
                onClick={() => setActiveTab('course_branch_mgmt')}
                className={`px-3.5 py-2 rounded-[10px] text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  activeTab === 'course_branch_mgmt'
                    ? 'bg-[#2563eb] text-white shadow-xs'
                    : 'text-[#64748b] hover:text-[#0f172a] hover:bg-[#f8fafc]'
                }`}
              >
                <Settings className="w-4 h-4" />
                <span>Course & Branch Mgmt</span>
              </button>
            )}
          </nav>

          {/* Compact 4-Step Trail */}
          <div className="hidden xl:flex items-center gap-2 text-[11px] font-semibold text-[#16a34a]">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> 1. Sign In
            </span>
            <span className="text-[#cbd5e1]">/</span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> 2. {activeRole.toUpperCase()} ({activeDepartment})
            </span>
            <span className="text-[#cbd5e1]">/</span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> 3.{' '}
              {currentCourse ? `${currentCourse.code} · ${currentBranch?.code}` : 'Catalog'}
            </span>
            <span className="text-[#cbd5e1]">/</span>
            <span className="text-[#2563eb] font-bold">4. Student Data</span>
          </div>
        </div>
      </div>

      {/* Main Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-7">
        {activeTab === 'course_branch_mgmt' && activeRole === 'hod' ? (
          <HodCourseBranchManager
            courses={courses}
            branches={branches}
            onCatalogUpdated={loadCatalog}
          />
        ) : currentCourse && currentBranch && selectedClass ? (
          <>
            {activeTab === 'students' && (
              <StudentDirectoryView
                activeRole={activeRole}
                course={currentCourse}
                branch={currentBranch}
                year={selectedClass.year}
                onStudentsChanged={loadCatalog}
              />
            )}

            {activeTab === 'take_attendance' && (
              <TakeAttendanceView
                activeRole={activeRole}
                course={currentCourse}
                branch={currentBranch}
                year={selectedClass.year}
              />
            )}

            {activeTab === 'attendance_data' && (
              <AttendanceDataView
                course={currentCourse}
                branch={currentBranch}
                year={selectedClass.year}
              />
            )}

            {activeTab === 'ai_calls' && (
              <AbsentAiCallsView
                activeRole={activeRole}
                course={currentCourse}
                branch={currentBranch}
                year={selectedClass.year}
              />
            )}
          </>
        ) : null}
      </main>

      {showRoleModal && (
        <RoleDepartmentModal
          user={user}
          initialRole={activeRole}
          initialDept={activeDepartment}
          onConfirm={handleRoleDeptConfirmed}
          onCancel={() => setShowRoleModal(false)}
        />
      )}
    </div>
  );
}
