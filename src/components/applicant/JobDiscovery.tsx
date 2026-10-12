import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthContext';
import { jobService } from '../../services/jobService';
import { applicationService } from '../../services/applicationService';
import { ApplyJobModal } from './ApplyJobModal';
import { Card, CardHeader, CardTitle, CardDescription } from '../ui/Card';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { ErrorState } from '../ui/ErrorState';
import { EmptyState } from '../ui/EmptyState';
import {
  Briefcase,
  Search,
  Filter,
  MapPin,
  Calendar,
  DollarSign,
  Building2,
  Clock,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  X,
  ExternalLink,
  Sparkles,
  Info,
  CheckCircle2,
  Send,
} from 'lucide-react';
import type { PublicJob, EmploymentType, ExperienceLevel } from '../../types';
import { JobRecommendations } from './JobRecommendations';

export function JobDiscovery() {
  const { user } = useAuth();
  const [discoveryMode, setDiscoveryMode] = useState<'all' | 'recommended'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedLevel, setSelectedLevel] = useState<string>('');
  const [locationFilter, setLocationFilter] = useState('');
  const [submittedLocation, setSubmittedLocation] = useState('');
  const [sortOrder, setSortOrder] = useState<string>('newest');
  const [page, setPage] = useState<number>(0);
  const [pageSize] = useState<number>(10);

  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [applyModalJob, setApplyModalJob] = useState<PublicJob | null>(null);

  const { data: myApplications = [] } = useQuery({
    queryKey: ['my-applications'],
    queryFn: applicationService.listMyApplications,
    enabled: user?.role === 'APPLICANT',
  });

  const appliedJobIds = new Set(myApplications.map((app) => app.job_id));

  // --- QUERY HOOK ---
  const {
    data: paginatedData,
    isLoading,
    error,
    isFetching,
  } = useQuery({
    queryKey: [
      'public-jobs',
      submittedSearch,
      submittedLocation,
      selectedType,
      selectedLevel,
      sortOrder,
      page,
      pageSize,
    ],
    queryFn: () =>
      jobService.searchPublicJobs({
        query: submittedSearch || undefined,
        location: submittedLocation || undefined,
        employment_type: selectedType || undefined,
        experience_level: selectedLevel || undefined,
        sort: sortOrder,
        page,
        size: pageSize,
      }),
  });

  // Query for single job details when modal opens
  const {
    data: jobDetail,
    isLoading: isDetailLoading,
    error: detailError,
  } = useQuery({
    queryKey: ['public-job-detail', selectedJobId],
    queryFn: () => (selectedJobId ? jobService.getPublicJob(selectedJobId) : Promise.reject('No ID')),
    enabled: Boolean(selectedJobId),
  });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittedSearch(searchTerm.trim());
    setSubmittedLocation(locationFilter.trim());
    setPage(0);
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setSubmittedSearch('');
    setLocationFilter('');
    setSubmittedLocation('');
    setSelectedType('');
    setSelectedLevel('');
    setSortOrder('newest');
    setPage(0);
  };

  const hasActiveFilters = Boolean(
    submittedSearch || submittedLocation || selectedType || selectedLevel || sortOrder !== 'newest'
  );

  const formatEmploymentType = (type: EmploymentType) => {
    return type.replace('_', ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const formatExperienceLevel = (level: ExperienceLevel) => {
    return level.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const isDeadlinePassed = (deadlineUtc: string | null) => {
    if (!deadlineUtc) return false;
    return new Date(deadlineUtc).getTime() <= Date.now();
  };

  const totalElements = paginatedData?.totalElements || 0;
  const totalPages = paginatedData?.totalPages || 0;
  const jobsList = paginatedData?.content || [];

  return (
    <div className="space-y-6">
      {/* Discovery Mode Tabs (Preserves Distinct Pathways: Recommended vs Find All) */}
      <div className="flex border-b border-slate-200 gap-1 bg-slate-100/60 p-1 rounded-xl">
        <button
          type="button"
          onClick={() => setDiscoveryMode('all')}
          className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-colors cursor-pointer text-center ${
            discoveryMode === 'all'
              ? 'bg-white text-indigo-700 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Find All Jobs ({totalElements})
        </button>
        <button
          type="button"
          onClick={() => setDiscoveryMode('recommended')}
          className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-colors cursor-pointer text-center flex items-center justify-center gap-1.5 ${
            discoveryMode === 'recommended'
              ? 'bg-white text-indigo-700 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
          Recommended Jobs (AI Match)
        </button>
      </div>

      {discoveryMode === 'recommended' ? (
        <JobRecommendations
          onSwitchToAllJobs={() => setDiscoveryMode('all')}
          onOpenJobDetail={(id) => setSelectedJobId(id)}
        />
      ) : (
        <>
          {/* Top Banner */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">Public Job Discovery</h1>
                <span className="text-2xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Live Postings Only
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Browse real verified job positions from registered hiring organizations. Server-backed search & filters.
              </p>
            </div>

            <div className="text-right text-xs text-slate-500">
              <span className="font-semibold text-slate-900">{totalElements}</span> active recruitment positions
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
            <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Keyword Search */}
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by title, skills, or company..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Location Search */}
          <div className="md:col-span-4 relative">
            <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              placeholder="City, State, or Remote..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="md:col-span-3 flex gap-2">
            <Button type="submit" size="sm" className="flex-1 cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white text-xs">
              Search Jobs
            </Button>
            {hasActiveFilters && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleResetFilters}
                className="cursor-pointer text-xs"
              >
                Reset
              </Button>
            )}
          </div>
        </form>

        {/* Filter Controls Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-2xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <Filter className="w-3 h-3" /> Filters:
            </span>

            {/* Employment Type */}
            <select
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value);
                setPage(0);
              }}
              className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none cursor-pointer"
            >
              <option value="">All Employment Types</option>
              <option value="FULL_TIME">Full Time</option>
              <option value="PART_TIME">Part Time</option>
              <option value="CONTRACT">Contract</option>
              <option value="INTERNSHIP">Internship</option>
              <option value="REMOTE">Remote</option>
            </select>

            {/* Experience Level */}
            <select
              value={selectedLevel}
              onChange={(e) => {
                setSelectedLevel(e.target.value);
                setPage(0);
              }}
              className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none cursor-pointer"
            >
              <option value="">All Experience Levels</option>
              <option value="ENTRY">Entry Level</option>
              <option value="MID">Mid Level</option>
              <option value="SENIOR">Senior Level</option>
              <option value="LEAD">Lead / Staff</option>
              <option value="EXECUTIVE">Executive</option>
            </select>
          </div>

          {/* Sort Control */}
          <div className="flex items-center gap-2">
            <span className="text-2xs text-slate-400 font-medium">Sort by:</span>
            <select
              value={sortOrder}
              onChange={(e) => {
                setSortOrder(e.target.value);
                setPage(0);
              }}
              className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white font-medium text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="newest">Newest First</option>
              <option value="deadline">Application Deadline</option>
              <option value="title">Job Title (A-Z)</option>
              <option value="salary_desc">Highest Salary</option>
            </select>
          </div>
        </div>
      </div>

      {/* Jobs Listing */}
      {isLoading ? (
        <LoadingSpinner label="Fetching published recruitment opportunities..." />
      ) : error ? (
        <ErrorState title="Failed to search jobs" error={error} />
      ) : jobsList.length === 0 ? (
        <EmptyState
          title={
            hasActiveFilters
              ? 'No published jobs match your search criteria'
              : 'No published jobs are currently available'
          }
          description={
            hasActiveFilters
              ? 'Try widening your search terms or clearing your filters.'
              : 'Recruiters have not published any open job requisitions yet. Check back soon.'
          }
          action={
            hasActiveFilters ? (
              <Button size="sm" variant="outline" onClick={handleResetFilters} className="cursor-pointer text-xs">
                Clear Filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3">
            {jobsList.map((job) => {
              const expired = isDeadlinePassed(job.deadline_utc);

              return (
                <div
                  key={job.id}
                  className="bg-white border border-slate-200 rounded-xl p-5 hover:border-indigo-300 transition-all shadow-2xs flex flex-col justify-between gap-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                          {job.title}
                        </h2>
                        <div className="flex items-center gap-2 text-xs text-slate-600 mt-0.5">
                          <span className="font-semibold text-slate-900 flex items-center gap-1">
                            <Building2 className="w-3.5 h-3.5 text-slate-400" />
                            {job.company_name}
                          </span>
                          <span>·</span>
                          <span>{job.department_name}</span>
                          <span>·</span>
                          <span className="flex items-center gap-1 text-slate-500">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            {job.location}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {expired ? (
                          <span className="px-2.5 py-1 text-2xs font-semibold rounded-md bg-rose-50 text-rose-700 border border-rose-200">
                            Deadline Closed
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 text-2xs font-semibold rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Open
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Metadata Badges */}
                    <div className="flex flex-wrap items-center gap-2 text-2xs">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                        {formatEmploymentType(job.employment_type)}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                        {formatExperienceLevel(job.experience_level)}
                      </span>
                      {(job.salary_min !== null || job.salary_max !== null) && (
                        <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold flex items-center gap-0.5">
                          <DollarSign className="w-3 h-3" />
                          {job.salary_min !== null && job.salary_max !== null
                            ? `$${job.salary_min.toLocaleString()} – $${job.salary_max.toLocaleString()}`
                            : job.salary_min !== null
                            ? `From $${job.salary_min.toLocaleString()}`
                            : `Up to $${job.salary_max?.toLocaleString()}`}
                        </span>
                      )}
                      {job.deadline_utc && (
                        <span className={`px-2 py-0.5 rounded flex items-center gap-1 font-medium ${
                          expired ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-800'
                        }`}>
                          <Calendar className="w-3 h-3" />
                          Apply by: {new Date(job.deadline_utc).toLocaleDateString()}
                        </span>
                      )}
                    </div>

                    {/* Description Snippet */}
                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {job.description}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-2xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Posted {new Date(job.created_at).toLocaleDateString()}
                    </span>

                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setSelectedJobId(job.id)}
                      className="cursor-pointer gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                    >
                      View Job Details
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl p-3 shadow-2xs">
              <span className="text-xs text-slate-500">
                Page <span className="font-semibold text-slate-800">{page + 1}</span> of{' '}
                <span className="font-semibold text-slate-800">{totalPages}</span> ({totalElements} total jobs)
              </span>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page === 0 || isFetching}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className="cursor-pointer gap-1 text-xs"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Previous
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages - 1 || isFetching}
                  onClick={() => setPage((p) => p + 1)}
                  className="cursor-pointer gap-1 text-xs"
                >
                  Next
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
        </>
      )}

      {/* --- JOB DETAIL MODAL --- */}
      {selectedJobId && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl space-y-5 my-8">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-2xs font-semibold text-indigo-600 uppercase tracking-wider">
                  Verified Requisition
                </span>
                <h2 className="text-xl font-bold text-slate-900 mt-0.5">{jobDetail?.title}</h2>
                <div className="flex items-center gap-2 text-xs text-slate-600 mt-1">
                  <span className="font-semibold text-slate-800">{jobDetail?.company_name}</span>
                  <span>·</span>
                  <span>{jobDetail?.department_name}</span>
                  <span>·</span>
                  <span className="flex items-center gap-1 text-slate-500">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    {jobDetail?.location}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedJobId(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isDetailLoading ? (
              <LoadingSpinner label="Loading full job specifications..." />
            ) : detailError ? (
              <ErrorState title="Failed to load job details" error={detailError} />
            ) : jobDetail ? (
              <div className="space-y-5 text-xs text-slate-700">
                {/* Highlights bar */}
                <div className="flex flex-wrap gap-2 text-2xs font-semibold bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-700">
                    Type: {formatEmploymentType(jobDetail.employment_type)}
                  </span>
                  <span className="px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-700">
                    Level: {formatExperienceLevel(jobDetail.experience_level)}
                  </span>
                  {(jobDetail.salary_min !== null || jobDetail.salary_max !== null) && (
                    <span className="px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800">
                      Salary: ${jobDetail.salary_min?.toLocaleString()} – ${jobDetail.salary_max?.toLocaleString()}
                    </span>
                  )}
                  {jobDetail.deadline_utc && (
                    <span className="px-2.5 py-1 rounded-md bg-amber-50 border border-amber-200 text-amber-800">
                      Deadline: {new Date(jobDetail.deadline_utc).toLocaleString()}
                    </span>
                  )}
                </div>

                <div>
                  <h3 className="text-sm font-bold text-slate-900 mb-2">Role Overview</h3>
                  <p className="whitespace-pre-line leading-relaxed text-slate-600">
                    {jobDetail.description}
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-slate-900 mb-2">Requirements & Qualifications</h3>
                  <p className="whitespace-pre-line leading-relaxed text-slate-600">
                    {jobDetail.requirements}
                  </p>
                </div>

                {/* Application Status Banner */}
                {user?.role === 'APPLICANT' && jobDetail && appliedJobIds.has(jobDetail.id) && (
                  <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 text-emerald-900 text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div>
                      <span className="font-bold">Application Submitted:</span> You have an active application on file for this position. Track status under My Applications.
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setSelectedJobId(null)} className="cursor-pointer">
                Close
              </Button>
              {user?.role === 'APPLICANT' && jobDetail && !appliedJobIds.has(jobDetail.id) && (
                <Button
                  type="button"
                  onClick={() => {
                    setApplyModalJob(jobDetail);
                    setSelectedJobId(null);
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white cursor-pointer flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" /> Apply for this Position
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Apply Job Modal */}
      {applyModalJob && (
        <ApplyJobModal
          job={applyModalJob}
          isOpen={Boolean(applyModalJob)}
          onClose={() => setApplyModalJob(null)}
        />
      )}
    </div>
  );
}
