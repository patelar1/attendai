import React, { useState } from 'react';
import {
  ShieldCheck,
  GraduationCap,
  Lock,
  UserCheck,
  BookOpen,
  AlertCircle,
  CheckCircle2,
  KeyRound,
  ArrowRight,
  Building2,
  Eye,
  EyeOff,
} from 'lucide-react';
import { StaffUser, UserRole } from '../types.ts';
import { apiRequest } from '../api.ts';
import { signInWithGooglePopup } from '../firebase.ts';

interface LoginScreenProps {
  onLoginSuccess: (payload: {
    token: string;
    user: StaffUser;
    activeRole: UserRole;
    activeDepartment: string | null;
  }) => void;
}

const ALL_DEPARTMENTS = ['CSE', 'CSD', 'IT', 'EC', 'ME', 'BCA-DS', 'MCA-SE', 'MBA-FIN', 'BCOM-H'];

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [portalMode, setPortalMode] = useState<'staff' | 'admin'>('staff');
  const [identifier, setIdentifier] = useState('HOD-CSE-01');
  const [password, setPassword] = useState('Hod@123');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (portalMode === 'admin') {
        const res = await apiRequest<{
          token: string;
          user: StaffUser;
          activeRole: UserRole;
          activeDepartment: string | null;
        }>('/api/auth/admin-login', {
          method: 'POST',
          body: JSON.stringify({ adminId: identifier, password }),
        });
        onLoginSuccess(res);
      } else {
        const res = await apiRequest<{
          token: string;
          user: StaffUser;
          activeRole: UserRole;
          activeDepartment: string | null;
        }>('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ identifier, password }),
        });
        onLoginSuccess(res);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      const googleUser = await signInWithGooglePopup();
      const res = await apiRequest<{
        token: string;
        user: StaffUser;
        activeRole: UserRole;
        activeDepartment: string | null;
      }>('/api/auth/google-login', {
        method: 'POST',
        body: JSON.stringify({ email: googleUser.email }),
      });
      onLoginSuccess(res);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google sign-in failed';
      if (msg.includes('popup-closed-by-user')) {
        setError('Google sign-in popup was closed before completing authentication.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSimulatedUnregisteredGoogle = async () => {
    setError(null);
    setLoading(true);
    try {
      await apiRequest('/api/auth/google-login', {
        method: 'POST',
        body: JSON.stringify({ email: 'unregistered.faculty@gmail.com' }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Account not found, contact administrator');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (mode: 'staff' | 'admin', id: string, pass: string) => {
    setPortalMode(mode);
    setIdentifier(id);
    setPassword(pass);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col justify-between py-8 px-4 sm:px-6 lg:px-8">
      {/* Top Bar */}
      <div className="max-w-6xl w-full mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-[12px] bg-[#2563eb] flex items-center justify-center text-white shadow-sm">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <span className="text-lg font-bold tracking-tight text-[#0f172a]">ATTEND AI</span>
            <p className="text-xs text-[#64748b]">College Attendance & Automated AI Follow-up Portal</p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-white border border-[#e2e8f0] p-1 rounded-[10px] shadow-xs">
          <button
            type="button"
            onClick={() => {
              setPortalMode('staff');
              setIdentifier('HOD-CSE-01');
              setPassword('Hod@123');
              setError(null);
            }}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-[8px] transition-colors whitespace-nowrap shrink-0 ${
              portalMode === 'staff'
                ? 'bg-[#2563eb] text-white shadow-xs'
                : 'text-[#64748b] hover:text-[#0f172a]'
            }`}
          >
            HOD / Teacher Login
          </button>
          <button
            type="button"
            onClick={() => {
              setPortalMode('admin');
              setIdentifier('ADM-001');
              setPassword('Admin@123');
              setError(null);
            }}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-[8px] transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              portalMode === 'admin'
                ? 'bg-[#0f172a] text-white shadow-xs'
                : 'text-[#64748b] hover:text-[#0f172a]'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Admin Login
          </button>
        </div>
      </div>

      {/* Main Centered Login Card */}
      <div className="max-w-md w-full mx-auto my-8">
        <div className="bg-white border border-[#e2e8f0] rounded-[16px] shadow-sm p-7 sm:p-8">
          <div className="flex items-center gap-3 mb-5">
            <div
              className={`w-11 h-11 rounded-[12px] flex items-center justify-center ${
                portalMode === 'admin'
                  ? 'bg-[#0f172a] text-white'
                  : 'bg-[#eff6ff] text-[#2563eb]'
              }`}
            >
              {portalMode === 'admin' ? (
                <ShieldCheck className="w-6 h-6" />
              ) : (
                <UserCheck className="w-6 h-6" />
              )}
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#0f172a]">
                {portalMode === 'admin' ? 'System Admin Portal' : 'Welcome to ATTEND AI'}
              </h1>
              <p className="text-xs text-[#64748b]">
                {portalMode === 'admin'
                  ? 'Sign in with your unique Admin ID and password'
                  : 'Sign in with your College User ID, Email, or Google'}
              </p>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-5 p-3.5 rounded-[10px] bg-[#fee2e2] border border-[#dc2626]/20 text-[#dc2626] text-xs font-medium flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#0f172a] mb-1.5">
                {portalMode === 'admin' ? 'Unique Admin ID' : 'User ID or College Email'}
              </label>
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={
                  portalMode === 'admin' ? 'e.g., ADM-001' : 'e.g., HOD-CSE-01 or ananya.t@attendai.edu.in'
                }
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#e2e8f0] rounded-[10px] text-[#0f172a] placeholder-[#64748b] focus:outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/15"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#0f172a] mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full px-3.5 py-2.5 pr-10 text-sm bg-white border border-[#e2e8f0] rounded-[10px] text-[#0f172a] placeholder-[#64748b] focus:outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/15"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748b] hover:text-[#0f172a]"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-2.5 px-4 rounded-[10px] text-sm font-semibold text-white transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer ${
                portalMode === 'admin'
                  ? 'bg-[#0f172a] hover:bg-[#1e293b]'
                  : 'bg-[#2563eb] hover:bg-[#1d4ed8]'
              } disabled:opacity-60`}
            >
              <span>{loading ? 'Signing in...' : portalMode === 'admin' ? 'Sign In as Admin' : 'Sign In'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {portalMode === 'staff' && (
            <>
              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#e2e8f0]" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white px-3 text-[#64748b]">OR CONTINUE WITH</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full py-2.5 px-4 bg-white hover:bg-[#f8fafc] border border-[#e2e8f0] rounded-[10px] text-sm font-medium text-[#0f172a] transition-colors flex items-center justify-center gap-2.5 cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span>Sign in with Google</span>
              </button>

              <div className="mt-2.5 text-center">
                <button
                  type="button"
                  onClick={handleSimulatedUnregisteredGoogle}
                  className="text-[11px] text-[#64748b] hover:text-[#2563eb] underline cursor-pointer"
                >
                  Test unregistered Google email error ("Account not found...")
                </button>
              </div>
            </>
          )}

          <div className="mt-6 pt-4 border-t border-[#e2e8f0] flex items-center justify-between text-xs text-[#64748b]">
            <span className="flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-[#64748b]" />
              No public sign-up
            </span>
            <span>Accounts provisioned by Admin only</span>
          </div>
        </div>
      </div>

      {/* Quick Demo Seed Accounts Bar */}
      <div className="max-w-4xl w-full mx-auto bg-white border border-[#e2e8f0] rounded-[14px] p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <span className="text-xs font-semibold text-[#0f172a]">
            Quick Demo Accounts (Click to auto-fill credentials):
          </span>
          <span className="text-[11px] text-[#64748b]">
            1 Admin · 2 HODs · 3 Teachers · 64 Students Seeded
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
          <button
            type="button"
            onClick={() => fillDemo('staff', 'HOD-CSE-01', 'Hod@123')}
            className={`p-2 rounded-[10px] border text-left transition-colors cursor-pointer ${
              identifier === 'HOD-CSE-01'
                ? 'bg-[#eff6ff] border-[#2563eb] text-[#0f172a]'
                : 'border-[#e2e8f0] hover:bg-[#f8fafc]'
            }`}
          >
            <div className="text-xs font-semibold text-[#2563eb]">HOD (CSE/CSD/IT)</div>
            <div className="text-[11px] font-mono-num text-[#64748b]">HOD-CSE-01</div>
          </button>

          <button
            type="button"
            onClick={() => fillDemo('staff', 'HOD-CORE-02', 'Hod@123')}
            className={`p-2 rounded-[10px] border text-left transition-colors cursor-pointer ${
              identifier === 'HOD-CORE-02'
                ? 'bg-[#eff6ff] border-[#2563eb] text-[#0f172a]'
                : 'border-[#e2e8f0] hover:bg-[#f8fafc]'
            }`}
          >
            <div className="text-xs font-semibold text-[#2563eb]">HOD (EC/ME/MBA)</div>
            <div className="text-[11px] font-mono-num text-[#64748b]">HOD-CORE-02</div>
          </button>

          <button
            type="button"
            onClick={() => fillDemo('staff', 'TCH-CSE-01', 'Teacher@123')}
            className={`p-2 rounded-[10px] border text-left transition-colors cursor-pointer ${
              identifier === 'TCH-CSE-01'
                ? 'bg-[#eff6ff] border-[#2563eb] text-[#0f172a]'
                : 'border-[#e2e8f0] hover:bg-[#f8fafc]'
            }`}
          >
            <div className="text-xs font-semibold text-[#16a34a]">Teacher (CSE/CSD)</div>
            <div className="text-[11px] font-mono-num text-[#64748b]">TCH-CSE-01</div>
          </button>

          <button
            type="button"
            onClick={() => fillDemo('staff', 'TCH-IT-02', 'Teacher@123')}
            className={`p-2 rounded-[10px] border text-left transition-colors cursor-pointer ${
              identifier === 'TCH-IT-02'
                ? 'bg-[#eff6ff] border-[#2563eb] text-[#0f172a]'
                : 'border-[#e2e8f0] hover:bg-[#f8fafc]'
            }`}
          >
            <div className="text-xs font-semibold text-[#16a34a]">Teacher (IT/BCA)</div>
            <div className="text-[11px] font-mono-num text-[#64748b]">TCH-IT-02</div>
          </button>

          <button
            type="button"
            onClick={() => fillDemo('staff', 'TCH-EC-03', 'Teacher@123')}
            className={`p-2 rounded-[10px] border text-left transition-colors cursor-pointer ${
              identifier === 'TCH-EC-03'
                ? 'bg-[#eff6ff] border-[#2563eb] text-[#0f172a]'
                : 'border-[#e2e8f0] hover:bg-[#f8fafc]'
            }`}
          >
            <div className="text-xs font-semibold text-[#16a34a]">Teacher (EC/ME)</div>
            <div className="text-[11px] font-mono-num text-[#64748b]">TCH-EC-03</div>
          </button>

          <button
            type="button"
            onClick={() => fillDemo('admin', 'ADM-001', 'Admin@123')}
            className={`p-2 rounded-[10px] border text-left transition-colors cursor-pointer ${
              identifier === 'ADM-001'
                ? 'bg-[#eff6ff] border-[#2563eb] text-[#0f172a]'
                : 'border-[#e2e8f0] hover:bg-[#f8fafc]'
            }`}
          >
            <div className="text-xs font-semibold text-[#0f172a]">System Admin</div>
            <div className="text-[11px] font-mono-num text-[#64748b]">ADM-001</div>
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Force Password Change Modal (First Login)
// ============================================================================
interface ForcePasswordModalProps {
  user: StaffUser;
  onSuccess: (updatedUser: StaffUser) => void;
}

export const ForcePasswordChangeModal: React.FC<ForcePasswordModalProps> = ({
  user,
  onSuccess,
}) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const res = await apiRequest<{ user: StaffUser }>('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ newPassword }),
      });
      onSuccess(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0f172a]/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-[#e2e8f0] rounded-[22px] max-w-md w-full p-7 shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-[12px] bg-[#fef3c7] text-[#b45309] flex items-center justify-center">
            <KeyRound className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#0f172a]">Change Temporary Password</h2>
            <p className="text-xs text-[#64748b]">
              First login detected for <span className="font-semibold text-[#0f172a]">{user.userId}</span>
            </p>
          </div>
        </div>

        <p className="text-xs text-[#64748b] mb-4">
          For security compliance, you must replace the temporary password assigned by the Administrator before accessing student records.
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-[10px] bg-[#fee2e2] text-[#dc2626] text-xs font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#0f172a] mb-1">
              New Password
            </label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimum 6 characters"
              className="w-full px-3.5 py-2.5 text-sm border border-[#e2e8f0] rounded-[10px] focus:outline-none focus:border-[#2563eb]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#0f172a] mb-1">
              Confirm New Password
            </label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter new password"
              className="w-full px-3.5 py-2.5 text-sm border border-[#e2e8f0] rounded-[10px] focus:outline-none focus:border-[#2563eb]"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-sm font-semibold rounded-[10px] transition-colors cursor-pointer"
          >
            {loading ? 'Updating Password...' : 'Save New Password & Continue'}
          </button>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// Role & Department Popup Modal (22px rounded modal)
// ============================================================================
interface RoleDeptModalProps {
  user: StaffUser;
  initialRole: UserRole;
  initialDept: string | null;
  onConfirm: (role: UserRole, department: string) => Promise<void>;
  onCancel?: () => void;
}

export const RoleDepartmentModal: React.FC<RoleDeptModalProps> = ({
  user,
  initialRole,
  initialDept,
  onConfirm,
  onCancel,
}) => {
  const [selectedRole, setSelectedRole] = useState<UserRole>(
    user.allowedRoles.includes(initialRole) ? initialRole : user.allowedRoles[0]
  );
  const [selectedDept, setSelectedDept] = useState<string>(
    initialDept && user.departments.includes(initialDept)
      ? initialDept
      : user.departments[0] || 'CSE'
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSelectHod = user.allowedRoles.includes('hod');
  const canSelectTeacher = user.allowedRoles.includes('teacher');

  const handleContinue = async () => {
    setError(null);
    setLoading(true);
    try {
      await onConfirm(selectedRole, selectedDept);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Validation failed on server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0f172a]/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-[#e2e8f0] rounded-[22px] max-w-lg w-full p-7 shadow-xl">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-[10px] bg-[#eff6ff] text-[#2563eb] flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#0f172a]">Select Role & Department</h2>
              <p className="text-xs text-[#64748b]">
                Verified account: <span className="font-semibold text-[#0f172a]">{user.name}</span> ({user.userId})
              </p>
            </div>
          </div>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="text-xs text-[#64748b] hover:text-[#0f172a] px-2 py-1"
            >
              Close
            </button>
          )}
        </div>

        <p className="text-xs text-[#64748b] mb-5">
          Only roles and departments assigned to your account by the Administrator are unlocked below.
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-[10px] bg-[#fee2e2] text-[#dc2626] text-xs font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Role Cards (HOD vs Teacher) */}
        <div className="mb-5">
          <label className="block text-xs font-semibold text-[#0f172a] mb-2">
            1. Choose Your Active Role
          </label>
          <div className="grid grid-cols-2 gap-3">
            {/* HOD Card */}
            <button
              type="button"
              disabled={!canSelectHod}
              onClick={() => canSelectHod && setSelectedRole('hod')}
              className={`p-4 rounded-[14px] border text-left transition-all relative ${
                !canSelectHod
                  ? 'bg-[#f1f5f9] border-[#e2e8f0] text-[#64748b] opacity-70 cursor-not-allowed'
                  : selectedRole === 'hod'
                  ? 'bg-[#eff6ff] border-[#2563eb] ring-2 ring-[#2563eb]/15 cursor-pointer'
                  : 'bg-white border-[#e2e8f0] hover:border-[#2563eb]/50 cursor-pointer'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div
                  className={`w-9 h-9 rounded-[10px] flex items-center justify-center ${
                    !canSelectHod
                      ? 'bg-[#e2e8f0] text-[#64748b]'
                      : selectedRole === 'hod'
                      ? 'bg-[#2563eb] text-white'
                      : 'bg-[#eff6ff] text-[#2563eb]'
                  }`}
                >
                  <GraduationCap className="w-5 h-5" />
                </div>
                {!canSelectHod ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#e2e8f0] text-[#64748b]">
                    <Lock className="w-3 h-3" /> Locked
                  </span>
                ) : selectedRole === 'hod' ? (
                  <CheckCircle2 className="w-5 h-5 text-[#2563eb]" />
                ) : null}
              </div>
              <div className="text-sm font-bold text-[#0f172a]">HOD</div>
              <div className="text-[11px] text-[#64748b] mt-0.5">
                Manage courses, branches, student records & AI call reports
              </div>
            </button>

            {/* Teacher Card */}
            <button
              type="button"
              disabled={!canSelectTeacher}
              onClick={() => canSelectTeacher && setSelectedRole('teacher')}
              className={`p-4 rounded-[14px] border text-left transition-all relative ${
                !canSelectTeacher
                  ? 'bg-[#f1f5f9] border-[#e2e8f0] text-[#64748b] opacity-70 cursor-not-allowed'
                  : selectedRole === 'teacher'
                  ? 'bg-[#eff6ff] border-[#2563eb] ring-2 ring-[#2563eb]/15 cursor-pointer'
                  : 'bg-white border-[#e2e8f0] hover:border-[#2563eb]/50 cursor-pointer'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div
                  className={`w-9 h-9 rounded-[10px] flex items-center justify-center ${
                    !canSelectTeacher
                      ? 'bg-[#e2e8f0] text-[#64748b]'
                      : selectedRole === 'teacher'
                      ? 'bg-[#2563eb] text-white'
                      : 'bg-[#eff6ff] text-[#2563eb]'
                  }`}
                >
                  <BookOpen className="w-5 h-5" />
                </div>
                {!canSelectTeacher ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#e2e8f0] text-[#64748b]">
                    <Lock className="w-3 h-3" /> Locked
                  </span>
                ) : selectedRole === 'teacher' ? (
                  <CheckCircle2 className="w-5 h-5 text-[#2563eb]" />
                ) : null}
              </div>
              <div className="text-sm font-bold text-[#0f172a]">Teacher</div>
              <div className="text-[11px] text-[#64748b] mt-0.5">
                View directory, take daily attendance & track absent AI calls
              </div>
            </button>
          </div>
        </div>

        {/* Department Chips */}
        <div className="mb-6">
          <label className="block text-xs font-semibold text-[#0f172a] mb-2">
            2. Select Assigned Department
          </label>
          <div className="flex flex-wrap gap-2">
            {ALL_DEPARTMENTS.map((dept) => {
              const isAssigned = user.departments.includes(dept);
              const isSelected = selectedDept === dept;
              return (
                <button
                  key={dept}
                  type="button"
                  disabled={!isAssigned}
                  onClick={() => isAssigned && setSelectedDept(dept)}
                  className={`px-3.5 py-2 rounded-[10px] text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                    !isAssigned
                      ? 'bg-[#f1f5f9] border-[#e2e8f0] text-[#64748b] opacity-65 cursor-not-allowed'
                      : isSelected
                      ? 'bg-[#2563eb] border-[#2563eb] text-white shadow-xs cursor-pointer'
                      : 'bg-white border-[#e2e8f0] text-[#0f172a] hover:border-[#2563eb] cursor-pointer'
                  }`}
                >
                  {!isAssigned && <Lock className="w-3 h-3 text-[#64748b]" />}
                  <span>{dept}</span>
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          disabled={loading || !selectedDept}
          onClick={handleContinue}
          className="w-full py-3 px-4 bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-sm font-semibold rounded-[10px] transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-60"
        >
          <span>{loading ? 'Verifying on Server...' : 'Continue to Select Course & Branch'}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
