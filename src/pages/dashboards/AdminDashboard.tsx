import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorState } from '../../components/ui/ErrorState';
import { EmptyState } from '../../components/ui/EmptyState';
import { analyticsService } from '../../services/analyticsService';
import {
  adminService,
  type AdminUserItem,
  type AdminCompanyItem,
  type AdminAuditLogItem,
} from '../../services/adminService';
import type { UserRole, AccountStatus } from '../../types';
import {
  ShieldAlert,
  ShieldCheck,
  Users,
  Building2,
  Briefcase,
  Activity,
  History,
  CheckCircle2,
  UserCheck,
  UserX,
  Plus,
  Filter,
  Search,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Key,
  Layers,
  X,
  ExternalLink,
} from 'lucide-react';

export function AdminDashboard() {
  const { user: currentAdmin } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'companies' | 'audit'>('overview');

  // --- OVERVIEW ANALYTICS QUERY ---
  const { data: analytics, isLoading: isAnalyticsLoading } = useQuery({
    queryKey: ['admin-analytics'],
    queryFn: analyticsService.getAdminAnalytics,
  });

  // --- USER MANAGEMENT STATE ---
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<string>('');
  const [userStatusFilter, setUserStatusFilter] = useState<string>('');
  const [userPage, setUserPage] = useState(0);
  const [selectedUserForRole, setSelectedUserForRole] = useState<AdminUserItem | null>(null);
  const [selectedUserForCompany, setSelectedUserForCompany] = useState<AdminUserItem | null>(null);
  const [userActionError, setUserActionError] = useState<string | null>(null);
  const [userActionSuccess, setUserActionSuccess] = useState<string | null>(null);

  const { data: usersData, isLoading: isUsersLoading, refetch: refetchUsers } = useQuery({
    queryKey: ['admin-users', userSearch, userRoleFilter, userStatusFilter, userPage],
    queryFn: () =>
      adminService.getUsers({
        search: userSearch || undefined,
        role: userRoleFilter || undefined,
        status: userStatusFilter || undefined,
        page: userPage,
        limit: 10,
      }),
    enabled: activeTab === 'users',
  });

  // --- COMPANY MANAGEMENT STATE ---
  const [isCreateCompanyOpen, setIsCreateCompanyOpen] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyDomain, setNewCompanyDomain] = useState('');
  const [newCompanyIndustry, setNewCompanyIndustry] = useState('');
  const [newCompanySize, setNewCompanySize] = useState('10-50');
  const [newCompanyLocation, setNewCompanyLocation] = useState('');
  const [companyActionError, setCompanyActionError] = useState<string | null>(null);
  const [companyActionSuccess, setCompanyActionSuccess] = useState<string | null>(null);

  const { data: companiesData, isLoading: isCompaniesLoading, refetch: refetchCompanies } = useQuery({
    queryKey: ['admin-companies'],
    queryFn: () => adminService.getCompanies(),
    enabled: activeTab === 'companies' || selectedUserForCompany !== null,
  });

  // --- AUDIT LOGS STATE ---
  const [auditActionFilter, setAuditActionFilter] = useState<string>('');
  const [auditEntityFilter, setAuditEntityFilter] = useState<string>('');
  const [auditPage, setAuditPage] = useState(0);
  const [selectedAuditLog, setSelectedAuditLog] = useState<AdminAuditLogItem | null>(null);

  const { data: auditLogsData, isLoading: isAuditLoading, refetch: refetchAuditLogs } = useQuery({
    queryKey: ['admin-audit-logs', auditActionFilter, auditEntityFilter, auditPage],
    queryFn: () =>
      adminService.getAuditLogs({
        action: auditActionFilter || undefined,
        entityType: auditEntityFilter || undefined,
        page: auditPage,
        limit: 15,
      }),
    enabled: activeTab === 'audit',
  });

  // --- USER MUTATIONS ---
  const updateUserStatusMutation = useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: AccountStatus }) =>
      adminService.updateUserStatus(userId, status),
    onSuccess: (data) => {
      setUserActionSuccess(data.message);
      setUserActionError(null);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-analytics'] });
    },
    onError: (err: any) => {
      setUserActionError(err.message || 'Failed to update user status.');
      setUserActionSuccess(null);
    },
  });

  const updateUserRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: UserRole }) =>
      adminService.updateUserRole(userId, role),
    onSuccess: (data) => {
      setUserActionSuccess(data.message);
      setUserActionError(null);
      setSelectedUserForRole(null);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-analytics'] });
    },
    onError: (err: any) => {
      setUserActionError(err.message || 'Failed to update user role.');
    },
  });

  const bindUserCompanyMutation = useMutation({
    mutationFn: ({ userId, companyId }: { userId: string; companyId: string | null }) =>
      adminService.bindUserCompany(userId, companyId),
    onSuccess: (data) => {
      setUserActionSuccess(data.message);
      setUserActionError(null);
      setSelectedUserForCompany(null);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-companies'] });
    },
    onError: (err: any) => {
      setUserActionError(err.message || 'Failed to bind user to company.');
    },
  });

  // --- COMPANY MUTATIONS ---
  const createCompanyMutation = useMutation({
    mutationFn: (data: { name: string; domain?: string; industry?: string; size?: string; location?: string }) =>
      adminService.createCompany(data),
    onSuccess: (data) => {
      setCompanyActionSuccess(data.message);
      setCompanyActionError(null);
      setIsCreateCompanyOpen(false);
      setNewCompanyName('');
      setNewCompanyDomain('');
      setNewCompanyIndustry('');
      setNewCompanyLocation('');
      queryClient.invalidateQueries({ queryKey: ['admin-companies'] });
      queryClient.invalidateQueries({ queryKey: ['admin-analytics'] });
    },
    onError: (err: any) => {
      setCompanyActionError(err.message || 'Failed to create company.');
    },
  });

  const updateCompanyStatusMutation = useMutation({
    mutationFn: ({ companyId, isActive }: { companyId: string; isActive: boolean }) =>
      adminService.updateCompanyStatus(companyId, isActive),
    onSuccess: (data) => {
      setCompanyActionSuccess(data.message);
      setCompanyActionError(null);
      queryClient.invalidateQueries({ queryKey: ['admin-companies'] });
      queryClient.invalidateQueries({ queryKey: ['admin-analytics'] });
    },
    onError: (err: any) => {
      setCompanyActionError(err.message || 'Failed to update company status.');
    },
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-white shrink-0">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              System Administration Console
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Platform Governance · Root User: {currentAdmin?.email} · Role: {currentAdmin?.role}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
          <ShieldCheck className="w-4 h-4" />
          System Administrator
        </div>
      </div>

      {/* Primary Navigation Tabs */}
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
          Overview & Metrics
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('users')}
          className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-colors cursor-pointer text-center ${
            activeTab === 'users'
              ? 'bg-white text-indigo-700 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          User Management
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('companies')}
          className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-colors cursor-pointer text-center ${
            activeTab === 'companies'
              ? 'bg-white text-indigo-700 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Company Organizations
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('audit')}
          className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-colors cursor-pointer text-center ${
            activeTab === 'audit'
              ? 'bg-white text-indigo-700 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Security Audit Logs
        </button>
      </div>

      {/* --- TAB 1: OVERVIEW & PLATFORM METRICS --- */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-5 border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Total Users
                </span>
                <div className="p-2 bg-blue-50 text-blue-700 rounded-lg">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-black text-slate-900 mt-2 font-mono">
                {analytics?.metrics.totalUsersCount ?? 0}
              </p>
              <p className="mt-2 text-[11px] text-slate-500">
                {analytics?.metrics.activeUsersCount ?? 0} active · {analytics?.metrics.deactivatedUsersCount ?? 0} deactivated
              </p>
            </Card>

            <Card className="p-5 border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Registered Companies
                </span>
                <div className="p-2 bg-emerald-50 text-emerald-700 rounded-lg">
                  <Building2 className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-black text-slate-900 mt-2 font-mono">
                {analytics?.metrics.totalCompaniesCount ?? 0}
              </p>
              <p className="mt-2 text-[11px] text-slate-500">
                {analytics?.metrics.activeCompaniesCount ?? 0} active organizations
              </p>
            </Card>

            <Card className="p-5 border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  System Requisitions
                </span>
                <div className="p-2 bg-purple-50 text-purple-700 rounded-lg">
                  <Briefcase className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-black text-slate-900 mt-2 font-mono">
                {analytics?.metrics.totalJobsCount ?? 0}
              </p>
              <p className="mt-2 text-[11px] text-slate-500">
                {analytics?.metrics.publishedJobsCount ?? 0} publicly active
              </p>
            </Card>

            <Card className="p-5 border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Audit Event Records
                </span>
                <div className="p-2 bg-amber-50 text-amber-700 rounded-lg">
                  <History className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-black text-slate-900 mt-2 font-mono">
                {analytics?.metrics.totalAuditLogsCount ?? 0}
              </p>
              <p className="mt-2 text-[11px] text-slate-500">
                Immutable security & domain event logs
              </p>
            </Card>
          </div>

          {/* Users by Role Breakdown */}
          <Card className="p-6">
            <h3 className="text-sm font-bold text-slate-900 mb-1">
              Identity Inventory by Security Role
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Real-time count of active database accounts across the 5 RBAC tiers
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {[
                { role: 'APPLICANT', count: analytics?.usersByRole.APPLICANT ?? 0, bg: 'bg-indigo-50', text: 'text-indigo-800' },
                { role: 'RECRUITER', count: analytics?.usersByRole.RECRUITER ?? 0, bg: 'bg-blue-50', text: 'text-blue-800' },
                { role: 'INTERVIEWER', count: analytics?.usersByRole.INTERVIEWER ?? 0, bg: 'bg-purple-50', text: 'text-purple-800' },
                { role: 'HR_MANAGER', count: analytics?.usersByRole.HR_MANAGER ?? 0, bg: 'bg-emerald-50', text: 'text-emerald-800' },
                { role: 'ADMIN', count: analytics?.usersByRole.ADMIN ?? 0, bg: 'bg-slate-100', text: 'text-slate-900' },
              ].map((item) => (
                <div key={item.role} className={`p-4 rounded-xl border border-slate-200 ${item.bg} text-center`}>
                  <p className="text-xs font-bold text-slate-600">{item.role}</p>
                  <p className={`text-2xl font-black mt-1 font-mono ${item.text}`}>{item.count}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* Recent System Audit Events Preview */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Recent System Audit Trail</h3>
                <p className="text-xs text-slate-500">Live stream of latest security & domain mutations</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('audit')}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                View all audit logs &rarr;
              </button>
            </div>

            {analytics?.recentAuditLogs && analytics.recentAuditLogs.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="px-4 py-3">Timestamp (UTC)</th>
                      <th className="px-4 py-3">Actor Email</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3">Action</th>
                      <th className="px-4 py-3">Entity Type</th>
                      <th className="px-4 py-3">Entity ID</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {analytics.recentAuditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-2.5 font-mono text-slate-500">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-2.5 font-medium text-slate-900">
                          {log.actor_email || 'System / Bootstrap'}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                            {log.actor_role || 'SYSTEM'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-mono font-bold text-indigo-700">
                          {log.action}
                        </td>
                        <td className="px-4 py-2.5 text-slate-600">{log.entity_type}</td>
                        <td className="px-4 py-2.5 font-mono text-slate-500">{log.entity_id}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-slate-500 bg-slate-50 rounded-lg">
                No audit records captured yet.
              </div>
            )}
          </Card>
        </div>
      )}

      {/* --- TAB 2: USER MANAGEMENT --- */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          {userActionSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                {userActionSuccess}
              </span>
              <button type="button" onClick={() => setUserActionSuccess(null)} className="text-emerald-700 hover:text-emerald-900 cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {userActionError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                {userActionError}
              </span>
              <button type="button" onClick={() => setUserActionError(null)} className="text-rose-700 hover:text-rose-900 cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* User Filters */}
          <Card className="p-4">
            <div className="flex flex-col sm:flex-row gap-3 items-center">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search user by name or email..."
                  value={userSearch}
                  onChange={(e) => {
                    setUserSearch(e.target.value);
                    setUserPage(0);
                  }}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <select
                value={userRoleFilter}
                onChange={(e) => {
                  setUserRoleFilter(e.target.value);
                  setUserPage(0);
                }}
                className="w-full sm:w-40 py-2 px-3 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="">All Roles</option>
                <option value="APPLICANT">Applicant</option>
                <option value="RECRUITER">Recruiter</option>
                <option value="INTERVIEWER">Interviewer</option>
                <option value="HR_MANAGER">HR Manager</option>
                <option value="ADMIN">Admin</option>
              </select>

              <select
                value={userStatusFilter}
                onChange={(e) => {
                  setUserStatusFilter(e.target.value);
                  setUserPage(0);
                }}
                className="w-full sm:w-40 py-2 px-3 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="PENDING">Pending Approval</option>
                <option value="DEACTIVATED">Deactivated</option>
              </select>
            </div>
          </Card>

          {/* Users Table */}
          <Card className="overflow-hidden">
            {isUsersLoading ? (
              <div className="p-12 flex justify-center">
                <LoadingSpinner label="Loading system users..." />
              </div>
            ) : usersData && usersData.content.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="px-4 py-3">User</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Company</th>
                      <th className="px-4 py-3">Created</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {usersData.content.map((u) => {
                      const isSelf = u.id === currentAdmin?.id;
                      return (
                        <tr key={u.id} className="hover:bg-slate-50/50">
                          <td className="px-4 py-3">
                            <p className="font-semibold text-slate-900">
                              {u.first_name} {u.last_name} {isSelf && <span className="text-[10px] text-indigo-600 font-bold">(You)</span>}
                            </p>
                            <p className="text-[11px] text-slate-500 font-mono">{u.email}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800">
                              {u.role}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                u.account_status === 'ACTIVE'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : u.account_status === 'PENDING'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}
                            >
                              {u.account_status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {u.company_name ? (
                              <span className="font-medium text-slate-800">{u.company_name}</span>
                            ) : (
                              <span className="text-slate-400 italic">None</span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-500">
                            {new Date(u.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Toggle Status */}
                              {u.account_status === 'ACTIVE' ? (
                                <button
                                  type="button"
                                  disabled={isSelf || updateUserStatusMutation.isPending}
                                  onClick={() =>
                                    updateUserStatusMutation.mutate({
                                      userId: u.id,
                                      status: 'DEACTIVATED',
                                    })
                                  }
                                  className={`p-1.5 text-xs rounded border transition-colors cursor-pointer ${
                                    isSelf
                                      ? 'opacity-40 cursor-not-allowed text-slate-400 border-slate-200'
                                      : 'text-rose-700 hover:bg-rose-50 border-rose-200'
                                  }`}
                                  title={isSelf ? 'Cannot deactivate self' : 'Deactivate user'}
                                >
                                  <UserX className="w-3.5 h-3.5" />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled={updateUserStatusMutation.isPending}
                                  onClick={() =>
                                    updateUserStatusMutation.mutate({
                                      userId: u.id,
                                      status: 'ACTIVE',
                                    })
                                  }
                                  className="p-1.5 text-xs text-emerald-700 hover:bg-emerald-50 rounded border border-emerald-200 transition-colors cursor-pointer"
                                  title="Activate user"
                                >
                                  <UserCheck className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* Change Role Button */}
                              <button
                                type="button"
                                onClick={() => setSelectedUserForRole(u)}
                                className="px-2 py-1 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded border border-slate-200 transition-colors cursor-pointer"
                              >
                                Role
                              </button>

                              {/* Bind Company Button */}
                              <button
                                type="button"
                                onClick={() => setSelectedUserForCompany(u)}
                                className="px-2 py-1 text-[11px] font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded border border-indigo-200 transition-colors cursor-pointer"
                              >
                                Company
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Pagination Controls */}
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                  <span>
                    Showing {usersData.content.length} of {usersData.totalElements} users (Page {usersData.page + 1} of {usersData.totalPages || 1})
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={userPage <= 0}
                      onClick={() => setUserPage((p) => Math.max(0, p - 1))}
                      className="p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      disabled={userPage >= usersData.totalPages - 1}
                      onClick={() => setUserPage((p) => p + 1)}
                      className="p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-12 text-center">
                <EmptyState
                  title="No users found"
                  description="No user accounts match the current filter criteria."
                />
              </div>
            )}
          </Card>
        </div>
      )}

      {/* --- TAB 3: COMPANY ORGANIZATIONS --- */}
      {activeTab === 'companies' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Registered Organizations</h2>
              <p className="text-xs text-slate-500">Manage tenant companies, bindings, and active statuses</p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsCreateCompanyOpen(true)}
              className="cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Register Company
            </Button>
          </div>

          {companyActionSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                {companyActionSuccess}
              </span>
              <button type="button" onClick={() => setCompanyActionSuccess(null)} className="text-emerald-700 hover:text-emerald-900 cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {companyActionError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                {companyActionError}
              </span>
              <button type="button" onClick={() => setCompanyActionError(null)} className="text-rose-700 hover:text-rose-900 cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <Card className="overflow-hidden">
            {isCompaniesLoading ? (
              <div className="p-12 flex justify-center">
                <LoadingSpinner label="Loading company organizations..." />
              </div>
            ) : companiesData?.companies && companiesData.companies.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="px-4 py-3">Company</th>
                      <th className="px-4 py-3">Domain</th>
                      <th className="px-4 py-3">Industry / Size</th>
                      <th className="px-4 py-3">Location</th>
                      <th className="px-4 py-3">Members</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {companiesData.companies.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3">
                          <p className="font-bold text-slate-900">{c.name}</p>
                          <p className="text-[11px] font-mono text-slate-400">{c.id}</p>
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-600">{c.domain || '—'}</td>
                        <td className="px-4 py-3 text-slate-600">
                          {c.industry || 'Technology'} · {c.size || '10-50'}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{c.location || 'Remote'}</td>
                        <td className="px-4 py-3">
                          <span className="font-semibold text-slate-800">{c.user_count ?? 0}</span> users ·{' '}
                          <span className="font-semibold text-slate-800">{c.job_count ?? 0}</span> jobs
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              c.is_active === 1
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-600 border border-slate-300'
                            }`}
                          >
                            {c.is_active === 1 ? 'ACTIVE' : 'INACTIVE'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant={c.is_active === 1 ? 'outline' : 'primary'}
                            size="sm"
                            disabled={updateCompanyStatusMutation.isPending}
                            onClick={() =>
                              updateCompanyStatusMutation.mutate({
                                companyId: c.id,
                                isActive: c.is_active !== 1,
                              })
                            }
                            className="cursor-pointer text-[11px] py-1 px-2.5"
                          >
                            {c.is_active === 1 ? 'Deactivate' : 'Activate'}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center">
                <EmptyState
                  title="No companies registered"
                  description="Register the first tenant organization using the button above."
                />
              </div>
            )}
          </Card>
        </div>
      )}

      {/* --- TAB 4: SECURITY AUDIT LOGS --- */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">System Activity & Audit Records</h2>
              <p className="text-xs text-slate-500">Immutable forensic audit trail of all security and domain operations</p>
            </div>
          </div>

          {/* Audit Filters */}
          <Card className="p-4">
            <div className="flex flex-col sm:flex-row gap-3 items-center">
              <select
                value={auditActionFilter}
                onChange={(e) => {
                  setAuditActionFilter(e.target.value);
                  setAuditPage(0);
                }}
                className="w-full sm:w-56 py-2 px-3 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="">All Audit Actions</option>
                <option value="LOGIN_SUCCESS">LOGIN_SUCCESS</option>
                <option value="LOGIN_FAILED_WRONG_PASSWORD">LOGIN_FAILED_WRONG_PASSWORD</option>
                <option value="USER_REGISTERED">USER_REGISTERED</option>
                <option value="ADMIN_USER_STATUS_UPDATED">ADMIN_USER_STATUS_UPDATED</option>
                <option value="ADMIN_USER_ROLE_UPDATED">ADMIN_USER_ROLE_UPDATED</option>
                <option value="ADMIN_USER_COMPANY_BOUND">ADMIN_USER_COMPANY_BOUND</option>
                <option value="ADMIN_COMPANY_CREATED">ADMIN_COMPANY_CREATED</option>
                <option value="ADMIN_COMPANY_STATUS_UPDATED">ADMIN_COMPANY_STATUS_UPDATED</option>
                <option value="JOB_DRAFT_CREATED">JOB_DRAFT_CREATED</option>
                <option value="JOB_PUBLISHED">JOB_PUBLISHED</option>
                <option value="JOB_CLOSED">JOB_CLOSED</option>
                <option value="APPLICATION_SUBMITTED">APPLICATION_SUBMITTED</option>
                <option value="APPLICATION_STATUS_CHANGED">APPLICATION_STATUS_CHANGED</option>
                <option value="INTERVIEW_SCHEDULED">INTERVIEW_SCHEDULED</option>
                <option value="INTERVIEW_RESCHEDULED">INTERVIEW_RESCHEDULED</option>
                <option value="INTERVIEW_FEEDBACK_SUBMITTED">INTERVIEW_FEEDBACK_SUBMITTED</option>
              </select>

              <select
                value={auditEntityFilter}
                onChange={(e) => {
                  setAuditEntityFilter(e.target.value);
                  setAuditPage(0);
                }}
                className="w-full sm:w-44 py-2 px-3 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="">All Entity Types</option>
                <option value="USER">USER</option>
                <option value="COMPANY">COMPANY</option>
                <option value="JOB">JOB</option>
                <option value="APPLICATION">APPLICATION</option>
                <option value="INTERVIEW">INTERVIEW</option>
              </select>

              {(auditActionFilter || auditEntityFilter) && (
                <button
                  type="button"
                  onClick={() => {
                    setAuditActionFilter('');
                    setAuditEntityFilter('');
                    setAuditPage(0);
                  }}
                  className="text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer"
                >
                  Clear filters
                </button>
              )}
            </div>
          </Card>

          {/* Audit Logs Table */}
          <Card className="overflow-hidden">
            {isAuditLoading ? (
              <div className="p-12 flex justify-center">
                <LoadingSpinner label="Loading audit logs..." />
              </div>
            ) : auditLogsData && auditLogsData.content.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="px-4 py-3">Timestamp (UTC)</th>
                      <th className="px-4 py-3">Actor</th>
                      <th className="px-4 py-3">Action</th>
                      <th className="px-4 py-3">Entity</th>
                      <th className="px-4 py-3">Entity ID</th>
                      <th className="px-4 py-3 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {auditLogsData.content.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-2.5 font-mono text-slate-500">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-2.5">
                          <p className="font-semibold text-slate-900">{log.actor_email || 'System / Bootstrap'}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{log.actor_role || 'SYSTEM'}</p>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="font-mono font-bold text-indigo-700 bg-indigo-50/80 px-2 py-0.5 rounded">
                            {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-600 font-semibold">{log.entity_type}</td>
                        <td className="px-4 py-2.5 font-mono text-slate-500 text-[11px]">{log.entity_id}</td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedAuditLog(log)}
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer"
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Pagination Controls */}
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                  <span>
                    Showing {auditLogsData.content.length} of {auditLogsData.totalElements} records (Page {auditLogsData.page + 1} of {auditLogsData.totalPages || 1})
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={auditPage <= 0}
                      onClick={() => setAuditPage((p) => Math.max(0, p - 1))}
                      className="p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      disabled={auditPage >= auditLogsData.totalPages - 1}
                      onClick={() => setAuditPage((p) => p + 1)}
                      className="p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-12 text-center">
                <EmptyState
                  title="No audit logs found"
                  description="No audit records match the current filter selection."
                />
              </div>
            )}
          </Card>
        </div>
      )}

      {/* --- MODAL: CHANGE USER ROLE --- */}
      {selectedUserForRole && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-1">Update Security Role</h3>
            <p className="text-xs text-slate-500 mb-4">
              Select new role for {selectedUserForRole.first_name} {selectedUserForRole.last_name} ({selectedUserForRole.email})
            </p>

            <div className="space-y-2 mb-6">
              {(['APPLICANT', 'RECRUITER', 'INTERVIEWER', 'HR_MANAGER', 'ADMIN'] as UserRole[]).map((role) => (
                <label
                  key={role}
                  className={`flex items-center justify-between p-3 rounded-lg border text-xs cursor-pointer transition-colors ${
                    selectedUserForRole.role === role
                      ? 'border-indigo-600 bg-indigo-50/40 font-bold text-indigo-950'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <span>{role}</span>
                  <input
                    type="radio"
                    name="roleSelect"
                    checked={selectedUserForRole.role === role}
                    onChange={() => setSelectedUserForRole({ ...selectedUserForRole, role })}
                    className="accent-indigo-600"
                  />
                </label>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedUserForRole(null)}
                className="cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={updateUserRoleMutation.isPending}
                onClick={() =>
                  updateUserRoleMutation.mutate({
                    userId: selectedUserForRole.id,
                    role: selectedUserForRole.role,
                  })
                }
                className="cursor-pointer"
              >
                Save Role
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: BIND COMPANY --- */}
      {selectedUserForCompany && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-1">Company Tenant Binding</h3>
            <p className="text-xs text-slate-500 mb-4">
              Bind {selectedUserForCompany.first_name} {selectedUserForCompany.last_name} to an organization
            </p>

            <div className="space-y-3 mb-6">
              <label className="block text-xs font-semibold text-slate-700">Select Organization</label>
              <select
                value={selectedUserForCompany.company_id || ''}
                onChange={(e) =>
                  setSelectedUserForCompany({
                    ...selectedUserForCompany,
                    company_id: e.target.value || null,
                  })
                }
                className="w-full py-2 px-3 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="">No Organization (Unbound)</option>
                {companiesData?.companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.id})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedUserForCompany(null)}
                className="cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={bindUserCompanyMutation.isPending}
                onClick={() =>
                  bindUserCompanyMutation.mutate({
                    userId: selectedUserForCompany.id,
                    companyId: selectedUserForCompany.company_id,
                  })
                }
                className="cursor-pointer"
              >
                Save Binding
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: CREATE COMPANY --- */}
      {isCreateCompanyOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-1">Register New Organization</h3>
            <p className="text-xs text-slate-500 mb-4">Create a tenant company record in the system</p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newCompanyName.trim()) return;
                createCompanyMutation.mutate({
                  name: newCompanyName.trim(),
                  domain: newCompanyDomain.trim() || undefined,
                  industry: newCompanyIndustry.trim() || undefined,
                  size: newCompanySize,
                  location: newCompanyLocation.trim() || undefined,
                });
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Company Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Innovations Ltd"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  className="w-full py-2 px-3 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Corporate Domain</label>
                <input
                  type="text"
                  placeholder="e.g. apex.example"
                  value={newCompanyDomain}
                  onChange={(e) => setNewCompanyDomain(e.target.value)}
                  className="w-full py-2 px-3 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Industry</label>
                  <input
                    type="text"
                    placeholder="e.g. Technology"
                    value={newCompanyIndustry}
                    onChange={(e) => setNewCompanyIndustry(e.target.value)}
                    className="w-full py-2 px-3 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Company Size</label>
                  <select
                    value={newCompanySize}
                    onChange={(e) => setNewCompanySize(e.target.value)}
                    className="w-full py-2 px-3 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="1-10">1-10 employees</option>
                    <option value="10-50">10-50 employees</option>
                    <option value="50-200">50-200 employees</option>
                    <option value="200-500">200-500 employees</option>
                    <option value="500+">500+ employees</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Location / HQ</label>
                <input
                  type="text"
                  placeholder="e.g. Austin, TX or Remote"
                  value={newCompanyLocation}
                  onChange={(e) => setNewCompanyLocation(e.target.value)}
                  className="w-full py-2 px-3 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCreateCompanyOpen(false)}
                  className="cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={createCompanyMutation.isPending}
                  className="cursor-pointer"
                >
                  Register Company
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: INSPECT AUDIT LOG --- */}
      {selectedAuditLog && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 border border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-slate-900">Audit Record Inspector</h3>
              <button
                type="button"
                onClick={() => setSelectedAuditLog(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Audit ID</span>
                <span className="font-mono text-slate-900">{selectedAuditLog.id}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Timestamp (UTC)</span>
                <span className="font-mono text-slate-900">{selectedAuditLog.created_at}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Actor Email</span>
                <span className="font-medium text-slate-900">{selectedAuditLog.actor_email || 'System / Bootstrap'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Actor Role</span>
                <span className="font-medium text-slate-900">{selectedAuditLog.actor_role || 'SYSTEM'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Operation Action</span>
                <span className="font-mono font-bold text-indigo-700">{selectedAuditLog.action}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Target Entity</span>
                <span className="font-semibold text-slate-900">{selectedAuditLog.entity_type} ({selectedAuditLog.entity_id})</span>
              </div>

              <div className="pt-2">
                <span className="text-slate-500 block mb-1">Metadata Payload:</span>
                <pre className="p-3 bg-slate-900 text-slate-100 rounded-lg font-mono text-[11px] overflow-x-auto whitespace-pre-wrap">
                  {selectedAuditLog.metadata_json
                    ? JSON.stringify(JSON.parse(selectedAuditLog.metadata_json), null, 2)
                    : 'null'}
                </pre>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedAuditLog(null)}
                className="cursor-pointer"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
