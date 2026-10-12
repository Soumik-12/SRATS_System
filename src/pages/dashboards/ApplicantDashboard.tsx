import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthContext';
import { applicantService } from '../../services/applicantService';
import { Card, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorState } from '../../components/ui/ErrorState';
import { EmptyState } from '../../components/ui/EmptyState';
import {
  User,
  ShieldCheck,
  FileText,
  Upload,
  Download,
  Trash2,
  Plus,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  Calendar,
  Sparkles,
  ExternalLink,
  Award,
  Layers,
  Archive,
  Search,
  Video,
  MapPin,
  Clock,
  RotateCcw,
  Ban,
} from 'lucide-react';
import type { SkillLevel, ResumeMetadata } from '../../types';
import { JobDiscovery } from '../../components/applicant/JobDiscovery';
import { MyApplications } from '../../components/applicant/MyApplications';
import { interviewService } from '../../services/interviewService';
import { analyticsService } from '../../services/analyticsService';
import { ResumeAnalysisModal } from '../../components/applicant/ResumeAnalysisModal';

export function ApplicantDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<
    'overview' | 'profile' | 'skills' | 'resumes' | 'find_jobs' | 'my_applications' | 'my_interviews'
  >('overview');

  const [analyzingResume, setAnalyzingResume] = useState<ResumeMetadata | null>(null);

  // --- QUERY HOOKS ---
  const {
    data: profile,
    isLoading: isProfileLoading,
    error: profileError,
  } = useQuery({
    queryKey: ['applicant-profile'],
    queryFn: applicantService.getProfile,
  });

  const {
    data: skills = [],
    isLoading: isSkillsLoading,
    error: skillsError,
  } = useQuery({
    queryKey: ['applicant-skills'],
    queryFn: applicantService.getSkills,
  });

  const {
    data: resumes = [],
    isLoading: isResumesLoading,
    error: resumesError,
  } = useQuery({
    queryKey: ['applicant-resumes'],
    queryFn: applicantService.listResumes,
  });

  const {
    data: applicantInterviews = [],
    isLoading: isInterviewsLoading,
  } = useQuery({
    queryKey: ['applicant-interviews'],
    queryFn: interviewService.listInterviews,
    enabled: activeTab === 'my_interviews',
  });

  const {
    data: analytics,
    isLoading: isAnalyticsLoading,
  } = useQuery({
    queryKey: ['applicant-analytics'],
    queryFn: analyticsService.getApplicantAnalytics,
  });

  // --- PROFILE FORM STATE ---
  const [headline, setHeadline] = useState('');
  const [summary, setSummary] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [website, setWebsite] = useState('');
  const [profileSuccessMsg, setProfileSuccessMsg] = useState<string | null>(null);
  const [profileErrorMsg, setProfileErrorMsg] = useState<string | null>(null);

  // Sync profile form when profile data loads
  React.useEffect(() => {
    if (profile) {
      setHeadline(profile.headline || '');
      setSummary(profile.summary || '');
      setPhone(profile.phone || '');
      setLocation(profile.location || '');
      setWebsite(profile.website || '');
    }
  }, [profile]);

  // --- SKILLS STATE ---
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillLevel, setNewSkillLevel] = useState<SkillLevel>('INTERMEDIATE');
  const [skillErrorMsg, setSkillErrorMsg] = useState<string | null>(null);

  // --- RESUME UPLOAD STATE ---
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadErrorMsg, setUploadErrorMsg] = useState<string | null>(null);
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState<string | null>(null);
  const [isDownloadingId, setIsDownloadingId] = useState<string | null>(null);

  // --- MUTATIONS ---
  const updateProfileMutation = useMutation({
    mutationFn: applicantService.updateProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applicant-profile'] });
      setProfileSuccessMsg('Profile information updated successfully.');
      setProfileErrorMsg(null);
    },
    onError: (err: Error) => {
      setProfileErrorMsg(err.message || 'Failed to update profile.');
      setProfileSuccessMsg(null);
    },
  });

  const addSkillMutation = useMutation({
    mutationFn: applicantService.addSkill,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applicant-skills'] });
      queryClient.invalidateQueries({ queryKey: ['applicant-profile'] });
      setNewSkillName('');
      setSkillErrorMsg(null);
    },
    onError: (err: Error) => {
      setSkillErrorMsg(err.message || 'Failed to add skill.');
    },
  });

  const removeSkillMutation = useMutation({
    mutationFn: applicantService.removeSkill,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applicant-skills'] });
      queryClient.invalidateQueries({ queryKey: ['applicant-profile'] });
    },
  });

  const uploadResumeMutation = useMutation({
    mutationFn: applicantService.uploadResume,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applicant-resumes'] });
      queryClient.invalidateQueries({ queryKey: ['applicant-profile'] });
      setSelectedFile(null);
      setUploadSuccessMsg('Resume uploaded and set as active primary version.');
      setUploadErrorMsg(null);
    },
    onError: (err: Error) => {
      setUploadErrorMsg(err.message || 'Resume upload failed.');
      setUploadSuccessMsg(null);
    },
  });

  const deleteResumeMutation = useMutation({
    mutationFn: applicantService.deleteResume,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applicant-resumes'] });
      queryClient.invalidateQueries({ queryKey: ['applicant-profile'] });
    },
  });

  // --- HANDLERS ---
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSuccessMsg(null);
    setProfileErrorMsg(null);
    updateProfileMutation.mutate({
      headline,
      summary,
      phone,
      location,
      website: website || null,
    });
  };

  const handleAddSkill = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSkillName.trim()) return;
    setSkillErrorMsg(null);
    addSkillMutation.mutate({
      skill_name: newSkillName.trim(),
      level: newSkillLevel,
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadErrorMsg(null);
    setUploadSuccessMsg(null);
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      if (!['.pdf', '.doc', '.docx'].includes(ext)) {
        setUploadErrorMsg('Only PDF, DOC, or DOCX files are permitted.');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setUploadErrorMsg('File exceeds maximum size limit of 5 MB.');
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUploadResume = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;
    setUploadErrorMsg(null);
    setUploadSuccessMsg(null);
    uploadResumeMutation.mutate(selectedFile);
  };

  const handleDownloadResume = async (resume: ResumeMetadata) => {
    try {
      setIsDownloadingId(resume.id);
      const { blob, fileName } = await applicantService.downloadResume(resume.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to download resume file.');
    } finally {
      setIsDownloadingId(null);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const primaryResume = resumes.find((r) => r.isPrimary && r.isActive);

  if (isProfileLoading && !profile) {
    return <LoadingSpinner label="Loading applicant workspace..." />;
  }

  if (profileError) {
    return <ErrorState title="Failed to load applicant profile" error={profileError} />;
  }

  const completeness = profile?.completeness || { percentage: 0, missingFields: [] };

  return (
    <div className="space-y-6">
      {/* Top Identity Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 shrink-0">
            <User className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Welcome, {user?.firstName} {user?.lastName}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Applicant Portal · Authenticated Identity · {user?.email}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
            <ShieldCheck className="w-4 h-4" />
            Active Candidate
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-1 bg-slate-100/60 p-1 rounded-xl">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-colors cursor-pointer text-center ${
            activeTab === 'overview'
              ? 'bg-white text-indigo-700 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Overview & Readiness
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-colors cursor-pointer text-center ${
            activeTab === 'profile'
              ? 'bg-white text-indigo-700 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Profile Details
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('skills')}
          className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-colors cursor-pointer text-center ${
            activeTab === 'skills'
              ? 'bg-white text-indigo-700 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Skills ({skills.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('resumes')}
          className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-colors cursor-pointer text-center ${
            activeTab === 'resumes'
              ? 'bg-white text-indigo-700 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Resumes ({resumes.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('find_jobs')}
          className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-colors cursor-pointer text-center ${
            activeTab === 'find_jobs'
              ? 'bg-white text-indigo-700 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Find Jobs
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('my_applications')}
          className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-colors cursor-pointer text-center ${
            activeTab === 'my_applications'
              ? 'bg-white text-indigo-700 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          My Applications
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('my_interviews')}
          className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-colors cursor-pointer text-center ${
            activeTab === 'my_interviews'
              ? 'bg-white text-indigo-700 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          My Interviews
        </button>
      </div>

      {/* --- TAB 1: OVERVIEW --- */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Key Database-Derived Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-5 border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Applications
                </span>
                <div className="p-2 bg-indigo-50 text-indigo-700 rounded-lg">
                  <Briefcase className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-black text-slate-900 mt-2 font-mono">
                {analytics?.metrics.totalApplications ?? 0}
              </p>
              <div className="mt-2 text-[11px] text-slate-500 flex flex-wrap gap-1.5">
                <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-medium">
                  {analytics?.metrics.appliedCount ?? 0} Applied
                </span>
                <span className="bg-amber-50 px-1.5 py-0.5 rounded text-amber-700 font-medium">
                  {analytics?.metrics.shortlistedCount ?? 0} Shortlisted
                </span>
                <span className="bg-emerald-50 px-1.5 py-0.5 rounded text-emerald-700 font-medium">
                  {analytics?.metrics.selectedCount ?? 0} Selected
                </span>
              </div>
            </Card>

            <Card className="p-5 border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Upcoming Interviews
                </span>
                <div className="p-2 bg-blue-50 text-blue-700 rounded-lg">
                  <Calendar className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-black text-slate-900 mt-2 font-mono">
                {analytics?.metrics.upcomingInterviewsCount ?? 0}
              </p>
              <p className="mt-2 text-[11px] text-slate-500">
                {(analytics?.metrics.upcomingInterviewsCount ?? 0) > 0 ? (
                  <button
                    type="button"
                    onClick={() => setActiveTab('my_interviews')}
                    className="text-blue-600 hover:text-blue-800 font-medium inline-flex items-center gap-1"
                  >
                    View schedule details &rarr;
                  </button>
                ) : (
                  'No upcoming interviews scheduled'
                )}
              </p>
            </Card>

            <Card className="p-5 border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Readiness Score
                </span>
                <div className="p-2 bg-emerald-50 text-emerald-700 rounded-lg">
                  <Award className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-black text-slate-900 mt-2 font-mono">
                {analytics?.metrics.profileCompletenessPercent ?? completeness.percentage}%
              </p>
              <p className="mt-2 text-[11px] text-slate-500">
                {primaryResume ? 'Primary resume active' : 'Resume upload required'}
              </p>
            </Card>

            <Card className="p-5 border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Unread Alerts
                </span>
                <div className="p-2 bg-purple-50 text-purple-700 rounded-lg">
                  <AlertCircle className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-black text-slate-900 mt-2 font-mono">
                {analytics?.metrics.unreadNotificationsCount ?? 0}
              </p>
              <p className="mt-2 text-[11px] text-slate-500">
                Real domain notifications
              </p>
            </Card>
          </div>

          {/* Profile Completeness Score Card */}
          <Card className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Profile Completeness Rating
                </p>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                  {completeness.percentage}% Ready for Applications
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Calculated deterministically from persisted database fields (Headline, Summary, Contact, Skills, Resume).
                </p>
              </div>
              <div className="text-right">
                <span className="text-3xl font-extrabold text-indigo-600 font-mono">
                  {completeness.percentage}%
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden mb-4">
              <div
                className="bg-indigo-600 h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${completeness.percentage}%` }}
              />
            </div>

            {completeness.missingFields.length > 0 ? (
              <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Recommended to complete:</span>{' '}
                  {completeness.missingFields.join(' · ')}
                </div>
              </div>
            ) : (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>All profile prerequisites satisfied! Ready to apply for upcoming job positions.</span>
              </div>
            )}
          </Card>

          {/* Current Active Resume Card */}
          <Card className="p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Current Primary Resume</h3>
                  <p className="text-xs text-slate-500">The resume that will be submitted with job applications</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveTab('resumes')}
              >
                Manage Resumes
              </Button>
            </div>

            {primaryResume ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg border border-slate-200 text-indigo-600">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">{primaryResume.fileName}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {formatFileSize(primaryResume.fileSize)} · Uploaded on{' '}
                      {new Date(primaryResume.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                    onClick={() => setAnalyzingResume(primaryResume)}
                  >
                    <Sparkles className="w-3.5 h-3.5 mr-1 text-indigo-600" />
                    Analyze with AI
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadResume(primaryResume)}
                    isLoading={isDownloadingId === primaryResume.id}
                  >
                    <Download className="w-3.5 h-3.5 mr-1" />
                    Download File
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setActiveTab('resumes')}
                  >
                    Replace Resume
                  </Button>
                </div>
              </div>
            ) : (
              <EmptyState
                title="No active resume uploaded yet"
                description="Upload your professional resume in PDF, DOC, or DOCX format to complete your profile."
                action={
                  <Button variant="primary" size="sm" onClick={() => setActiveTab('resumes')}>
                    <Upload className="w-3.5 h-3.5 mr-1.5" />
                    Upload Resume
                  </Button>
                }
              />
            )}
          </Card>

          {/* Truthful Scope Boundary Cards (Zero fake data) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-slate-100 text-slate-600">
                  <Briefcase className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900">Job Applications</h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                No active applications. Universal Job discovery and multi-stage applicant tracking pipeline will be established in Phase 5 & Phase 6.
              </p>
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-slate-100 text-slate-600">
                  <Calendar className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900">Interview Schedules</h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                No interviews scheduled. Live interviewer assignment, UTC coordination, and scoring feedback will be activated in Phase 8.
              </p>
            </Card>
          </div>
        </div>
      )}

      {/* --- TAB 2: EDIT PROFILE --- */}
      {activeTab === 'profile' && (
        <Card className="p-6">
          <CardHeader className="p-0 pb-5 mb-5 border-b border-slate-100">
            <CardTitle>Applicant Profile Details</CardTitle>
            <CardDescription>
              Provide real background information. All data is securely persisted to your authenticated applicant account.
            </CardDescription>
          </CardHeader>

          {profileSuccessMsg && (
            <div className="mb-5 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{profileSuccessMsg}</span>
            </div>
          )}

          {profileErrorMsg && (
            <div className="mb-5 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{profileErrorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="First Name"
                disabled
                value={user?.firstName || ''}
                helperText="Identity established at registration"
              />
              <Input
                label="Last Name"
                disabled
                value={user?.lastName || ''}
                helperText="Identity established at registration"
              />
            </div>

            <Input
              label="Professional Headline"
              placeholder="e.g. Senior Software Architect · Distributed Systems"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              helperText="Brief summary of your professional expertise (max 255 chars)"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Contact Phone"
                placeholder="+1 (555) 012-3456"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <Input
                label="Current Location"
                placeholder="City, State / Country"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>

            <Input
              label="Personal Website / Portfolio URL"
              placeholder="https://yourportfolio.example"
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              helperText="Must be a valid HTTP or HTTPS URL"
            />

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Executive Professional Summary
              </label>
              <textarea
                rows={5}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                placeholder="Summarize your professional accomplishments, technical competencies, and career goals..."
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                maxLength={4000}
              />
              <p className="text-[11px] text-slate-500 mt-1">
                {summary.length} / 4000 characters
              </p>
            </div>

            <div className="pt-4 flex justify-end">
              <Button
                type="submit"
                variant="primary"
                isLoading={updateProfileMutation.isPending}
              >
                Save Profile Changes
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* --- TAB 3: SKILLS INVENTORY --- */}
      {activeTab === 'skills' && (
        <div className="space-y-6">
          <Card className="p-6">
            <CardHeader className="p-0 pb-4 mb-4 border-b border-slate-100">
              <CardTitle>Add Technical & Professional Skill</CardTitle>
              <CardDescription>
                Record your verified competencies. Duplicate entries are automatically rejected.
              </CardDescription>
            </CardHeader>

            {skillErrorMsg && (
              <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{skillErrorMsg}</span>
              </div>
            )}

            <form onSubmit={handleAddSkill} className="flex flex-col sm:flex-row items-end gap-3">
              <div className="flex-1 w-full">
                <Input
                  label="Skill Name"
                  placeholder="e.g. TypeScript, React, PostgreSQL, Docker"
                  value={newSkillName}
                  onChange={(e) => setNewSkillName(e.target.value)}
                  required
                />
              </div>

              <div className="w-full sm:w-48">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Proficiency Level
                </label>
                <select
                  value={newSkillLevel}
                  onChange={(e) => setNewSkillLevel(e.target.value as SkillLevel)}
                  className="w-full h-10 px-3 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                >
                  <option value="BEGINNER">Beginner</option>
                  <option value="INTERMEDIATE">Intermediate</option>
                  <option value="EXPERT">Expert</option>
                </select>
              </div>

              <Button
                type="submit"
                variant="primary"
                className="h-10 shrink-0 w-full sm:w-auto"
                isLoading={addSkillMutation.isPending}
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Skill
              </Button>
            </form>
          </Card>

          {/* Current Skills Grid */}
          <Card className="p-6">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">
              Your Recorded Skills ({skills.length})
            </h3>

            {isSkillsLoading ? (
              <LoadingSpinner label="Loading skills..." />
            ) : skills.length === 0 ? (
              <EmptyState
                title="No skills recorded yet"
                description="Add your core competencies using the form above."
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {skills.map((skill) => (
                  <div
                    key={skill.id}
                    className="p-3 rounded-lg border border-slate-200 bg-slate-50/60 flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{skill.skill_name}</p>
                      <span
                        className={`inline-block text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded mt-1 ${
                          skill.level === 'EXPERT'
                            ? 'bg-purple-100 text-purple-800'
                            : skill.level === 'INTERMEDIATE'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-slate-200 text-slate-800'
                        }`}
                      >
                        {skill.level}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeSkillMutation.mutate(skill.id)}
                      className="text-slate-400 hover:text-rose-600 h-8 w-8 p-0"
                      title="Remove Skill"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* --- TAB 4: RESUME MANAGEMENT --- */}
      {activeTab === 'resumes' && (
        <div className="space-y-6">
          {/* Upload Zone */}
          <Card className="p-6">
            <CardHeader className="p-0 pb-4 mb-4 border-b border-slate-100">
              <CardTitle>Upload / Replace Resume Document</CardTitle>
              <CardDescription>
                Accepted formats: PDF, DOC, DOCX up to 5 MB. Uploading a new resume automatically sets it as your primary active version while preserving historical copies.
              </CardDescription>
            </CardHeader>

            {uploadSuccessMsg && (
              <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{uploadSuccessMsg}</span>
              </div>
            )}

            {uploadErrorMsg && (
              <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{uploadErrorMsg}</span>
              </div>
            )}

            <form onSubmit={handleUploadResume} className="space-y-4">
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:border-indigo-400 transition-colors bg-slate-50/40">
                <Upload className="w-8 h-8 text-indigo-600 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-900">
                  Select a resume file to upload
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  PDF, DOC, or DOCX (Maximum file size: 5 MB)
                </p>
                <div className="mt-4">
                  <input
                    type="file"
                    id="resume-file-input"
                    className="hidden"
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={handleFileChange}
                  />
                  <label htmlFor="resume-file-input">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => document.getElementById('resume-file-input')?.click()}
                    >
                      Browse Files
                    </Button>
                  </label>
                </div>
                {selectedFile && (
                  <div className="mt-3 p-2 bg-indigo-50 border border-indigo-200 rounded-lg inline-block text-xs text-indigo-900 font-mono">
                    Selected: <strong>{selectedFile.name}</strong> ({formatFileSize(selectedFile.size)})
                  </div>
                )}
              </div>

              {selectedFile && (
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    variant="primary"
                    isLoading={uploadResumeMutation.isPending}
                  >
                    <Upload className="w-3.5 h-3.5 mr-1.5" />
                    Confirm & Upload Resume
                  </Button>
                </div>
              )}
            </form>
          </Card>

          {/* Resumes Inventory Table */}
          <Card className="p-6">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">
              Uploaded Resume History ({resumes.length})
            </h3>

            {isResumesLoading ? (
              <LoadingSpinner label="Loading resumes..." />
            ) : resumes.length === 0 ? (
              <EmptyState
                title="No resume uploaded yet"
                description="Upload your primary resume above to complete your candidate application file."
              />
            ) : (
              <div className="divide-y divide-slate-100">
                {resumes.map((r) => (
                  <div
                    key={r.id}
                    className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-slate-100 text-slate-600 shrink-0 mt-0.5">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-900">{r.fileName}</h4>
                          {r.isPrimary && r.isActive ? (
                            <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                              Primary Active
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold uppercase tracking-wider bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                              Archived Version
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          {formatFileSize(r.fileSize)} · Uploaded on{' '}
                          {new Date(r.createdAt).toLocaleDateString()} at{' '}
                          {new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      {r.isActive && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                          onClick={() => setAnalyzingResume(r)}
                        >
                          <Sparkles className="w-3.5 h-3.5 mr-1 text-indigo-600" />
                          Analyze with AI
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadResume(r)}
                        isLoading={isDownloadingId === r.id}
                      >
                        <Download className="w-3.5 h-3.5 mr-1" />
                        Download
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteResumeMutation.mutate(r.id)}
                        className="text-slate-400 hover:text-rose-600"
                        title="Archive Resume"
                      >
                        <Archive className="w-3.5 h-3.5 mr-1" />
                        Archive
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* --- TAB 5: FIND JOBS (PHASE 5 REAL JOB DISCOVERY) --- */}
      {activeTab === 'find_jobs' && <JobDiscovery />}

      {/* --- TAB: MY APPLICATIONS (PHASE 6 REAL APPLICATION PIPELINE) --- */}
      {activeTab === 'my_applications' && (
        <MyApplications onFindJobsClick={() => setActiveTab('find_jobs')} />
      )}

      {/* --- TAB 6: MY INTERVIEWS (PHASE 8 REAL INTERVIEW SCHEDULE) --- */}
      {activeTab === 'my_interviews' && (
        <div className="space-y-6">
          <Card className="p-6">
            <CardHeader className="p-0 pb-4">
              <CardTitle className="text-base font-bold text-slate-900">
                Scheduled Interviews
              </CardTitle>
              <CardDescription>
                Confirmed evaluation interviews for your submitted applications. Dates and times are displayed in your local timezone.
              </CardDescription>
            </CardHeader>

            {isInterviewsLoading ? (
              <div className="py-12 flex justify-center">
                <LoadingSpinner size="md" />
              </div>
            ) : applicantInterviews.length === 0 ? (
              <EmptyState
                icon={<Calendar className="w-6 h-6" />}
                title="No interviews scheduled"
                description="You do not have any interviews scheduled at this time. Once an employer reviews your application and schedules an interview, it will appear here."
              />
            ) : (
              <div className="space-y-4 pt-2">
                {applicantInterviews.map((item) => (
                  <div
                    key={item.id}
                    className="p-5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-colors space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {item.status === 'SCHEDULED' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                            <Calendar className="w-3 h-3" /> Scheduled
                          </span>
                        )}
                        {item.status === 'RESCHEDULED' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                            <RotateCcw className="w-3 h-3" /> Rescheduled
                          </span>
                        )}
                        {item.status === 'COMPLETED' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" /> Completed
                          </span>
                        )}
                        {item.status === 'CANCELLED' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 border border-slate-300">
                            <Ban className="w-3 h-3" /> Cancelled
                          </span>
                        )}
                        <h4 className="text-sm font-bold text-slate-900">{item.job_title}</h4>
                      </div>
                      <span className="text-xs text-slate-500 font-medium">
                        {item.company_name} · {item.department_name}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-slate-600 flex-wrap">
                      <span className="flex items-center gap-1.5 font-medium text-slate-800">
                        <Clock className="w-3.5 h-3.5 text-blue-600" />
                        {new Date(item.scheduled_at_utc).toLocaleString()} ({item.duration_minutes} min)
                      </span>
                      <span className="text-[11px] text-slate-400">
                        UTC: {new Date(item.scheduled_at_utc).toISOString()}
                      </span>
                      <span className="text-slate-400">|</span>
                      <span className="text-slate-700">
                        Interviewer: <strong className="font-semibold">{item.interviewer_name}</strong>
                      </span>
                    </div>

                    <div className="pt-1">
                      {item.interview_type === 'ONLINE' ? (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="inline-flex items-center gap-1.5 text-blue-700 font-medium bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100">
                            <Video className="w-3.5 h-3.5" />
                            Online Video Meeting:
                            {item.location_url ? (
                              <a
                                href={item.location_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline flex items-center gap-1 hover:text-blue-900 font-semibold"
                              >
                                Join Meeting <ExternalLink className="w-3 h-3" />
                              </a>
                            ) : (
                              'Meeting link will be provided prior to call'
                            )}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="inline-flex items-center gap-1.5 text-emerald-700 font-medium bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100">
                            <MapPin className="w-3.5 h-3.5" />
                            Location: {item.location_url || 'On-site'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {analyzingResume && (
        <ResumeAnalysisModal
          resume={analyzingResume}
          isOpen={Boolean(analyzingResume)}
          onClose={() => setAnalyzingResume(null)}
          onProfileUpdated={() => {
            queryClient.invalidateQueries({ queryKey: ['applicant-profile'] });
            queryClient.invalidateQueries({ queryKey: ['applicant-skills'] });
            queryClient.invalidateQueries({ queryKey: ['applicant-resumes'] });
          }}
        />
      )}
    </div>
  );
}
