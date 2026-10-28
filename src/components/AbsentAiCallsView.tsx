import React, { useState, useEffect } from 'react';
import {
  PhoneCall,
  PhoneForwarded,
  PhoneOff,
  FileText,
  Volume2,
  Trash2,
  Edit3,
  Play,
  CheckCircle2,
  Clock,
  AlertCircle,
  Lock,
  X,
  Globe,
  Sparkles,
} from 'lucide-react';
import {
  AbsentFollowup,
  CallLanguage,
  Course,
  Branch,
  UserRole,
  ReasonCategory,
  SchedulerConfig,
} from '../types.ts';
import { apiRequest } from '../api.ts';

interface EnrichedFollowup extends AbsentFollowup {
  studentName: string;
  rollNo: string;
  studentMobile: string;
  guardianMobile: string;
  branchCode: string;
  courseCode: string;
}

interface AbsentAiCallsProps {
  activeRole: UserRole;
  course?: Course;
  branch?: Branch;
  year?: number;
}

export const AbsentAiCallsView: React.FC<AbsentAiCallsProps> = ({
  activeRole,
  course,
  branch,
  year,
}) => {
  const [selectedDate, setSelectedDate] = useState<string>('2026-10-26');
  const [followups, setFollowups] = useState<EnrichedFollowup[]>([]);
  const [schedulerConfig, setSchedulerConfig] = useState<SchedulerConfig | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [callingId, setCallingId] = useState<string | null>(null);
  const [batchRunning, setBatchRunning] = useState<boolean>(false);

  // Per-row language & contact target overrides
  const [rowLang, setRowLang] = useState<Record<string, CallLanguage>>({});
  const [rowTarget, setRowTarget] = useState<Record<string, 'student' | 'guardian'>>({});
  const [testOutcomeMode, setTestOutcomeMode] = useState<'answered' | 'no_answer' | 'opted_out'>(
    'answered'
  );

  // Transcript & Audio Playback Modal
  const [activeTranscriptRow, setActiveTranscriptRow] = useState<EnrichedFollowup | null>(null);
  const [playingAudio, setPlayingAudio] = useState<boolean>(false);

  // Manual Reason Override Modal
  const [manualOverrideRow, setManualOverrideRow] = useState<EnrichedFollowup | null>(null);
  const [manualReasonText, setManualReasonText] = useState<string>('');
  const [manualCategory, setManualCategory] = useState<ReasonCategory>('medical');
  const [savingManual, setSavingManual] = useState<boolean>(false);

  const [banner, setBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const loadFollowups = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ date: selectedDate });
      if (course) params.set('courseId', course.id);
      if (branch) params.set('branchId', branch.id);
      if (year) params.set('year', String(year));

      const res = await apiRequest<{
        date: string;
        schedulerConfig: SchedulerConfig;
        followups: EnrichedFollowup[];
      }>(`/api/ai-calls?${params.toString()}`);

      setFollowups(res.followups);
      setSchedulerConfig(res.schedulerConfig);
    } catch (err) {
      setBanner({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to load absent follow-ups',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFollowups();
  }, [selectedDate, course?.id, branch?.id, year]);

  const handlePlaceSingleCall = async (row: EnrichedFollowup) => {
    setCallingId(row.id);
    setBanner(null);
    try {
      const lang = rowLang[row.id] || row.language || 'hi-IN';
      const target = rowTarget[row.id] || row.contactTarget || 'guardian';

      const res = await apiRequest<{ followup: EnrichedFollowup }>(
        `/api/ai-calls/${row.id}/call`,
        {
          method: 'POST',
          body: JSON.stringify({
            language: lang,
            contactTarget: target,
            simulatedOutcome: testOutcomeMode,
          }),
        }
      );

      setFollowups((prev) =>
        prev.map((item) => (item.id === row.id ? { ...item, ...res.followup } : item))
      );

      setBanner({
        type: 'ok',
        text: `AI Call to ${row.studentName} (${
          lang === 'hi-IN' ? 'Hindi' : 'English'
        }) finished with status: ${res.followup.callStatus.toUpperCase()}`,
      });
    } catch (err) {
      setBanner({
        type: 'err',
        text: err instanceof Error ? err.message : 'AI Call failed',
      });
    } finally {
      setCallingId(null);
    }
  };

  const handleRunBatchPass = async () => {
    setBatchRunning(true);
    setBanner(null);
    try {
      const res = await apiRequest<{
        processed: number;
        answeredCount: number;
        unansweredCount: number;
      }>('/api/ai-calls/batch-pass', {
        method: 'POST',
        body: JSON.stringify({
          date: selectedDate,
          courseId: course?.id,
          branchId: branch?.id,
          year,
        }),
      });
      await loadFollowups();
      setBanner({
        type: 'ok',
        text: `Automated AI Call Pass completed: Dialed ${res.processed} students (${res.answeredCount} Answered & Extracted via Gemini, ${res.unansweredCount} Unanswered).`,
      });
    } catch (err) {
      setBanner({
        type: 'err',
        text: err instanceof Error ? err.message : 'Batch AI Call pass failed',
      });
    } finally {
      setBatchRunning(false);
    }
  };

  const handleSaveManualReason = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualOverrideRow) return;
    setSavingManual(true);
    try {
      await apiRequest(`/api/ai-calls/${manualOverrideRow.id}/manual-reason`, {
        method: 'PATCH',
        body: JSON.stringify({
          reasonText: manualReasonText,
          reasonCategory: manualCategory,
        }),
      });
      setManualOverrideRow(null);
      await loadFollowups();
      setBanner({
        type: 'ok',
        text: `Saved manual absence reason override for ${manualOverrideRow.studentName}.`,
      });
    } catch (err) {
      setBanner({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to save manual reason',
      });
    } finally {
      setSavingManual(false);
    }
  };

  const handleDeleteTranscript = async (row: EnrichedFollowup) => {
    try {
      await apiRequest(`/api/ai-calls/${row.id}/transcript`, {
        method: 'DELETE',
      });
      setActiveTranscriptRow(null);
      await loadFollowups();
      setBanner({
        type: 'ok',
        text: `Deleted call transcript for ${row.studentName} per privacy policy.`,
      });
    } catch (err) {
      setBanner({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to delete transcript',
      });
    }
  };

  const handlePlayVoiceTranscript = async (row: EnrichedFollowup) => {
    if (!row.transcript) return;
    setPlayingAudio(true);
    try {
      const res = await apiRequest<{ audioBase64: string; mimeType: string }>(
        `/api/ai-calls/${row.id}/tts`,
        {
          method: 'POST',
        }
      );
      const audio = new Audio(`data:${res.mimeType};base64,${res.audioBase64}`);
      audio.onended = () => setPlayingAudio(false);
      audio.onerror = () => setPlayingAudio(false);
      await audio.play();
    } catch {
      // Fallback to browser SpeechSynthesis for instant demo playback
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(row.transcript);
        utterance.lang = row.language || 'hi-IN';
        utterance.onend = () => setPlayingAudio(false);
        utterance.onerror = () => setPlayingAudio(false);
        window.speechSynthesis.speak(utterance);
      } else {
        setPlayingAudio(false);
      }
    }
  };

  const pendingCount = followups.filter((f) => f.callStatus === 'pending').length;
  const answeredCount = followups.filter((f) => f.callStatus === 'answered').length;
  const unansweredCount = followups.filter((f) => f.callStatus === 'unanswered').length;

  return (
    <div className="space-y-5">
      {/* Phase 2 Automated AI Calling Header & Test Mode Controls */}
      <div className="bg-white border border-[#e2e8f0] rounded-[16px] p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-bold text-[#0f172a]">
                Absent Students & Automated AI Calls
              </h2>
              {course && branch && year && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#eff6ff] text-[#2563eb]">
                  {course.code} · {branch.code} · Year {year}
                </span>
              )}
            </div>
            <p className="text-xs text-[#64748b] mt-1">
              Automated voice calls (Hindi default, English optional) greet the guardian/student, verify absence reason via Gemini AI, and extract structured JSON.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2 bg-[#f8fafc] border border-[#e2e8f0] px-3 py-2 rounded-[10px] text-xs">
              <span className="text-[#64748b] font-semibold">Date:</span>
              <input
                type="date"
                value={selectedDate}
                max="2026-10-26"
                onChange={(e) => setSelectedDate(e.target.value)}
                className="font-mono-num font-semibold text-[#0f172a] bg-transparent focus:outline-none"
              />
            </div>

            <button
              type="button"
              disabled={batchRunning || followups.length === 0}
              onClick={handleRunBatchPass}
              className="px-4 py-2.5 rounded-[10px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-semibold flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5" />
              <span>
                {batchRunning
                  ? 'Running AI Call Pass...'
                  : `Run Scheduled AI Call Pass (${pendingCount} Pending)`}
              </span>
            </button>
          </div>
        </div>

        {/* Scheduler Status Bar & Test Mode Simulator Selector */}
        <div className="mt-4 pt-4 border-t border-[#e2e8f0] flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3 text-[#64748b]">
            <span>
              Scheduled Passes:{' '}
              <strong className="font-mono-num text-[#0f172a]">
                {schedulerConfig?.firstPassTime || '12:00'} PM &{' '}
                {schedulerConfig?.secondPassTime || '13:00'} PM
              </strong>
            </span>
            <span>·</span>
            <span>
              Allowed Hours:{' '}
              <strong className="font-mono-num text-[#0f172a]">09:00 AM – 06:00 PM</strong>
            </span>
            <span>·</span>
            <span>
              Retries: <strong className="font-mono-num text-[#0f172a]">Up to 2 (45m gap)</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[#64748b] font-medium">Test Mode Call Outcome:</span>
            <select
              value={testOutcomeMode}
              onChange={(e) =>
                setTestOutcomeMode(e.target.value as 'answered' | 'no_answer' | 'opted_out')
              }
              className="px-2.5 py-1.5 rounded-[8px] border border-[#e2e8f0] bg-[#f8fafc] text-xs font-semibold text-[#0f172a] focus:outline-none focus:border-[#2563eb]"
            >
              <option value="answered">Simulate Answered + Gemini Extraction</option>
              <option value="no_answer">Simulate No Answer (Retry / Unanswered)</option>
              <option value="opted_out">Simulate Recipient Opt-Out</option>
            </select>
          </div>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-[#e2e8f0] rounded-[14px] p-4 shadow-xs">
          <div className="text-xs text-[#64748b]">Total Absent Today</div>
          <div className="text-2xl font-bold font-mono-num text-[#dc2626] mt-1">
            {followups.length}
          </div>
        </div>
        <div className="bg-white border border-[#e2e8f0] rounded-[14px] p-4 shadow-xs">
          <div className="text-xs text-[#64748b]">Not Called / Pending</div>
          <div className="text-2xl font-bold font-mono-num text-[#b45309] mt-1">
            {pendingCount}
          </div>
        </div>
        <div className="bg-white border border-[#e2e8f0] rounded-[14px] p-4 shadow-xs">
          <div className="text-xs text-[#64748b]">Answered (Reason Captured)</div>
          <div className="text-2xl font-bold font-mono-num text-[#16a34a] mt-1">
            {answeredCount}
          </div>
        </div>
        <div className="bg-white border border-[#e2e8f0] rounded-[14px] p-4 shadow-xs">
          <div className="text-xs text-[#64748b]">Unanswered (Grey)</div>
          <div className="text-2xl font-bold font-mono-num text-[#64748b] mt-1">
            {unansweredCount}
          </div>
        </div>
      </div>

      {banner && (
        <div
          className={`p-3.5 rounded-[12px] text-xs font-semibold flex items-center justify-between ${
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

      {/* Absent & AI Calls Table */}
      <div className="bg-white border border-[#e2e8f0] rounded-[16px] overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 bg-[#f1f5f9] rounded-[8px] animate-pulse" />
            ))}
          </div>
        ) : followups.length === 0 ? (
          <div className="p-12 text-center">
            <PhoneCall className="w-8 h-8 text-[#64748b] mx-auto mb-2 opacity-60" />
            <div className="text-sm font-semibold text-[#0f172a]">
              No absent students recorded for {selectedDate}
            </div>
            <p className="text-xs text-[#64748b] mt-1">
              When a teacher marks a student Absent on the Take Attendance screen, they automatically appear here with status "Not Called".
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f8fafc] border-b border-[#e2e8f0] text-[11px] font-semibold text-[#64748b] uppercase tracking-wider">
                  <th className="py-3 px-4">Branch</th>
                  <th className="py-3 px-4">Roll No</th>
                  <th className="py-3 px-4">Student Name</th>
                  <th className="py-3 px-4">Contact Mobile</th>
                  <th className="py-3 px-4">Captured Reason & Category</th>
                  <th className="py-3 px-4">Call Status</th>
                  <th className="py-3 px-4">Call Language</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e2e8f0] text-xs">
                {followups.map((row) => {
                  const isCallingThis = callingId === row.id;
                  const currentLang = rowLang[row.id] || row.language || 'hi-IN';
                  const currentTarget = rowTarget[row.id] || row.contactTarget || 'guardian';

                  return (
                    <tr key={row.id} className="hover:bg-[#f8fafc] transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-[#2563eb] whitespace-nowrap">
                        {row.branchCode}
                      </td>
                      <td className="py-3.5 px-4 font-mono-num font-semibold text-[#0f172a] whitespace-nowrap">
                        {row.rollNo}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-[#0f172a] whitespace-nowrap">
                        <div>{row.studentName}</div>
                        <div className="text-[11px] font-normal text-[#64748b]">
                          Attempts: <span className="font-mono-num">{row.attempts}/{row.maxAttempts}</span>
                          {row.lastAttemptAt &&
                            ` · Last: ${new Date(row.lastAttemptAt).toLocaleTimeString('en-IN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}`}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-mono-num font-medium text-[#0f172a]">
                          {currentTarget === 'guardian' ? row.guardianMobile : row.studentMobile}
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                          <button
                            type="button"
                            onClick={() =>
                              setRowTarget((p) => ({ ...p, [row.id]: 'guardian' }))
                            }
                            className={`text-[10px] px-1.5 py-0.5 rounded cursor-pointer ${
                              currentTarget === 'guardian'
                                ? 'bg-[#eff6ff] text-[#2563eb] font-semibold'
                                : 'text-[#64748b]'
                            }`}
                          >
                            Guardian
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setRowTarget((p) => ({ ...p, [row.id]: 'student' }))
                            }
                            className={`text-[10px] px-1.5 py-0.5 rounded cursor-pointer ${
                              currentTarget === 'student'
                                ? 'bg-[#eff6ff] text-[#2563eb] font-semibold'
                                : 'text-[#64748b]'
                            }`}
                          >
                            Student
                          </button>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 max-w-xs">
                        {row.reasonText ? (
                          <div>
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-[#eff6ff] text-[#2563eb]">
                                {row.reasonCategory}
                              </span>
                              {row.overriddenByTeacher && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#fef3c7] text-[#b45309]">
                                  Teacher Override
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-[#0f172a] line-clamp-2">
                              {row.reasonText}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-[#64748b] italic">
                            {row.callStatus === 'unanswered'
                              ? 'No response — reason empty'
                              : 'Awaiting AI call...'}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        { isCallingThis ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#eff6ff] text-[#2563eb]">
                            <PhoneForwarded className="w-3 h-3 animate-bounce" />
                            Calling...
                          </span>
                        ) : row.callStatus === 'pending' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#fef3c7] text-[#b45309]">
                            <Clock className="w-3 h-3" />
                            Not Called
                          </span>
                        ) : row.callStatus === 'answered' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#dcfce7] text-[#16a34a]">
                            <CheckCircle2 className="w-3 h-3" />
                            Answered
                          </span>
                        ) : row.callStatus === 'unanswered' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#f1f5f9] text-[#64748b]">
                            <PhoneOff className="w-3 h-3" />
                            Unanswered
                          </span>
                        ) : row.callStatus === 'opted_out' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#f1f5f9] text-[#64748b]">
                            <Lock className="w-3 h-3" />
                            Opted Out
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#fee2e2] text-[#dc2626]">
                            Failed
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="inline-flex items-center gap-1 bg-[#f8fafc] border border-[#e2e8f0] rounded-[8px] p-0.5">
                          <button
                            type="button"
                            onClick={() => setRowLang((p) => ({ ...p, [row.id]: 'hi-IN' }))}
                            className={`px-2 py-1 rounded-[6px] text-[11px] font-semibold cursor-pointer ${
                              currentLang === 'hi-IN'
                                ? 'bg-white text-[#2563eb] shadow-2xs'
                                : 'text-[#64748b]'
                            }`}
                          >
                            हिंदी
                          </button>
                          <button
                            type="button"
                            onClick={() => setRowLang((p) => ({ ...p, [row.id]: 'en-IN' }))}
                            className={`px-2 py-1 rounded-[6px] text-[11px] font-semibold cursor-pointer ${
                              currentLang === 'en-IN'
                                ? 'bg-white text-[#2563eb] shadow-2xs'
                                : 'text-[#64748b]'
                            }`}
                          >
                            ENG
                          </button>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {/* Call / Call Again Button */}
                          <button
                            type="button"
                            disabled={isCallingThis || row.callStatus === 'opted_out'}
                            onClick={() => handlePlaceSingleCall(row)}
                            className={`px-3 py-1.5 rounded-[10px] text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                              row.callStatus === 'opted_out'
                                ? 'bg-[#f1f5f9] text-[#64748b] cursor-not-allowed'
                                : row.callStatus === 'pending'
                                ? 'bg-[#2563eb] hover:bg-[#1d4ed8] text-white cursor-pointer'
                                : 'bg-[#eff6ff] hover:bg-[#dbeafe] text-[#2563eb] cursor-pointer'
                            }`}
                          >
                            <PhoneCall className="w-3.5 h-3.5" />
                            <span>
                              {isCallingThis
                                ? 'Calling...'
                                : row.callStatus === 'pending'
                                ? 'Call'
                                : 'Call Again'}
                            </span>
                          </button>

                          {/* View Transcript Button */}
                          {row.transcript && (
                            <button
                              type="button"
                              onClick={() => setActiveTranscriptRow(row)}
                              className="p-1.5 rounded-[8px] border border-[#e2e8f0] text-[#2563eb] hover:bg-[#eff6ff] transition-colors cursor-pointer"
                              title="Read Transcript & Listen to AI Call"
                            >
                              <FileText className="w-4 h-4" />
                            </button>
                          )}

                          {/* Manual Teacher Reason Override */}
                          <button
                            type="button"
                            onClick={() => {
                              setManualOverrideRow(row);
                              setManualReasonText(row.reasonText || '');
                              setManualCategory(
                                row.reasonCategory === 'none' ? 'medical' : row.reasonCategory
                              );
                            }}
                            className="p-1.5 rounded-[8px] border border-[#e2e8f0] text-[#64748b] hover:text-[#0f172a] hover:border-[#2563eb] transition-colors cursor-pointer"
                            title="Manually Type/Override Absence Reason"
                          >
                            <Edit3 className="w-4 h-4" />
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

      {/* Transcript & AI Extraction Viewer Modal */}
      {activeTranscriptRow && (
        <div className="fixed inset-0 z-50 bg-[#0f172a]/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#e2e8f0] rounded-[22px] max-w-2xl w-full p-6 sm:p-7 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-[12px] bg-[#eff6ff] text-[#2563eb] flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#0f172a]">
                    AI Call Transcript & Structured Extraction
                  </h3>
                  <p className="text-xs text-[#64748b]">
                    {activeTranscriptRow.studentName} ({activeTranscriptRow.rollNo}) · Dialed:{' '}
                    <span className="font-mono-num">{activeTranscriptRow.phoneToCall}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
                  setPlayingAudio(false);
                  setActiveTranscriptRow(null);
                }}
                className="p-1.5 text-[#64748b] hover:text-[#0f172a]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* One-Line AI Summary */}
            {activeTranscriptRow.summary && (
              <div className="mb-4 p-3.5 rounded-[12px] bg-[#eff6ff] border border-[#2563eb]/20 text-xs text-[#0f172a]">
                <span className="font-bold text-[#2563eb]">One-Line Summary: </span>
                {activeTranscriptRow.summary}
              </div>
            )}

            {/* Conversation Transcript Box */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-[#0f172a] flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-[#2563eb]" />
                  Recorded Conversation Transcript (
                  {activeTranscriptRow.language === 'hi-IN' ? 'Hindi · hi-IN' : 'English · en-IN'})
                </span>
                <button
                  type="button"
                  disabled={playingAudio}
                  onClick={() => handlePlayVoiceTranscript(activeTranscriptRow)}
                  className="px-3 py-1 rounded-[8px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>{playingAudio ? 'Playing Voice Audio...' : 'Play Call Audio'}</span>
                </button>
              </div>
              <div className="p-4 rounded-[12px] bg-[#f8fafc] border border-[#e2e8f0] text-xs text-[#0f172a] whitespace-pre-line leading-relaxed max-h-56 overflow-y-auto">
                {activeTranscriptRow.transcript}
              </div>
            </div>

            {/* Gemini Structured JSON Extraction */}
            <div className="mb-5">
              <div className="text-xs font-bold text-[#0f172a] mb-1.5">
                Gemini Structured JSON Output:
              </div>
              <pre className="p-3.5 rounded-[12px] bg-[#0f172a] text-[#f8fafc] text-[11px] font-mono-num overflow-x-auto">
                {JSON.stringify(
                  {
                    reasonText: activeTranscriptRow.reasonText,
                    reasonCategory: activeTranscriptRow.reasonCategory,
                    language: activeTranscriptRow.language,
                    consentRecorded: activeTranscriptRow.consentRecorded,
                  },
                  null,
                  2
                )}
              </pre>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[#e2e8f0]">
              {(activeRole === 'hod' || activeRole === 'admin') ? (
                <button
                  type="button"
                  onClick={() => handleDeleteTranscript(activeTranscriptRow)}
                  className="px-3.5 py-2 rounded-[10px] bg-[#fee2e2] hover:bg-[#fecaca] text-[#dc2626] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Transcript (Privacy)</span>
                </button>
              ) : (
                <span className="text-[11px] text-[#64748b]">
                  Only HOD or Admin can delete call transcripts
                </span>
              )}

              <button
                type="button"
                onClick={() => setActiveTranscriptRow(null)}
                className="px-4 py-2 rounded-[10px] border border-[#e2e8f0] text-xs font-semibold text-[#0f172a]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Reason Override Modal */}
      {manualOverrideRow && (
        <div className="fixed inset-0 z-50 bg-[#0f172a]/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#e2e8f0] rounded-[22px] max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-[#0f172a]">
                  Manual Absence Reason Override
                </h3>
                <p className="text-xs text-[#64748b]">
                  {manualOverrideRow.studentName} ({manualOverrideRow.rollNo})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setManualOverrideRow(null)}
                className="p-1 text-[#64748b]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveManualReason} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#0f172a] mb-1">
                  Reason Category
                </label>
                <select
                  value={manualCategory}
                  onChange={(e) => setManualCategory(e.target.value as ReasonCategory)}
                  className="w-full px-3.5 py-2 text-xs border border-[#e2e8f0] rounded-[10px] bg-white"
                >
                  <option value="medical">Medical</option>
                  <option value="family">Family</option>
                  <option value="transport">Transport</option>
                  <option value="personal">Personal</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0f172a] mb-1">
                  Absence Reason Note (Overrides AI Reason)
                </label>
                <textarea
                  rows={3}
                  required
                  value={manualReasonText}
                  onChange={(e) => setManualReasonText(e.target.value)}
                  placeholder="Enter reason communicated by parent or student directly to teacher..."
                  className="w-full p-3 text-xs border border-[#e2e8f0] rounded-[10px] focus:outline-none focus:border-[#2563eb]"
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setManualOverrideRow(null)}
                  className="px-4 py-2 rounded-[10px] border border-[#e2e8f0] text-xs font-medium text-[#64748b]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingManual}
                  className="px-4 py-2 rounded-[10px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-semibold cursor-pointer"
                >
                  {savingManual ? 'Saving...' : 'Save Manual Override'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
