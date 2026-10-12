import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { jobService } from '../../services/jobService';
import { Card, CardHeader, CardTitle, CardDescription } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { ErrorState } from '../ui/ErrorState';
import { EmptyState } from '../ui/EmptyState';
import {
  Briefcase,
  Plus,
  Edit3,
  CheckCircle2,
  XCircle,
  Building2,
  Calendar,
  DollarSign,
  MapPin,
  Clock,
  Layers,
  Search,
  Filter,
  Eye,
  AlertCircle,
  ArrowRight,
  X,
} from 'lucide-react';
import type { Job, JobStatus, EmploymentType, ExperienceLevel, Company, Department } from '../../types';

const CreateJobSchema = z.object({
  title: z.string().min(3, 'Job title must be at least 3 characters').max(255),
  department_id: z.string().min(1, 'Please select a department'),
  location: z.string().min(1, 'Location is required').max(255),
  employment_type: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'REMOTE']),
  experience_level: z.enum(['ENTRY', 'MID', 'SENIOR', 'LEAD', 'EXECUTIVE']),
  salary_min: z.string().optional(),
  salary_max: z.string().optional(),
  deadline_utc: z.string().optional(),
  description: z.string().min(10, 'Job description must be at least 10 characters'),
  requirements: z.string().min(10, 'Requirements must be at least 10 characters'),
});

type CreateJobFormValues = z.infer<typeof CreateJobSchema>;

