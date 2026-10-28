import React, { useState, useEffect } from 'react';
import {
  Plus,
  Upload,
  Search,
  Edit3,
  Trash2,
  Lock,
  CheckCircle2,
  AlertCircle,
  Download,
  BookOpen,
  GitBranch,
  Users,
  X,
  FileSpreadsheet,
} from 'lucide-react';
import { Student, Course, Branch, UserRole } from '../types.ts';
import { apiRequest } from '../api.ts';

interface CourseWithCount extends Course {
  studentCount?: number;
}
interface BranchWithCount extends Branch {
  studentCount?: number;
}

interface StudentDirectoryProps {
  activeRole: UserRole;
  course: CourseWithCount;
  branch: BranchWithCount;
  year: number;
  onStudentsChanged?: () => void;
}

interface CsvPreviewRow {
  rowNum: number;
  rollNo: string;
  name: string;
  mobile: string;
  guardianMobile: string;
  email: string;
  status: 'active' | 'inactive';
  errors: string[];
}

export const StudentDirectoryView: React.FC<StudentDirectoryProps> = ({
  activeRole,
  course,
  branch,
  year,
  onStudentsChanged,
}) => {
  const canEdit = activeRole === 'hod' || activeRole === 'admin';
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Add / Edit Student Modal State
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [formRollNo, setFormRollNo] = useState('');
  const [formName, setFormName] = useState('');
  const [formMobile, setFormMobile] = useState('');
  const [formGuardianMobile, setFormGuardianMobile] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formStatus, setFormStatus] = useState<'active' | 'inactive'>('active');
  const [savingStudent, setSavingStudent] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Soft Delete Confirmation Modal State
  const [deletingStudent, setDeletingStudent] = useState<Student | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  // CSV Bulk Import Modal State
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvRawText, setCsvRawText] = useState('');
  const [csvPreview, setCsvPreview] = useState<CsvPreviewRow[]>([]);
  const [importingCsv, setImportingCsv] = useState(false);
  const [csvSuccessMsg, setCsvSuccessMsg] = useState<string | null>(null);

  const loadStudents = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<{ students: Student[] }>(
        `/api/students?courseId=${encodeURIComponent(course.id)}&branchId=${encodeURIComponent(
          branch.id
        )}&year=${year}`
      );
      setStudents(res.students);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load student directory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudents();
  }, [course.id, branch.id, year]);

  const openAddModal = () => {
    if (!canEdit) return;
    setEditingStudent(null);
    setFormRollNo(`0187${branch.code.slice(0, 2)}${26 - year}10${String(students.length + 1).padStart(2, '0')}`);
    setFormName('');
    setFormMobile('+91 98260 ');
    setFormGuardianMobile('+91 94250 ');
    setFormEmail('');
    setFormStatus('active');
    setModalError(null);
    setShowStudentModal(true);
  };

  const openEditModal = (stu: Student) => {
    if (!canEdit) return;
    setEditingStudent(stu);
    setFormRollNo(stu.rollNo);
    setFormName(stu.name);
    setFormMobile(stu.mobile);
    setFormGuardianMobile(stu.guardianMobile);
    setFormEmail(stu.email);
    setFormStatus(stu.status === 'inactive' ? 'inactive' : 'active');
    setModalError(null);
    setShowStudentModal(true);
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    setSavingStudent(true);
    try {
      if (editingStudent) {
        await apiRequest(`/api/students/${editingStudent.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            rollNo: formRollNo,
            name: formName,
            mobile: formMobile,
            guardianMobile: formGuardianMobile,
            email: formEmail,
            year,
            status: formStatus,
          }),
        });
      } else {
        await apiRequest('/api/students', {
          method: 'POST',
          body: JSON.stringify({
            courseId: course.id,
            branchId: branch.id,
            year,
            rollNo: formRollNo,
            name: formName,
            mobile: formMobile,
            guardianMobile: formGuardianMobile,
            email: formEmail,
            status: formStatus,
          }),
        });
      }
      setShowStudentModal(false);
      await loadStudents();
      onStudentsChanged?.();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Failed to save student');
    } finally {
      setSavingStudent(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingStudent) return;
    setDeletingBusy(true);
    try {
      await apiRequest(`/api/students/${deletingStudent.id}`, {
        method: 'DELETE',
      });
      setDeletingStudent(null);
      await loadStudents();
      onStudentsChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete student');
    } finally {
      setDeletingBusy(false);
    }
  };

  // Parse and validate CSV rows
  const validateCsvContent = (raw: string) => {
    setCsvRawText(raw);
    setCsvSuccessMsg(null);
    const lines = raw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      setCsvPreview([]);
      return;
    }

    const existingRolls = new Set(students.map((s) => s.rollNo.toUpperCase()));
    const seenInCsv = new Set<string>();
    const rows: CsvPreviewRow[] = [];

    lines.forEach((line, idx) => {
      // Skip header line if it contains "roll" and "name"
      if (idx === 0 && line.toLowerCase().includes('roll') && line.toLowerCase().includes('name')) {
        return;
      }
      const cols = line.split(',').map((c) => c.trim());
      const [rollNo = '', name = '', mobile = '', guardianMobile = '', email = '', statusRaw = 'active'] = cols;
      const errs: string[] = [];

      const upperRoll = rollNo.toUpperCase();
      if (!upperRoll) errs.push('Missing Roll No');
      else if (existingRolls.has(upperRoll)) errs.push('Roll No already exists in class');
      else if (seenInCsv.has(upperRoll)) errs.push('Duplicate Roll No in CSV');
      if (upperRoll) seenInCsv.add(upperRoll);

      if (!name || name.length < 2) errs.push('Invalid Name');
      const mobileDigits = mobile.replace(/\D/g, '');
      if (mobileDigits.length < 10) errs.push('Student Mobile < 10 digits');
      const guardDigits = guardianMobile.replace(/\D/g, '');
      if (guardDigits.length < 10) errs.push('Guardian Mobile < 10 digits');

      rows.push({
        rowNum: idx + 1,
        rollNo: upperRoll,
        name,
        mobile,
        guardianMobile,
        email: email || `${upperRoll.toLowerCase()}@attendai.edu.in`,
        status: statusRaw.toLowerCase() === 'inactive' ? 'inactive' : 'active',
        errors: errs,
      });
    });

    setCsvPreview(rows);
  };

  const loadSampleCsvWithErrors = () => {
    const baseNum = students.length + 25;
    const sample = `rollNo,name,mobile,guardianMobile,email,status
0187${branch.code.slice(0, 2)}2410${baseNum},Karanveer Singh,+91 98260 55101,+91 94250 66101,karanveer@attendai.edu.in,active
0187${branch.code.slice(0, 2)}2410${baseNum + 1},Ritika Deshmukh,+91 98260 55102,+91 94250 66102,ritika@attendai.edu.in,active
${students[0]?.rollNo || 'DUPLICATE01'},Duplicate Student Test,+91 98260 55103,+91 94250 66103,dup@attendai.edu.in,active
0187${branch.code.slice(0, 2)}2410${baseNum + 2},Invalid Phone Row,98260,94250,badphone@attendai.edu.in,active`;
    validateCsvContent(sample);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = String(ev.target?.result || '');
      validateCsvContent(content);
    };
    reader.readAsText(file);
  };

  const handleBulkImportValidRows = async () => {
    const validRows = csvPreview.filter((r) => r.errors.length === 0);
    if (validRows.length === 0) return;
    setImportingCsv(true);
    try {
      const res = await apiRequest<{ added: Student[]; skipped: { rollNo: string; reason: string }[] }>(
        '/api/students/bulk',
        {
          method: 'POST',
          body: JSON.stringify({
            courseId: course.id,
            branchId: branch.id,
            year,
            students: validRows,
          }),
        }
      );
      setCsvSuccessMsg(`Imported ${res.added.length} valid students into ${branch.code} Year ${year}.`);
      await loadStudents();
      onStudentsChanged?.();
      setTimeout(() => {
        setShowCsvModal(false);
        setCsvSuccessMsg(null);
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk CSV import failed');
    } finally {
      setImportingCsv(false);
    }
  };

  const filteredStudents = students.filter((s) => {
    if (statusFilter !== 'all' && s.status !== statusFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      s.rollNo.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q) ||
      s.mobile.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-5">
      {/* Top Banner & Action Controls */}
      <div className="bg-white border border-[#e2e8f0] rounded-[16px] p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-bold text-[#0f172a]">
                {canEdit ? 'HOD Student Management' : 'Teacher Student Directory (View-Only)'}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#eff6ff] text-[#2563eb]">
                {course.code} · {branch.code} · Year {year}
              </span>
            </div>
            <p className="text-xs text-[#64748b] mt-1">
              {canEdit
                ? 'Add individual students, bulk import via validated CSV, or edit/soft-delete department records.'
                : 'Read-only directory for your assigned class. Only HOD can add, edit, or delete student data.'}
            </p>
          </div>

          {/* Action Buttons (Unlocked for HOD, Locked with Lock icon for Teacher) */}
          <div className="flex flex-wrap items-center gap-2.5">
            {!canEdit && (
              <div className="px-3 py-2 rounded-[10px] bg-[#f1f5f9] border border-[#e2e8f0] text-xs font-medium text-[#64748b] flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-[#64748b]" />
                <span>Only HOD can edit student data</span>
              </div>
            )}

            <button
              type="button"
              disabled={!canEdit}
              onClick={() => {
                setCsvRawText('');
                setCsvPreview([]);
                setCsvSuccessMsg(null);
                setShowCsvModal(true);
              }}
              className={`px-3.5 py-2.5 rounded-[10px] text-xs font-semibold border flex items-center gap-2 transition-colors ${
                canEdit
                  ? 'bg-white border-[#e2e8f0] text-[#0f172a] hover:border-[#2563eb] cursor-pointer'
                  : 'bg-[#f1f5f9] border-[#e2e8f0] text-[#64748b] opacity-70 cursor-not-allowed'
              }`}
            >
              {canEdit ? <Upload className="w-4 h-4 text-[#2563eb]" /> : <Lock className="w-3.5 h-3.5" />}
              <span>Bulk Import CSV</span>
            </button>

            <button
              type="button"
              disabled={!canEdit}
              onClick={openAddModal}
              className={`px-4 py-2.5 rounded-[10px] text-xs font-semibold flex items-center gap-2 transition-colors ${
                canEdit
                  ? 'bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-xs cursor-pointer'
                  : 'bg-[#e2e8f0] text-[#64748b] opacity-75 cursor-not-allowed'
              }`}
            >
              {canEdit ? <Plus className="w-4 h-4" /> : <Lock className="w-3.5 h-3.5" />}
              <span>Add Student</span>
            </button>
          </div>
        </div>

        {/* Search & Status Filter Bar */}
        <div className="mt-5 pt-4 border-t border-[#e2e8f0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#64748b] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Roll No, Student Name, Mobile, or Email..."
              className="w-full pl-9 pr-4 py-2 text-xs bg-[#f8fafc] border border-[#e2e8f0] rounded-[10px] text-[#0f172a] placeholder-[#64748b] focus:outline-none focus:bg-white focus:border-[#2563eb]"
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-[#f8fafc] border border-[#e2e8f0] p-1 rounded-[10px]">
              {(['all', 'active', 'inactive'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1 rounded-[8px] text-xs font-medium capitalize transition-colors cursor-pointer ${
                    statusFilter === st
                      ? 'bg-white text-[#0f172a] shadow-xs font-semibold'
                      : 'text-[#64748b] hover:text-[#0f172a]'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
            <span className="text-xs font-mono-num text-[#64748b] px-2">
              {filteredStudents.length} students
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-[12px] bg-[#fee2e2] text-[#dc2626] text-xs font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Student Table */}
      <div className="bg-white border border-[#e2e8f0] rounded-[16px] overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-10 bg-[#f1f5f9] rounded-[8px] animate-pulse" />
            ))}
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-8 h-8 text-[#64748b] mx-auto mb-2 opacity-60" />
            <div className="text-sm font-semibold text-[#0f172a]">No students found</div>
            <p className="text-xs text-[#64748b] mt-1">
              {canEdit
                ? 'Click "Add Student" or "Bulk Import CSV" above to populate this class.'
                : 'No student records match your current search filter.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f8fafc] border-b border-[#e2e8f0] text-[11px] font-semibold text-[#64748b] uppercase tracking-wider">
                  <th className="py-3 px-4">Roll No</th>
                  <th className="py-3 px-4">Student Name</th>
                  <th className="py-3 px-4">Student Mobile</th>
                  <th className="py-3 px-4">Parent / Guardian Mobile</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Year</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e2e8f0] text-xs">
                {filteredStudents.map((stu) => (
                  <tr key={stu.id} className="hover:bg-[#f8fafc] transition-colors">
                    <td className="py-3 px-4 font-mono-num font-semibold text-[#0f172a] whitespace-nowrap">
                      {stu.rollNo}
                    </td>
                    <td className="py-3 px-4 font-semibold text-[#0f172a] whitespace-nowrap">
                      {stu.name}
                    </td>
                    <td className="py-3 px-4 font-mono-num text-[#0f172a] whitespace-nowrap">
                      {stu.mobile}
                    </td>
                    <td className="py-3 px-4 font-mono-num text-[#64748b] whitespace-nowrap">
                      {stu.guardianMobile}
                    </td>
                    <td className="py-3 px-4 text-[#64748b] whitespace-nowrap">{stu.email}</td>
                    <td className="py-3 px-4 font-mono-num text-[#64748b] whitespace-nowrap">
                      Yr {stu.year}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {stu.status === 'active' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#dcfce7] text-[#16a34a]">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#f1f5f9] text-[#64748b]">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      {canEdit ? (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditModal(stu)}
                            className="p-1.5 rounded-[8px] border border-[#e2e8f0] text-[#0f172a] hover:border-[#2563eb] hover:text-[#2563eb] transition-colors cursor-pointer"
                            title="Edit Student"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingStudent(stu)}
                            className="p-1.5 rounded-[8px] border border-[#e2e8f0] text-[#64748b] hover:border-[#dc2626] hover:text-[#dc2626] transition-colors cursor-pointer"
                            title="Soft Delete Student"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[8px] bg-[#f1f5f9] text-[#64748b] text-[11px] font-medium"
                          title="Only HOD can edit student data"
                        >
                          <Lock className="w-3 h-3" />
                          Locked
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Single Student Modal */}
      {showStudentModal && (
        <div className="fixed inset-0 z-50 bg-[#0f172a]/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#e2e8f0] rounded-[22px] max-w-lg w-full p-6 sm:p-7 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-[#0f172a]">
                  {editingStudent ? 'Edit Student Record' : 'Add New Student'}
                </h3>
                <p className="text-xs text-[#64748b]">
                  {course.code} · {branch.code} · Year {year}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowStudentModal(false)}
                className="p-1.5 text-[#64748b] hover:text-[#0f172a]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="mb-4 p-3 rounded-[10px] bg-[#fee2e2] text-[#dc2626] text-xs font-medium">
                {modalError}
              </div>
            )}

            <form onSubmit={handleSaveStudent} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-[#0f172a] mb-1">
                    Roll Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={formRollNo}
                    onChange={(e) => setFormRollNo(e.target.value)}
                    placeholder="e.g., 0187CS241019"
                    className="w-full px-3.5 py-2 text-xs font-mono-num border border-[#e2e8f0] rounded-[10px] focus:outline-none focus:border-[#2563eb]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#0f172a] mb-1">
                    Status *
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as 'active' | 'inactive')}
                    className="w-full px-3.5 py-2 text-xs border border-[#e2e8f0] rounded-[10px] bg-white focus:outline-none focus:border-[#2563eb]"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0f172a] mb-1">
                  Full Student Name *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., Siddharth Chauhan"
                  className="w-full px-3.5 py-2 text-xs border border-[#e2e8f0] rounded-[10px] focus:outline-none focus:border-[#2563eb]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-[#0f172a] mb-1">
                    Student Mobile *
                  </label>
                  <input
                    type="text"
                    required
                    value={formMobile}
                    onChange={(e) => setFormMobile(e.target.value)}
                    placeholder="+91 98260 12345"
                    className="w-full px-3.5 py-2 text-xs font-mono-num border border-[#e2e8f0] rounded-[10px] focus:outline-none focus:border-[#2563eb]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#0f172a] mb-1">
                    Parent / Guardian Mobile *
                  </label>
                  <input
                    type="text"
                    required
                    value={formGuardianMobile}
                    onChange={(e) => setFormGuardianMobile(e.target.value)}
                    placeholder="+91 94250 12345"
                    className="w-full px-3.5 py-2 text-xs font-mono-num border border-[#e2e8f0] rounded-[10px] focus:outline-none focus:border-[#2563eb]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0f172a] mb-1">
                  College Email
                </label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="student@attendai.edu.in"
                  className="w-full px-3.5 py-2 text-xs border border-[#e2e8f0] rounded-[10px] focus:outline-none focus:border-[#2563eb]"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowStudentModal(false)}
                  className="px-4 py-2 rounded-[10px] border border-[#e2e8f0] text-xs font-medium text-[#64748b] hover:text-[#0f172a]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingStudent}
                  className="px-5 py-2 rounded-[10px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-semibold cursor-pointer"
                >
                  {savingStudent ? 'Saving...' : editingStudent ? 'Update Student' : 'Add Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Soft Delete Confirmation Modal */}
      {deletingStudent && (
        <div className="fixed inset-0 z-50 bg-[#0f172a]/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#e2e8f0] rounded-[22px] max-w-md w-full p-6 shadow-xl">
            <h3 className="text-base font-bold text-[#0f172a] mb-2">
              Confirm Student Soft-Delete
            </h3>
            <p className="text-xs text-[#64748b] mb-5">
              Are you sure you want to remove{' '}
              <span className="font-semibold text-[#0f172a]">{deletingStudent.name}</span> (
              <span className="font-mono-num">{deletingStudent.rollNo}</span>) from the active directory? Historical attendance records will be preserved and this action will be logged in the Audit Trail.
            </p>
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeletingStudent(null)}
                className="px-4 py-2 rounded-[10px] border border-[#e2e8f0] text-xs font-medium text-[#64748b]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingBusy}
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-[10px] bg-[#dc2626] hover:bg-[#b91c1c] text-white text-xs font-semibold cursor-pointer"
              >
                {deletingBusy ? 'Removing...' : 'Confirm Soft Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk CSV Import Modal with Validation & Preview of Errors */}
      {showCsvModal && (
        <div className="fixed inset-0 z-50 bg-[#0f172a]/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#e2e8f0] rounded-[22px] max-w-3xl w-full p-6 sm:p-7 shadow-xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-[10px] bg-[#eff6ff] text-[#2563eb] flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#0f172a]">
                    Bulk Import Students via CSV
                  </h3>
                  <p className="text-xs text-[#64748b]">
                    Target Class: {course.code} · {branch.code} · Year {year}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCsvModal(false)}
                className="p-1.5 text-[#64748b] hover:text-[#0f172a]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="text-xs text-[#64748b]">
                Format: <code className="font-mono-num bg-[#f1f5f9] px-1.5 py-0.5 rounded">rollNo,name,mobile,guardianMobile,email,status</code>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={loadSampleCsvWithErrors}
                  className="px-3 py-1.5 rounded-[8px] bg-[#eff6ff] text-[#2563eb] text-xs font-semibold hover:bg-[#dbeafe] transition-colors cursor-pointer"
                >
                  Load Sample CSV (with validation demo)
                </button>
                <label className="px-3 py-1.5 rounded-[8px] border border-[#e2e8f0] text-xs font-semibold text-[#0f172a] hover:bg-[#f8fafc] cursor-pointer flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload .CSV File</span>
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            <textarea
              rows={4}
              value={csvRawText}
              onChange={(e) => validateCsvContent(e.target.value)}
              placeholder="Paste CSV lines here or click 'Load Sample CSV' above..."
              className="w-full p-3 text-xs font-mono-num bg-[#f8fafc] border border-[#e2e8f0] rounded-[10px] focus:outline-none focus:bg-white focus:border-[#2563eb] mb-4"
            />

            {csvSuccessMsg && (
              <div className="mb-4 p-3 rounded-[10px] bg-[#dcfce7] text-[#16a34a] text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>{csvSuccessMsg}</span>
              </div>
            )}

            {/* Validation Preview Table */}
            <div className="flex-1 overflow-y-auto border border-[#e2e8f0] rounded-[12px] mb-4">
              {csvPreview.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#64748b]">
                  Paste CSV rows or upload a file to preview row-level validation before importing.
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#f8fafc] border-b border-[#e2e8f0] text-[11px] font-semibold text-[#64748b]">
                      <th className="py-2.5 px-3">Row</th>
                      <th className="py-2.5 px-3">Roll No</th>
                      <th className="py-2.5 px-3">Name</th>
                      <th className="py-2.5 px-3">Mobile</th>
                      <th className="py-2.5 px-3">Guardian Mobile</th>
                      <th className="py-2.5 px-3">Validation Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e2e8f0]">
                    {csvPreview.map((row) => {
                      const isValid = row.errors.length === 0;
                      return (
                        <tr
                          key={row.rowNum}
                          className={isValid ? 'bg-white' : 'bg-[#fee2e2]/40'}
                        >
                          <td className="py-2 px-3 font-mono-num text-[#64748b]">#{row.rowNum}</td>
                          <td className="py-2 px-3 font-mono-num font-semibold text-[#0f172a]">
                            {row.rollNo || '—'}
                          </td>
                          <td className="py-2 px-3 text-[#0f172a]">{row.name || '—'}</td>
                          <td className="py-2 px-3 font-mono-num text-[#64748b]">{row.mobile}</td>
                          <td className="py-2 px-3 font-mono-num text-[#64748b]">
                            {row.guardianMobile}
                          </td>
                          <td className="py-2 px-3">
                            {isValid ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#dcfce7] text-[#16a34a]">
                                <CheckCircle2 className="w-3 h-3" /> Valid
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#fee2e2] text-[#dc2626]">
                                <AlertCircle className="w-3 h-3" /> {row.errors.join(', ')}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="text-xs text-[#64748b]">
                Valid rows:{' '}
                <span className="font-semibold text-[#16a34a]">
                  {csvPreview.filter((r) => r.errors.length === 0).length}
                </span>{' '}
                · Error rows (skipped):{' '}
                <span className="font-semibold text-[#dc2626]">
                  {csvPreview.filter((r) => r.errors.length > 0).length}
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowCsvModal(false)}
                  className="px-4 py-2 rounded-[10px] border border-[#e2e8f0] text-xs font-medium text-[#64748b]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={
                    importingCsv || csvPreview.filter((r) => r.errors.length === 0).length === 0
                  }
                  onClick={handleBulkImportValidRows}
                  className="px-5 py-2 rounded-[10px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  {importingCsv
                    ? 'Importing...'
                    : `Import ${csvPreview.filter((r) => r.errors.length === 0).length} Valid Students`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// HOD Course & Branch Management Component
// ============================================================================
interface HodCourseBranchManagerProps {
  courses: CourseWithCount[];
  branches: BranchWithCount[];
  onCatalogUpdated: () => Promise<void>;
}

export const HodCourseBranchManager: React.FC<HodCourseBranchManagerProps> = ({
  courses,
  branches,
  onCatalogUpdated,
}) => {
  const [courseCode, setCourseCode] = useState('');
  const [courseName, setCourseName] = useState('');
  const [courseDuration, setCourseDuration] = useState(4);
  const [editingCourse, setEditingCourse] = useState<CourseWithCount | null>(null);

  const [branchCourseId, setBranchCourseId] = useState(courses[0]?.id || 'course-btech');
  const [branchCode, setBranchCode] = useState('');
  const [branchName, setBranchName] = useState('');
  const [editingBranch, setEditingBranch] = useState<BranchWithCount | null>(null);

  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      if (editingCourse) {
        await apiRequest(`/api/courses/${editingCourse.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            code: courseCode,
            name: courseName,
            durationYears: courseDuration,
          }),
        });
        setFeedback({ type: 'ok', text: `Updated course ${courseCode}.` });
      } else {
        await apiRequest('/api/courses', {
          method: 'POST',
          body: JSON.stringify({
            code: courseCode,
            name: courseName,
            durationYears: courseDuration,
          }),
        });
        setFeedback({ type: 'ok', text: `Created course ${courseCode}.` });
      }
      setEditingCourse(null);
      setCourseCode('');
      setCourseName('');
      setCourseDuration(4);
      await onCatalogUpdated();
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to save course',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteCourse = async (c: CourseWithCount) => {
    setBusy(true);
    setFeedback(null);
    try {
      await apiRequest(`/api/courses/${c.id}`, { method: 'DELETE' });
      setFeedback({ type: 'ok', text: `Deleted course ${c.code}.` });
      await onCatalogUpdated();
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Cannot delete course',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleSaveBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      if (editingBranch) {
        await apiRequest(`/api/branches/${editingBranch.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            code: branchCode,
            name: branchName,
          }),
        });
        setFeedback({ type: 'ok', text: `Updated branch ${branchCode}.` });
      } else {
        await apiRequest('/api/branches', {
          method: 'POST',
          body: JSON.stringify({
            courseId: branchCourseId,
            code: branchCode,
            name: branchName,
          }),
        });
        setFeedback({ type: 'ok', text: `Created branch ${branchCode}.` });
      }
      setEditingBranch(null);
      setBranchCode('');
      setBranchName('');
      await onCatalogUpdated();
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to save branch',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteBranch = async (b: BranchWithCount) => {
    setBusy(true);
    setFeedback(null);
    try {
      await apiRequest(`/api/branches/${b.id}`, { method: 'DELETE' });
      setFeedback({ type: 'ok', text: `Deleted branch ${b.code}.` });
      await onCatalogUpdated();
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Cannot delete branch',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {feedback && (
        <div
          className={`p-3.5 rounded-[12px] text-xs font-semibold flex items-center justify-between ${
            feedback.type === 'ok'
              ? 'bg-[#dcfce7] text-[#16a34a]'
              : 'bg-[#fee2e2] text-[#dc2626]'
          }`}
        >
          <span>{feedback.text}</span>
          <button type="button" onClick={() => setFeedback(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Courses Column */}
        <div className="bg-white border border-[#e2e8f0] rounded-[16px] p-5 shadow-xs space-y-5">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#2563eb]" />
            <div>
              <h3 className="text-base font-bold text-[#0f172a]">Course Management</h3>
              <p className="text-xs text-[#64748b]">Create, edit, or delete degree programs</p>
            </div>
          </div>

          <form onSubmit={handleSaveCourse} className="bg-[#f8fafc] border border-[#e2e8f0] rounded-[12px] p-4 space-y-3">
            <div className="text-xs font-bold text-[#0f172a]">
              {editingCourse ? `Editing Course: ${editingCourse.code}` : 'Add New Course'}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <input
                type="text"
                required
                value={courseCode}
                onChange={(e) => setCourseCode(e.target.value)}
                placeholder="Code (e.g. M.Tech)"
                className="px-3 py-2 text-xs bg-white border border-[#e2e8f0] rounded-[10px]"
              />
              <input
                type="text"
                required
                value={courseName}
                onChange={(e) => setCourseName(e.target.value)}
                placeholder="Full Course Name"
                className="px-3 py-2 text-xs bg-white border border-[#e2e8f0] rounded-[10px]"
              />
              <select
                value={courseDuration}
                onChange={(e) => setCourseDuration(Number(e.target.value))}
                className="px-3 py-2 text-xs bg-white border border-[#e2e8f0] rounded-[10px]"
              >
                <option value={2}>2 Years</option>
                <option value={3}>3 Years</option>
                <option value={4}>4 Years</option>
                <option value={5}>5 Years</option>
              </select>
            </div>
            <div className="flex items-center justify-end gap-2">
              {editingCourse && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingCourse(null);
                    setCourseCode('');
                    setCourseName('');
                  }}
                  className="px-3 py-1.5 text-xs text-[#64748b]"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={busy}
                className="px-4 py-2 rounded-[10px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-semibold cursor-pointer"
              >
                {editingCourse ? 'Update Course' : '+ Add Course'}
              </button>
            </div>
          </form>

          <div className="divide-y divide-[#e2e8f0] border border-[#e2e8f0] rounded-[12px] overflow-hidden">
            {courses.map((c) => (
              <div key={c.id} className="p-3.5 flex items-center justify-between hover:bg-[#f8fafc]">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[#0f172a]">{c.code}</span>
                    <span className="text-xs text-[#64748b]">({c.durationYears} Yrs)</span>
                  </div>
                  <div className="text-xs text-[#64748b]">{c.name}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="px-2.5 py-1 rounded-full bg-[#eff6ff] text-[#2563eb] text-xs font-mono-num font-semibold">
                    {c.studentCount || 0} Students
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCourse(c);
                      setCourseCode(c.code);
                      setCourseName(c.name);
                      setCourseDuration(c.durationYears);
                    }}
                    className="p-1.5 rounded-[8px] border border-[#e2e8f0] text-[#0f172a] hover:border-[#2563eb] cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteCourse(c)}
                    className="p-1.5 rounded-[8px] border border-[#e2e8f0] text-[#64748b] hover:border-[#dc2626] hover:text-[#dc2626] cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Branches Column */}
        <div className="bg-white border border-[#e2e8f0] rounded-[16px] p-5 shadow-xs space-y-5">
          <div className="flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-[#2563eb]" />
            <div>
              <h3 className="text-base font-bold text-[#0f172a]">Branch Management</h3>
              <p className="text-xs text-[#64748b]">Create, edit, or delete department branches</p>
            </div>
          </div>

          <form onSubmit={handleSaveBranch} className="bg-[#f8fafc] border border-[#e2e8f0] rounded-[12px] p-4 space-y-3">
            <div className="text-xs font-bold text-[#0f172a]">
              {editingBranch ? `Editing Branch: ${editingBranch.code}` : 'Add New Branch'}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <select
                value={branchCourseId}
                disabled={Boolean(editingBranch)}
                onChange={(e) => setBranchCourseId(e.target.value)}
                className="px-3 py-2 text-xs bg-white border border-[#e2e8f0] rounded-[10px]"
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code}
                  </option>
                ))}
              </select>
              <input
                type="text"
                required
                value={branchCode}
                onChange={(e) => setBranchCode(e.target.value)}
                placeholder="Branch Code (e.g. AIML)"
                className="px-3 py-2 text-xs bg-white border border-[#e2e8f0] rounded-[10px]"
              />
              <input
                type="text"
                required
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                placeholder="Branch Full Name"
                className="px-3 py-2 text-xs bg-white border border-[#e2e8f0] rounded-[10px]"
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              {editingBranch && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingBranch(null);
                    setBranchCode('');
                    setBranchName('');
                  }}
                  className="px-3 py-1.5 text-xs text-[#64748b]"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={busy}
                className="px-4 py-2 rounded-[10px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-semibold cursor-pointer"
              >
                {editingBranch ? 'Update Branch' : '+ Add Branch'}
              </button>
            </div>
          </form>

          <div className="divide-y divide-[#e2e8f0] border border-[#e2e8f0] rounded-[12px] overflow-hidden max-h-[360px] overflow-y-auto">
            {branches.map((b) => {
              const parentCourse = courses.find((c) => c.id === b.courseId);
              return (
                <div key={b.id} className="p-3.5 flex items-center justify-between hover:bg-[#f8fafc]">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[#0f172a]">{b.code}</span>
                      <span className="px-2 py-0.5 rounded bg-[#f1f5f9] text-[10px] font-semibold text-[#64748b]">
                        {parentCourse?.code || 'Course'}
                      </span>
                    </div>
                    <div className="text-xs text-[#64748b]">{b.name}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-1 rounded-full bg-[#eff6ff] text-[#2563eb] text-xs font-mono-num font-semibold">
                      {b.studentCount || 0} Students
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingBranch(b);
                        setBranchCourseId(b.courseId);
                        setBranchCode(b.code);
                        setBranchName(b.name);
                      }}
                      className="p-1.5 rounded-[8px] border border-[#e2e8f0] text-[#0f172a] hover:border-[#2563eb] cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteBranch(b)}
                      className="p-1.5 rounded-[8px] border border-[#e2e8f0] text-[#64748b] hover:border-[#dc2626] hover:text-[#dc2626] cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
