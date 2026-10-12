import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { aiService, type InterviewQuestionItem } from '../../services/aiService';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import {
  Sparkles,
  X,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  HelpCircle,
  ShieldCheck,
  Target,
  CheckCircle2,
  ListChecks,
} from 'lucide-react';

interface AiInterviewQuestionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string;
  jobTitle: string;
  interviewId?: string;
  candidateName?: string;
}

export function AiInterviewQuestionsModal({
  isOpen,
  onClose,
  jobId,
  jobTitle,
  interviewId,
  candidateName,
}: AiInterviewQuestionsModalProps) {
  const [category, setCategory] = useState<'ALL' | 'TECHNICAL' | 'BEHAVIORAL' | 'DOMAIN' | 'SITUATIONAL'>('ALL');
  const [count, setCount] = useState<number>(5);
  const [questions, setQuestions] = useState<InterviewQuestionItem[]>([]);
  const [summary, setSummary] = useState<string>('');
  const [expandedRubrics, setExpandedRubrics] = useState<Record<number, boolean>>({});
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const generateMutation = useMutation({
    mutationFn: () =>
      aiService.generateInterviewQuestions({
        jobId,
        interviewId,
        category,
        count,
      }),
    onSuccess: (data) => {
      setQuestions(data.data.questions);
      setSummary(data.data.summary);
      // Expand first rubric by default
      setExpandedRubrics({ 0: true });
    },
  });

  if (!isOpen) return null;

  const toggleRubric = (index: number) => {
    setExpandedRubrics((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const handleCopyQuestion = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'TECHNICAL':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'BEHAVIORAL':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'DOMAIN':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'SITUATIONAL':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col my-8">
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-200 flex items-start justify-between bg-gradient-to-r from-purple-50/50 to-white rounded-t-2xl">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-purple-600 text-white rounded-lg">
                <Sparkles className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                AI Interview Question Intelligence
              </h2>
            </div>
            <p className="text-xs text-slate-600">
              Grounded evaluation rubric tailored to requisition:{' '}
              <span className="font-semibold text-slate-800">{jobTitle}</span>
              {candidateName && (
                <>
                  {' · '}
                  Candidate:{' '}
                  <span className="font-semibold text-purple-700">{candidateName}</span>
                </>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Configuration Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Controls bar */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Evaluation Focus Category
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {(['ALL', 'TECHNICAL', 'BEHAVIORAL', 'DOMAIN', 'SITUATIONAL'] as const).map(
                    (cat) => (
                      <button
                        key={cat}
                        onClick={() => setCategory(cat)}
                        className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-all ${
                          category === cat
                            ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {cat}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Question Quantity
                </label>
                <div className="flex gap-1.5">
                  {[3, 5, 8].map((qCount) => (
                    <button
                      key={qCount}
                      onClick={() => setCount(qCount)}
                      className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-all ${
                        count === qCount
                          ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {qCount} Questions
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-end">
                <Button
                  onClick={() => generateMutation.mutate()}
                  disabled={generateMutation.isPending}
                  className="bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-2 text-xs py-2 px-4 shadow-xs"
                >
                  <Sparkles className="w-4 h-4" />
                  {generateMutation.isPending
                    ? 'Synthesizing Questions...'
                    : questions.length > 0
                    ? 'Regenerate Questions'
                    : 'Generate Questions'}
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-slate-500 pt-1 border-t border-slate-200/60">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>
                Questions are synthesized strictly from published job requirements and candidate confirmed competencies. Zero protected-class profiling.
              </span>
            </div>
          </div>

          {/* Error Message */}
          {generateMutation.isError && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-rose-700 text-xs">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Question Generation Failed</p>
                <p className="mt-0.5">
                  {(generateMutation.error as any)?.message ||
                    'AI evaluation assistant is temporarily unavailable. Please conduct interview using standard rubric.'}
                </p>
              </div>
            </div>
          )}

          {/* Generated Questions List */}
          {questions.length > 0 && (
            <div className="space-y-4">
              {summary && (
                <div className="p-3 bg-purple-50/70 border border-purple-100 rounded-lg text-xs text-purple-900">
                  <span className="font-bold">Evaluation Focus: </span>
                  {summary}
                </div>
              )}

              <div className="space-y-4">
                {questions.map((q, idx) => (
                  <Card key={idx} className="p-5 border-slate-200 shadow-2xs space-y-3">
                    {/* Header info */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="w-6 h-6 rounded-md bg-slate-900 text-white text-xs font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold border ${getCategoryColor(
                            q.category
                          )}`}
                        >
                          {q.category}
                        </span>
                        <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                          <Target className="w-3.5 h-3.5 text-slate-400" />
                          Competency: {q.competency}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopyQuestion(q.question, idx)}
                        className="text-xs text-slate-500 hover:text-slate-900 flex items-center gap-1 h-8 px-2"
                        title="Copy question text"
                      >
                        {copiedIndex === idx ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-600 font-semibold">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy</span>
                          </>
                        )}
                      </Button>
                    </div>

                    {/* Question text */}
                    <p className="text-sm font-semibold text-slate-900 leading-relaxed bg-slate-50 p-3.5 rounded-lg border border-slate-100">
                      "{q.question}"
                    </p>

                    {/* Rationale */}
                    <div className="text-xs text-slate-600">
                      <span className="font-semibold text-slate-700">Requisition Alignment: </span>
                      {q.rationale}
                    </div>

                    {/* Expected Signals */}
                    {q.expectedSignals && q.expectedSignals.length > 0 && (
                      <div className="space-y-1 text-xs">
                        <span className="font-semibold text-slate-700 flex items-center gap-1">
                          <ListChecks className="w-3.5 h-3.5 text-purple-600" />
                          Expected Positive Signals:
                        </span>
                        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pl-2 pt-0.5">
                          {q.expectedSignals.map((sig, sIdx) => (
                            <li key={sIdx} className="flex items-start gap-1.5 text-slate-600">
                              <span className="text-purple-500 font-bold">•</span>
                              <span>{sig}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Evaluation Rubric Accordion */}
                    <div className="border-t border-slate-100 pt-2">
                      <button
                        onClick={() => toggleRubric(idx)}
                        className="w-full flex items-center justify-between text-xs font-semibold text-slate-600 hover:text-slate-900 py-1"
                      >
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          3-Tier Candidate Evaluation Rubric
                        </span>
                        {expandedRubrics[idx] ? (
                          <ChevronUp className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        )}
                      </button>

                      {expandedRubrics[idx] && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2 pt-1 text-xs">
                          <div className="p-2.5 bg-rose-50/70 border border-rose-200/60 rounded-lg">
                            <span className="font-bold text-rose-700 block mb-1">
                              Inadequate (1-2 pts)
                            </span>
                            <p className="text-slate-700 leading-normal text-[11px]">
                              {q.evaluationRubric.poor}
                            </p>
                          </div>
                          <div className="p-2.5 bg-slate-100/70 border border-slate-200 rounded-lg">
                            <span className="font-bold text-slate-700 block mb-1">
                              Acceptable (3 pts)
                            </span>
                            <p className="text-slate-700 leading-normal text-[11px]">
                              {q.evaluationRubric.acceptable}
                            </p>
                          </div>
                          <div className="p-2.5 bg-emerald-50/70 border border-emerald-200/60 rounded-lg">
                            <span className="font-bold text-emerald-700 block mb-1">
                              Exceptional (4-5 pts)
                            </span>
                            <p className="text-slate-700 leading-normal text-[11px]">
                              {q.evaluationRubric.excellent}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Probing Follow-Ups */}
                    {q.probingFollowUps && q.probingFollowUps.length > 0 && (
                      <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-[11px] text-slate-600">
                        <span className="font-semibold text-slate-700 block mb-1">
                          Probing Follow-Ups:
                        </span>
                        <ul className="space-y-0.5 pl-2">
                          {q.probingFollowUps.map((p, pIdx) => (
                            <li key={pIdx} className="flex items-start gap-1.5">
                              <span className="text-slate-400 font-bold">›</span>
                              <span>"{p}"</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Initial Empty State */}
          {questions.length === 0 && !generateMutation.isPending && (
            <div className="p-12 text-center border-2 border-dashed border-slate-200 rounded-xl space-y-3">
              <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto">
                <HelpCircle className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">
                Ready to Generate Interview Questions
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Select an evaluation category and quantity above, then click "Generate Questions" to synthesize objective, competency-grounded evaluation questions for this interview.
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            {questions.length > 0 ? `${questions.length} questions prepared` : 'No questions generated yet'}
          </span>
          <Button variant="secondary" size="sm" onClick={onClose} className="text-xs">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