export function JobManagement() {
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DRAFT' | 'PUBLISHED' | 'CLOSED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [previewJob, setPreviewJob] = useState<Job | null>(null);
  const [isAddDeptModalOpen, setIsAddDeptModalOpen] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // --- QUERIES ---
  const {
    data: company,
    isLoading: isCompanyLoading,
  } = useQuery({
    queryKey: ['recruiter-company'],
    queryFn: jobService.getRecruiterCompany,
  });

  const {
    data: departments = [],
    isLoading: isDeptsLoading,
  } = useQuery({
    queryKey: ['recruiter-departments'],
    queryFn: jobService.getRecruiterDepartments,
  });

  const {
    data: jobs = [],
    isLoading: isJobsLoading,
    error: jobsError,
  } = useQuery({
    queryKey: ['recruiter-jobs', statusFilter],
    queryFn: () => jobService.listRecruiterJobs(statusFilter === 'ALL' ? undefined : statusFilter),
  });

  // --- REACT HOOK FORM FOR CREATE JOB ---
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateJobFormValues>({
    resolver: zodResolver(CreateJobSchema),
    defaultValues: {
      title: '',
      department_id: '',
      location: '',
      employment_type: 'FULL_TIME',
      experience_level: 'MID',
      salary_min: '',
      salary_max: '',
      deadline_utc: '',
      description: '',
      requirements: '',
    },
  });

  // --- MUTATIONS ---
  const createJobMutation = useMutation({
    mutationFn: (values: CreateJobFormValues) => {
      const minVal = values.salary_min ? parseInt(values.salary_min, 10) : null;
      const maxVal = values.salary_max ? parseInt(values.salary_max, 10) : null;
      const deadlineIso = values.deadline_utc ? new Date(values.deadline_utc).toISOString() : null;

      return jobService.createJob({
        title: values.title.trim(),
        department_id: values.department_id,
        location: values.location.trim(),
        employment_type: values.employment_type,
        experience_level: values.experience_level,
        salary_min: minVal,
        salary_max: maxVal,
        deadline_utc: deadlineIso,
        description: values.description.trim(),
        requirements: values.requirements.trim(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recruiter-jobs'] });
      setIsCreateModalOpen(false);
      reset();
      setActionSuccess('Job requisition created in DRAFT state.');
      setActionError(null);
    },
    onError: (err: Error) => {
      setActionError(err.message || 'Failed to create job.');
    },
  });

  const publishJobMutation = useMutation({
    mutationFn: jobService.publishJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recruiter-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['public-jobs'] });
      setActionSuccess('Job successfully published to public discovery.');
      setActionError(null);
    },
    onError: (err: Error) => {
      setActionError(err.message || 'Failed to publish job.');
    },
  });

  const closeJobMutation = useMutation({
    mutationFn: jobService.closeJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recruiter-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['public-jobs'] });
      setActionSuccess('Job position closed.');
      setActionError(null);
    },
    onError: (err: Error) => {
      setActionError(err.message || 'Failed to close job.');
    },
  });

  const createDeptMutation = useMutation({
    mutationFn: jobService.createDepartment,
    onSuccess: (newDept) => {
      queryClient.invalidateQueries({ queryKey: ['recruiter-departments'] });
      setIsAddDeptModalOpen(false);
      setNewDeptName('');
      setActionSuccess(`Department "${newDept.name}" added successfully.`);
    },
    onError: (err: Error) => {
      setActionError(err.message || 'Failed to add department.');
    },
  });

  const setupCompanyMutation = useMutation({
    mutationFn: jobService.setupCompany,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recruiter-company'] });
      queryClient.invalidateQueries({ queryKey: ['recruiter-departments'] });
      queryClient.invalidateQueries({ queryKey: ['recruiter-jobs'] });
      setActionSuccess('Organization profile initialized successfully.');
    },
    onError: (err: Error) => {
      setActionError(err.message || 'Failed to initialize organization.');
    },
  });

  // Filter jobs by client-side text search if query typed
  const filteredJobs = jobs.filter((j) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      j.title.toLowerCase().includes(q) ||
      j.location.toLowerCase().includes(q) ||
      (j.department_name && j.department_name.toLowerCase().includes(q))
    );
  });

  // --- RENDER HELPERS ---
  const getStatusBadge = (status: JobStatus) => {
    switch (status) {
      case 'DRAFT':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-2xs font-semibold rounded-md bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Draft
          </span>
        );
      case 'PUBLISHED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-2xs font-semibold rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Published
          </span>
        );
      case 'CLOSED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-2xs font-semibold rounded-md bg-slate-100 text-slate-700 border border-slate-300">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
            Closed
          </span>
        );
    }
  };

  const formatEmploymentType = (type: EmploymentType) => {
    return type.replace('_', ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const formatExperienceLevel = (level: ExperienceLevel) => {
    return level.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  };

  // If company is not initialized
  if (!isCompanyLoading && !company) {
    return (
      <Card className="p-8 max-w-xl mx-auto text-center space-y-4">
        <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center mx-auto border border-blue-100">
          <Building2 className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">Initialize Your Recruitment Organization</h2>
          <p className="text-xs text-slate-500 mt-1">
            To manage recruitment jobs, link an organization profile to your recruiter account.
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.target as HTMLFormElement;
            const name = (form.elements.namedItem('companyName') as HTMLInputElement).value;
            const location = (form.elements.namedItem('companyLocation') as HTMLInputElement).value;
            const industry = (form.elements.namedItem('companyIndustry') as HTMLInputElement).value;
            setupCompanyMutation.mutate({ name, location, industry });
          }}
          className="space-y-3 text-left pt-2"
        >
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Company Name *</label>
            <Input name="companyName" required placeholder="e.g. Acme Enterprise Solutions" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Industry</label>
              <Input name="companyIndustry" defaultValue="Technology" placeholder="e.g. Technology" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">HQ Location</label>
              <Input name="companyLocation" defaultValue="San Francisco, CA" placeholder="City, State" />
            </div>
          </div>
          <Button
            type="submit"
            disabled={setupCompanyMutation.isPending}
            className="w-full mt-2 cursor-pointer"
          >
            {setupCompanyMutation.isPending ? 'Setting up...' : 'Set Up Organization & Start'}
          </Button>
        </form>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Action Messages */}
      {actionSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button type="button" onClick={() => setActionSuccess(null)} className="text-emerald-700 hover:text-emerald-900">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {actionError && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button type="button" onClick={() => setActionError(null)} className="text-rose-700 hover:text-rose-900">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Header Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Job Requisitions</h1>
            <span className="text-2xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              {company?.name}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Create, save drafts, publish open positions, and manage lifecycle. Real database persistence.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsAddDeptModalOpen(true)}
            className="cursor-pointer gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Department
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setActionError(null);
              setActionSuccess(null);
              setIsCreateModalOpen(true);
            }}
            className="cursor-pointer gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="w-4 h-4" />
            Create Job
          </Button>
        </div>
      </div>

      {/* Status Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200">
        <div className="flex gap-1">
          {(['ALL', 'DRAFT', 'PUBLISHED', 'CLOSED'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                statusFilter === st
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {st === 'ALL' ? 'All Jobs' : st.charAt(0) + st.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title or location..."
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Jobs List */}
      {isJobsLoading ? (
        <LoadingSpinner label="Loading organizational jobs..." />
      ) : jobsError ? (
        <ErrorState title="Failed to load jobs" error={jobsError} />
      ) : filteredJobs.length === 0 ? (
        <EmptyState
          title={
            statusFilter === 'ALL'
              ? 'No job requisitions created yet'
              : `No ${statusFilter.toLowerCase()} jobs found`
          }
          description="Start building your recruitment pipeline by creating a job requisition."
          action={
            <Button
              size="sm"
              onClick={() => setIsCreateModalOpen(true)}
              className="cursor-pointer gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="w-3.5 h-3.5" />
              Create Job
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {filteredJobs.map((job) => (
            <div
              key={job.id}
              className="bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-300 transition-colors shadow-2xs"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h3 className="text-sm font-bold text-slate-900">{job.title}</h3>
                    {getStatusBadge(job.status)}
                    <span className="text-2xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                      {job.department_name || 'General'}
                    </span>
                    <span className="text-2xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                      {formatEmploymentType(job.employment_type)}
                    </span>
                    <span className="text-2xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                      {formatExperienceLevel(job.experience_level)}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      {job.location}
                    </span>
                    {(job.salary_min !== null || job.salary_max !== null) && (
                      <span className="flex items-center gap-1 text-slate-700 font-medium">
                        <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                        {job.salary_min !== null && job.salary_max !== null
                          ? `$${job.salary_min.toLocaleString()} – $${job.salary_max.toLocaleString()}`
                          : job.salary_min !== null
                          ? `From $${job.salary_min.toLocaleString()}`
                          : `Up to $${job.salary_max?.toLocaleString()}`}
                      </span>
                    )}
                    {job.deadline_utc && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        Deadline: {new Date(job.deadline_utc).toLocaleDateString()}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-slate-400">
                      <Clock className="w-3.5 h-3.5" />
                      Created {new Date(job.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Lifecycle Action Buttons */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setPreviewJob(job)}
                    className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                    title="View details"
                  >
                    <Eye className="w-4 h-4" />
                  </button>

                  {job.status === 'DRAFT' && (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingJob(job)}
                        className="cursor-pointer gap-1 text-xs"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        Edit Draft
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={publishJobMutation.isPending}
                        onClick={() => publishJobMutation.mutate(job.id)}
                        className="cursor-pointer gap-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Publish
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={closeJobMutation.isPending}
                        onClick={() => {
                          if (confirm('Are you sure you want to close this draft job?')) {
                            closeJobMutation.mutate(job.id);
                          }
                        }}
                        className="cursor-pointer text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                      >
                        Close
                      </Button>
                    </>
                  )}

                  {job.status === 'PUBLISHED' && (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingJob(job)}
                        className="cursor-pointer gap-1 text-xs"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={closeJobMutation.isPending}
                        onClick={() => {
                          if (confirm('Are you sure you want to close this published job? Candidates will no longer be able to apply.')) {
                            closeJobMutation.mutate(job.id);
                          }
                        }}
                        className="cursor-pointer text-xs text-slate-700 hover:text-rose-700 hover:border-rose-300"
                      >
                        Close Position
                      </Button>
                    </>
                  )}

                  {job.status === 'CLOSED' && (
                    <span className="text-2xs text-slate-400 font-medium italic px-2 py-1">
                      Archived
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* --- CREATE JOB MODAL --- */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Create Job Requisition</h3>
                <p className="text-xs text-slate-500">
                  New postings are saved as DRAFT. Complete required fields to publish.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit((values) => createJobMutation.mutate(values))} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Job Title *
                </label>
                <Input
                  {...register('title')}
                  placeholder="e.g. Senior Full-Stack Engineer"
                  error={errors.title?.message}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700">Department *</label>
                    <button
                      type="button"
                      onClick={() => setIsAddDeptModalOpen(true)}
                      className="text-2xs font-semibold text-blue-600 hover:underline cursor-pointer"
                    >
                      + Add New
                    </button>
                  </div>
                  <select
                    {...register('department_id')}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Select Department</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                  {errors.department_id && (
                    <p className="text-2xs text-rose-600 mt-1">{errors.department_id.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Location *</label>
                  <Input
                    {...register('location')}
                    placeholder="e.g. Remote or San Francisco, CA"
                    error={errors.location?.message}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Employment Type *</label>
                  <select
                    {...register('employment_type')}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="FULL_TIME">Full Time</option>
                    <option value="PART_TIME">Part Time</option>
                    <option value="CONTRACT">Contract</option>
                    <option value="INTERNSHIP">Internship</option>
                    <option value="REMOTE">Remote</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Experience Level *</label>
                  <select
                    {...register('experience_level')}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="ENTRY">Entry Level</option>
                    <option value="MID">Mid Level</option>
                    <option value="SENIOR">Senior Level</option>
                    <option value="LEAD">Lead / Staff</option>
                    <option value="EXECUTIVE">Executive</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Salary Min (USD)</label>
                  <Input
                    type="number"
                    {...register('salary_min')}
                    placeholder="e.g. 120000"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Salary Max (USD)</label>
                  <Input
                    type="number"
                    {...register('salary_max')}
                    placeholder="e.g. 160000"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Application Deadline</label>
                  <Input
                    type="datetime-local"
                    {...register('deadline_utc')}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Job Description * (min 10 characters)
                </label>
                <textarea
                  {...register('description')}
                  rows={4}
                  placeholder="Detail the mission, day-to-day responsibilities, and team culture..."
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {errors.description && (
                  <p className="text-2xs text-rose-600 mt-1">{errors.description.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Requirements & Qualifications * (min 10 characters)
                </label>
                <textarea
                  {...register('requirements')}
                  rows={3}
                  placeholder="List essential technical skills, years of experience, and degrees..."
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {errors.requirements && (
                  <p className="text-2xs text-rose-600 mt-1">{errors.requirements.message}</p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || createJobMutation.isPending}
                  className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {createJobMutation.isPending ? 'Saving...' : 'Save as Draft'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- EDIT JOB MODAL --- */}
      {editingJob && (
        <EditJobModal
          job={editingJob}
          departments={departments}
          onClose={() => setEditingJob(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['recruiter-jobs'] });
            setEditingJob(null);
            setActionSuccess('Job updated successfully.');
          }}
        />
      )}

      {/* --- PREVIEW JOB MODAL --- */}
      {previewJob && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-2xs font-semibold text-slate-400 uppercase tracking-wider">
                  Requisition Preview ({previewJob.status})
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5">{previewJob.title}</h3>
                <p className="text-xs text-slate-500">
                  {previewJob.company_name} · {previewJob.department_name} · {previewJob.location}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewJob(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs text-slate-700">
              <div className="flex flex-wrap gap-2 text-2xs font-semibold">
                <span className="px-2 py-1 rounded bg-slate-100 text-slate-700">
                  Type: {formatEmploymentType(previewJob.employment_type)}
                </span>
                <span className="px-2 py-1 rounded bg-slate-100 text-slate-700">
                  Level: {formatExperienceLevel(previewJob.experience_level)}
                </span>
                {(previewJob.salary_min !== null || previewJob.salary_max !== null) && (
                  <span className="px-2 py-1 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                    Salary: ${previewJob.salary_min?.toLocaleString()} - ${previewJob.salary_max?.toLocaleString()}
                  </span>
                )}
                {previewJob.deadline_utc && (
                  <span className="px-2 py-1 rounded bg-amber-50 text-amber-800 border border-amber-200">
                    Deadline: {new Date(previewJob.deadline_utc).toLocaleString()}
                  </span>
                )}
              </div>

              <div>
                <h4 className="font-bold text-slate-900 mb-1">Description</h4>
                <p className="whitespace-pre-line leading-relaxed text-slate-600">{previewJob.description}</p>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 mb-1">Requirements</h4>
                <p className="whitespace-pre-line leading-relaxed text-slate-600">{previewJob.requirements}</p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <Button type="button" onClick={() => setPreviewJob(null)} className="cursor-pointer">
                Close Preview
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* --- ADD DEPARTMENT MODAL --- */}
      {isAddDeptModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-5 shadow-xl space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Add Department</h3>
              <p className="text-xs text-slate-500 mt-0.5">Create a department in {company?.name}.</p>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (newDeptName.trim()) {
                  createDeptMutation.mutate(newDeptName.trim());
                }
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Department Name *</label>
                <Input
                  value={newDeptName}
                  onChange={(e) => setNewDeptName(e.target.value)}
                  placeholder="e.g. Product Design"
                  required
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddDeptModalOpen(false)}
                  className="cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={createDeptMutation.isPending || !newDeptName.trim()}
                  className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {createDeptMutation.isPending ? 'Saving...' : 'Add Department'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

interface EditJobModalProps {
  job: Job;
  departments: Department[];
  onClose: () => void;
  onSuccess: () => void;
}

function EditJobModal({ job, departments, onClose, onSuccess }: EditJobModalProps) {
  const [title, setTitle] = useState(job.title);
  const [departmentId, setDepartmentId] = useState(job.department_id);
  const [location, setLocation] = useState(job.location);
  const [employmentType, setEmploymentType] = useState<EmploymentType>(job.employment_type);
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>(job.experience_level);
  const [salaryMin, setSalaryMin] = useState(job.salary_min !== null ? String(job.salary_min) : '');
  const [salaryMax, setSalaryMax] = useState(job.salary_max !== null ? String(job.salary_max) : '');
  const [deadlineUtc, setDeadlineUtc] = useState(
    job.deadline_utc ? job.deadline_utc.substring(0, 16) : ''
  );
  const [description, setDescription] = useState(job.description);
  const [requirements, setRequirements] = useState(job.requirements);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isDraft = job.status === 'DRAFT';

  const updateMutation = useMutation({
    mutationFn: (data: any) => jobService.updateJob(job.id, data),
    onSuccess,
    onError: (err: Error) => {
      setErrorMsg(err.message || 'Failed to update job.');
    },
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const deadlineIso = deadlineUtc ? new Date(deadlineUtc).toISOString() : null;

    updateMutation.mutate({
      title: isDraft ? title.trim() : undefined,
      department_id: isDraft ? departmentId : undefined,
      location: location.trim(),
      employment_type: isDraft ? employmentType : undefined,
      experience_level: isDraft ? experienceLevel : undefined,
      salary_min: salaryMin ? parseInt(salaryMin, 10) : null,
      salary_max: salaryMax ? parseInt(salaryMax, 10) : null,
      deadline_utc: deadlineIso,
      description: description.trim(),
      requirements: requirements.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl space-y-4 my-8">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <span className="text-2xs font-semibold text-slate-500 uppercase">
              Editing ({job.status})
            </span>
            <h3 className="text-base font-bold text-slate-900 mt-0.5">Edit Job: {job.title}</h3>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          {isDraft ? (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Job Title *</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">
                Job Title (Locked on Published Position)
              </label>
              <Input value={title} disabled className="bg-slate-50 text-slate-500" />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                disabled={!isDraft}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white disabled:bg-slate-50 disabled:text-slate-500 focus:outline-none"
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Location *</label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} required />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Salary Min</label>
              <Input
                type="number"
                value={salaryMin}
                onChange={(e) => setSalaryMin(e.target.value)}
                placeholder="100000"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Salary Max</label>
              <Input
                type="number"
                value={salaryMax}
                onChange={(e) => setSalaryMax(e.target.value)}
                placeholder="150000"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Deadline</label>
              <Input
                type="datetime-local"
                value={deadlineUtc}
                onChange={(e) => setDeadlineUtc(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Description *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              required
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Requirements *</label>
            <textarea
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              rows={3}
              required
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={onClose} className="cursor-pointer">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={updateMutation.isPending}
              className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white"
            >
              {updateMutation.isPending ? 'Updating...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
