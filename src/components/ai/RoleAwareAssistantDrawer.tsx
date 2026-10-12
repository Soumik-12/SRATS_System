import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { aiService } from '../../services/aiService';
import { Button } from '../ui/Button';
import {
  Bot,
  X,
  Send,
  Sparkles,
  Database,
  ShieldAlert,
  RotateCcw,
  User,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  toolCalls?: Array<{ tool: string; args: any; result: any }>;
  modelUsed?: string;
}

export function RoleAwareAssistantDrawer() {
  const { user, isAuthenticated } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  if (!isAuthenticated || !user) {
    return null;
  }

  const roleMeta: Record<
    string,
    { title: string; subtitle: string; starters: string[]; badgeColor: string }
  > = {
    APPLICANT: {
      title: 'Candidate Career Assistant',
      subtitle: 'Answers grounded in your verified applications and interviews',
      badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      starters: [
        'What is the status of my job applications?',
        'Do I have any upcoming interviews scheduled?',
        'Review my confirmed skills and profile summary',
      ],
    },
    RECRUITER: {
      title: 'Recruitment Pipeline Assistant',
      subtitle: 'Queries grounded in your organization’s jobs and candidates',
      badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
      starters: [
        'Summarize our current recruitment pipeline',
        'Show active job requisitions and candidate counts',
        'What interviews are scheduled for this requisition?',
      ],
    },
    INTERVIEWER: {
      title: 'Evaluator Assessment Assistant',
      subtitle: 'Answers grounded in your assigned candidate interviews',
      badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
      starters: [
        'What interviews are currently assigned to me?',
        'Which candidate evaluations are pending feedback?',
      ],
    },
    HR_MANAGER: {
      title: 'HR Organizational Assistant',
      subtitle: 'Queries grounded in company hiring metrics and departments',
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      starters: [
        'Summarize organization-wide pipeline health',
        'What are our active requisitions by department?',
      ],
    },
    ADMIN: {
      title: 'Platform Governance Assistant',
      subtitle: 'Queries grounded in system metrics and audit telemetry',
      badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
      starters: [
        'Summarize platform health and governance metrics',
        'Show total registered users and active organizations',
      ],
    },
  };

  const meta = roleMeta[user.role] || {
    title: 'SRATS Workplace Assistant',
    subtitle: 'Grounded platform intelligence',
    badgeColor: 'bg-slate-50 text-slate-700 border-slate-200',
    starters: ['What can you help me with?'],
  };

  const handleSend = async (messageText?: string) => {
    const textToSend = messageText || input;
    if (!textToSend.trim() || isLoading) return;

    const userMsg: Message = {
      id: `msg-${Date.now()}-u`,
      sender: 'user',
      text: textToSend.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!messageText) setInput('');
    setIsLoading(true);

    try {
      const res = await aiService.chatWithAssistant({
        message: textToSend.trim(),
        conversationId,
      });

      if (res.conversationId) {
        setConversationId(res.conversationId);
      }

      const assistantMsg: Message = {
        id: `msg-${Date.now()}-a`,
        sender: 'assistant',
        text: res.response,
        timestamp: new Date(),
        toolCalls: res.toolCallsExecuted,
        modelUsed: res.modelUsed,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: Message = {
        id: `msg-${Date.now()}-e`,
        sender: 'assistant',
        text:
          err.message ||
          'AI assistance is temporarily unavailable. You can continue using SRATS workflows normally.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setMessages([]);
    setConversationId(undefined);
  };

  return (
    <>
      {/* Floating Assistant Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-xl shadow-xl border border-slate-700 hover:scale-[1.02] active:scale-[0.98] transition-all text-xs font-semibold cursor-pointer"
        aria-label="Open AI Assistant"
      >
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-purple-500"></span>
        </span>
        <Bot className="w-4 h-4 text-purple-300" />
        <span className="hidden sm:inline">AI Assistant ({user.role})</span>
      </button>

      {/* Slide-Over Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-2xs flex justify-end">
          <div className="relative w-full max-w-lg bg-white shadow-2xl flex flex-col h-full border-l border-slate-200">
            {/* Drawer Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-slate-900">{meta.title}</h2>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded border ${meta.badgeColor}`}
                    >
                      {user.role}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">{meta.subtitle}</p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleReset}
                    className="text-slate-400 hover:text-slate-700 h-8 w-8 p-0"
                    title="Clear conversation"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsOpen(false)}
                  className="text-slate-400 hover:text-slate-700 h-8 w-8 p-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Grounding Invariant Banner */}
            <div className="px-4 py-2 bg-purple-50/70 border-b border-purple-100 flex items-center gap-2 text-[11px] text-purple-900">
              <Database className="w-3.5 h-3.5 text-purple-600 shrink-0" />
              <span>Grounded in database facts via authorized tool calls. Zero secret leakage.</span>
            </div>

            {/* Conversation Flow */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4 text-slate-500">
                  <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-slate-900">
                      Welcome to your Role-Aware Assistant
                    </h3>
                    <p className="text-xs text-slate-500 max-w-xs">
                      Ask questions about your authenticated data, workflows, and platform status.
                    </p>
                  </div>

                  {/* Suggested Starters */}
                  <div className="w-full space-y-2 pt-2 text-left">
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Suggested Queries
                    </p>
                    {meta.starters.map((starter, sIdx) => (
                      <button
                        key={sIdx}
                        onClick={() => handleSend(starter)}
                        className="w-full text-left p-2.5 rounded-lg border border-slate-200 bg-white hover:bg-purple-50 hover:border-purple-200 text-xs text-slate-700 font-medium transition-colors shadow-2xs"
                      >
                        "{starter}"
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex flex-col ${
                      m.sender === 'user' ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl p-3.5 text-xs ${
                        m.sender === 'user'
                          ? 'bg-slate-900 text-white rounded-br-2xs'
                          : 'bg-slate-100 text-slate-800 rounded-bl-2xs border border-slate-200/70'
                      }`}
                    >
                      <div className="whitespace-pre-line leading-relaxed">{m.text}</div>

                      {/* Tool Calls Grounding Indicator */}
                      {m.toolCalls && m.toolCalls.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-slate-200/60 text-[10px] text-slate-500 flex items-center gap-1.5 flex-wrap">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span className="font-semibold text-slate-700">Verified Database Fact:</span>
                          {m.toolCalls.map((tc, tIdx) => (
                            <span
                              key={tIdx}
                              className="bg-white border border-slate-200 px-1.5 py-0.5 rounded font-mono text-[10px]"
                            >
                              {tc.tool}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 px-1">
                      {m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))
              )}

              {isLoading && (
                <div className="flex items-start gap-2">
                  <div className="bg-slate-100 border border-slate-200/70 rounded-2xl rounded-bl-2xs p-3.5 text-xs text-slate-600 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-600 animate-pulse"></span>
                    <span>Consulting verified database tools...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Footer */}
            <div className="p-3 sm:p-4 border-t border-slate-200 bg-white">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={`Ask ${meta.title}...`}
                  disabled={isLoading}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all disabled:opacity-50"
                />
                <Button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="bg-purple-600 hover:bg-purple-700 text-white h-9.5 w-9.5 p-0 rounded-xl flex items-center justify-center shrink-0 shadow-xs"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
