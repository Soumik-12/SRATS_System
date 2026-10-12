import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  X,
  FileText,
  Briefcase,
  GraduationCap,
  Award,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import {
  aiService,
  type ResumeAnalysisResult,
  type ExtractedSkill,
} from '../../services/aiService';
import type { ResumeMetadata } from '../../types';

interface ResumeAnalysisModalProps {
  resume: ResumeMetadata;
  isOpen: boolean;
  onClose: () => void;
  onProfileUpdated: () => void;
}

export const ResumeAnalysisModal: React.FC<ResumeAnalysisModalProps> = ({
  resume,
  isOpen,
  onClose,
  onProfileUpdated,
}) => {
  const [consentChecked, setConsentChecked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [analysis, setAnalysis] = useState<ResumeAnalysisResult | null>(null);

  // Editable fields for human-in-the-loop candidate confirmation
  const [editedHeadline, setEditedHeadline] = useState('');
  const [editedSummary, setEditedSummary] = useState('');
  const [selectedSkillsMap, setSelectedSkillsMap] = useState<Record<string, boolean>>({});

  // Active review sub-tab
  const [activeTab, setActiveTab] = useState<'skills' | 'experience' | 'education' | 'grounding'>('skills');

  // Load existing analysis if available when modal opens
  useEffect(() => {
    if (isOpen && resume) {
      setErrorMsg(null);
      setSuccessMsg(null);
      setIsLoading(true);
      aiService
        .getResumeAnalysis(resume.id)
        .then((existing) => {
          if (existing) {
            setAnalysis(existing);
            initEditableFields(existing);
            setConsentChecked(true);
          } else {
            setAnalysis(null);
            setConsentChecked(false);
          }
        })
        .catch(() => {
          setAnalysis(null);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [isOpen, resume]);

  const initEditableFields = (res: ResumeAnalysisResult) => {
    setEditedHeadline(res.extracted.headline || '');
    setEditedSummary(res.extracted.summary || '');
    const map: Record<string, boolean> = {};
    res.extracted.skills.forEach((s) => {
      map[s.skillName] = true; // default all selected
    });
    setSelectedSkillsMap(map);
  };

  const handleStartAnalysis = async () => {
    if (!consentChecked) {
      setErrorMsg('You must provide explicit consent before your resume can be processed with Google Gemini.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await aiService.analyzeResume(resume.id, true);
      setAnalysis(res);
      initEditableFields(res);
    } catch (err: any) {
      setErrorMsg(
        err.message || 'AI assistance is temporarily unavailable. You can continue using SRATS normally.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleSkill = (skillName: string) => {
    setSelectedSkillsMap((prev) => ({
      ...prev,
      [skillName]: !prev[skillName],
    }));
  };

  const handleConfirmAndApply = async () => {
    if (!analysis) return;

    setIsConfirming(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const skillsToApply = analysis.extracted.skills
        .filter((s) => selectedSkillsMap[s.skillName])
        .map((s) => ({
          skill_name: s.skillName,
          level: s.level,
        }));

      const res = await aiService.confirmResumeAnalysis({
        resumeId: resume.id,
        analysisId: analysis.analysisId,
        headline: editedHeadline.trim() || undefined,
        summary: editedSummary.trim() || undefined,
        selectedSkills: skillsToApply,
      });

      setSuccessMsg(
        `Profile successfully updated! ${res.addedSkillsCount} skills imported to your candidate inventory.`
      );
      onProfileUpdated();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update profile from analysis.');
    } finally {
      setIsConfirming(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                AI-Powered Resume Analysis
              </h2>
              <p className="text-xs text-slate-500">
                Target Document: <span className="font-medium text-slate-700">{resume.fileName}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMsg && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">Analysis Request Notice</p>
                <p className="mt-0.5">{errorMsg}</p>
              </div>
            </div>
          )}

          {successMsg && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">Candidate Profile Updated</p>
                <p className="mt-0.5">{successMsg}</p>
              </div>
            </div>
          )}

          {/* STATE 1: Consent & Disclosures (Prior to analysis) */}
          {!analysis && !isLoading && (
            <div className="space-y-6">
              <div className="p-5 rounded-xl border border-indigo-100 bg-indigo-50/40 space-y-3">
                <div className="flex items-center gap-2 text-indigo-900 font-semibold text-sm">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  <span>Privacy, Security & Grounding Disclosure</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  SRATS uses Google Gemini strictly as an intelligence layer to extract structured skills, work history, and educational milestones from your uploaded document.
                </p>
                <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside">
                  <li><strong>Human-in-the-Loop:</strong> AI will never silently alter your profile or make hiring/rejection decisions.</li>
                  <li><strong>Data Minimization:</strong> Only text within this resume is processed; private account credentials and contact secrets are omitted.</li>
                  <li><strong>Candidate Control:</strong> You will review, edit, and choose which extracted skills and summaries to apply.</li>
                </ul>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex items-start gap-3">
                <input
                  type="checkbox"
                  id="consent-checkbox"
                  checked={consentChecked}
                  onChange={(e) => setConsentChecked(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded-sm border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="consent-checkbox" className="text-xs text-slate-700 leading-relaxed cursor-pointer select-none">
                  <span className="font-semibold text-slate-900">I grant explicit consent</span> to process this resume document with Google Gemini for candidate profile extraction and skills discovery.
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" size="sm" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={!consentChecked}
                  onClick={handleStartAnalysis}
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                  Start AI Resume Analysis
                </Button>
              </div>
            </div>
          )}

          {/* STATE 2: Loading State */}
          {isLoading && (
            <div className="py-16 text-center">
              <LoadingSpinner label="Extracting skills and experience with Gemini..." />
              <p className="text-xs text-slate-500 mt-3">
                Grounding facts against document text and formatting structured schema...
              </p>
            </div>
          )}

          {/* STATE 3: Analysis Results Review & Human-in-the-Loop Confirmation */}
          {analysis && !isLoading && (
            <div className="space-y-6">
              {/* Top Meta Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-800">Model:</span>
                  <span className="font-mono text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                    {analysis.modelUsed}
                  </span>
                  <span className="font-semibold text-slate-800 ml-2">Confidence:</span>
                  <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {Math.round(analysis.extracted.overallConfidenceScore * 100)}%
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {analysis.injectionDetected ? (
                    <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      Suspicious Patterns Isolated
                    </span>
                  ) : (
                    <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" />
                      Passive Document Verified
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-slate-500 hover:text-indigo-600"
                    onClick={handleStartAnalysis}
                  >
                    <RefreshCw className="w-3 h-3 mr-1" />
                    Re-Analyze
                  </Button>
                </div>
              </div>

              {/* Editable Profile Overview */}
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Extracted Headline (Editable)
                </label>
                <input
                  type="text"
                  value={editedHeadline}
                  onChange={(e) => setEditedHeadline(e.target.value)}
                  className="w-full h-9 px-3 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  placeholder="e.g. Senior Software Engineer"
                />

                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mt-3">
                  Extracted Summary (Editable)
                </label>
                <textarea
                  rows={3}
                  value={editedSummary}
                  onChange={(e) => setEditedSummary(e.target.value)}
                  className="w-full p-3 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  placeholder="Professional background overview..."
                />
              </div>

              {/* Navigation Tabs */}
              <div className="flex border-b border-slate-200 gap-6 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setActiveTab('skills')}
                  className={`pb-2.5 transition-colors border-b-2 flex items-center gap-1.5 ${
                    activeTab === 'skills'
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Award className="w-3.5 h-3.5" />
                  Skills ({analysis.extracted.skills.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('experience')}
                  className={`pb-2.5 transition-colors border-b-2 flex items-center gap-1.5 ${
                    activeTab === 'experience'
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Briefcase className="w-3.5 h-3.5" />
                  Experience ({analysis.extracted.experience.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('education')}
                  className={`pb-2.5 transition-colors border-b-2 flex items-center gap-1.5 ${
                    activeTab === 'education'
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <GraduationCap className="w-3.5 h-3.5" />
                  Education ({analysis.extracted.education.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('grounding')}
                  className={`pb-2.5 transition-colors border-b-2 flex items-center gap-1.5 ${
                    activeTab === 'grounding'
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Grounding & Evidence
                </button>
              </div>

              {/* Sub-tab 1: Skills Review */}
              {activeTab === 'skills' && (
                <div className="space-y-3">
                  <p className="text-xs text-slate-500">
                    Select the skills you want to commit to your candidate profile inventory:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-1">
                    {analysis.extracted.skills.map((skill) => (
                      <div
                        key={skill.skillName}
                        onClick={() => handleToggleSkill(skill.skillName)}
                        className={`p-3 rounded-xl border text-xs cursor-pointer transition-colors flex items-start gap-2.5 ${
                          selectedSkillsMap[skill.skillName]
                            ? 'border-indigo-300 bg-indigo-50/50'
                            : 'border-slate-200 bg-white opacity-60'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(selectedSkillsMap[skill.skillName])}
                          onChange={() => handleToggleSkill(skill.skillName)}
                          className="mt-0.5 h-4 w-4 rounded-sm border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-semibold text-slate-900 truncate">
                              {skill.skillName}
                            </span>
                            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                              {skill.level}
                            </span>
                          </div>
                          {skill.evidenceQuote && (
                            <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 italic">
                              "{skill.evidenceQuote}"
                            </p>
                          )}
                          <div className="mt-1 flex items-center gap-2 text-[10px]">
                            {skill.isDirectFact ? (
                              <span className="text-emerald-700 font-medium">Direct Citation</span>
                            ) : (
                              <span className="text-slate-400 font-medium">Context Inference</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sub-tab 2: Experience */}
              {activeTab === 'experience' && (
                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                  {analysis.extracted.experience.map((exp, idx) => (
                    <div key={idx} className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900">{exp.role}</span>
                        <span className="text-[11px] text-slate-500">{exp.duration}</span>
                      </div>
                      <p className="text-xs text-indigo-600 font-medium">{exp.company}</p>
                      {exp.highlights && exp.highlights.length > 0 && (
                        <ul className="text-[11px] text-slate-600 list-disc list-inside space-y-0.5 pt-1">
                          {exp.highlights.map((h, hIdx) => (
                            <li key={hIdx}>{h}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Sub-tab 3: Education */}
              {activeTab === 'education' && (
                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                  {analysis.extracted.education.map((edu, idx) => (
                    <div key={idx} className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900">{edu.institution}</span>
                        <span className="text-[11px] text-slate-500">{edu.year}</span>
                      </div>
                      <p className="text-xs text-slate-700">{edu.degree} {edu.fieldOfStudy ? `in ${edu.fieldOfStudy}` : ''}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Sub-tab 4: Grounding */}
              {activeTab === 'grounding' && (
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3 text-xs">
                  <div className="flex items-center gap-2 text-slate-900 font-bold">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Evidence-Grounded Intelligence Invariants</span>
                  </div>
                  <p className="text-slate-600 leading-relaxed">
                    {analysis.extracted.confidenceExplanation}
                  </p>
                  <div className="grid grid-cols-2 gap-3 pt-2 text-[11px]">
                    <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                      <span className="text-slate-500 block">Prompt Architecture:</span>
                      <span className="font-mono font-medium text-slate-800">{analysis.promptVersion}</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                      <span className="text-slate-500 block">Consent Timestamp:</span>
                      <span className="font-mono font-medium text-slate-800">
                        {new Date(analysis.consentTimestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Bar */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <Button variant="outline" size="sm" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  isLoading={isConfirming}
                  onClick={handleConfirmAndApply}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                  Confirm & Apply Selected to Profile
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
