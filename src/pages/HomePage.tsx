import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import { 
  User, 
  Briefcase, 
  Users, 
  BarChart2, 
  Shield, 
  FileText, 
  Calendar, 
  ArrowRight,
  BarChart3
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { ScrambleHeadline } from '../components/ui/ScrambleHeadline';

const EASING = [0.22, 1, 0.36, 1] as const;

const ROLE_PORTALS = [
  {
    role: 'APPLICANT',
    title: 'Applicant Portal',
    description: 'Discover opportunities, manage your resume, and track applications.',
    icon: User,
    iconColor: 'bg-blue-50 text-blue-600',
    path: '/applicant',
    actionLabel: 'Enter Applicant Portal',
  },
  {
    role: 'RECRUITER',
    title: 'Recruiter Workspace',
    description: 'Manage job postings, review applications, and build candidate pipelines.',
    icon: Briefcase,
    iconColor: 'bg-purple-50 text-purple-600',
    path: '/recruiter',
    actionLabel: 'Enter Recruiter Workspace',
  },
  {
    role: 'INTERVIEWER',
    title: 'Interviewer Portal',
    description: 'Review assigned interviews, explore question suggestions, and submit feedback.',
    icon: Users,
    iconColor: 'bg-emerald-50 text-emerald-600',
    path: '/interviewer',
    actionLabel: 'Enter Interviewer Portal',
  },
  {
    role: 'HR_MANAGER',
    title: 'HR Management',
    description: 'Monitor recruitment performance and organization-level hiring activity.',
    icon: BarChart2,
    iconColor: 'bg-amber-50 text-amber-600',
    path: '/hr',
    actionLabel: 'Enter HR Workspace',
  },
  {
    role: 'ADMIN',
    title: 'System Administration',
    description: 'Manage authorized users, company settings, and audit records.',
    icon: Shield,
    iconColor: 'bg-rose-50 text-rose-600',
    path: '/admin',
    actionLabel: 'Enter Administration',
  },
];

export function HomePage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="w-full">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-[radial-gradient(ellipse_80%_60%_at_45%_-10%,rgba(216,225,254,0.45),rgba(245,238,255,0.3),transparent_70%)] border-b border-slate-100/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-16 sm:pt-14 sm:pb-20 lg:pt-16 lg:pb-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
            
            {/* Left Column: Value Proposition & CTAs */}
            <div className="lg:col-span-5 xl:col-span-6 space-y-6">
              {/* Eyebrow */}
              <motion.div
                initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.08, ease: EASING }}
                className="inline-flex items-center text-xs font-bold tracking-wider text-indigo-600 uppercase"
              >
                ONE CONNECTED RECRUITMENT WORKSPACE
              </motion.div>

              {/* Headline with GSAP Scramble Reveal */}
              <motion.div
                initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.16, ease: EASING }}
              >
                <ScrambleHeadline className="text-4xl sm:text-5xl lg:text-[46px] xl:text-[52px] font-black tracking-tight text-slate-900 leading-[1.08]" />
              </motion.div>

              {/* Supporting Copy */}
              <motion.p
                initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.26, ease: EASING }}
                className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-lg font-normal"
              >
                Discover opportunities, manage candidate pipelines, coordinate interviews and gain recruitment insights through one role-aware platform.
              </motion.p>

              {/* Primary & Secondary Actions */}
              <motion.div
                initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.36, ease: EASING }}
                className="pt-2 flex flex-wrap items-center gap-3.5"
              >
                <a
                  href="#workspaces"
                  className="inline-flex items-center gap-2 px-6 py-3.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-xl shadow-sm hover:shadow-md hover:shadow-indigo-600/25 active:scale-[0.99] transition-all duration-200 group focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  <span>Choose Your Workspace</span>
                  <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
                </a>
                <Link
                  to="/health"
                  className="inline-flex items-center gap-2 px-5 py-3.5 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 active:bg-slate-100 border border-slate-200/90 hover:border-slate-300 rounded-xl shadow-2xs hover:shadow-xs active:scale-[0.99] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  <BarChart3 className="w-4 h-4 text-slate-600" />
                  <span>View System Health</span>
                </Link>
              </motion.div>
            </div>

            {/* Right Column: Connected Workflow Graphic */}
            <div className="lg:col-span-7 xl:col-span-6 relative w-full h-[400px] sm:h-[450px] lg:h-[480px] flex items-center justify-center">
              {/* Ambient Glow Orbs */}
              <div className="absolute -top-10 -right-10 w-96 h-96 bg-purple-200/35 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-2 left-6 w-80 h-80 bg-indigo-200/30 rounded-full blur-3xl pointer-events-none" />

              {/* Isometric Tilted Dashboard Card */}
              <motion.div
                initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 0.95 }}
                transition={{ duration: 0.7, delay: 0.25, ease: EASING }}
                className="absolute inset-x-4 inset-y-4 sm:inset-x-8 sm:inset-y-6 rounded-3xl bg-gradient-to-br from-white/75 via-indigo-50/20 to-purple-50/35 border border-indigo-100/70 shadow-xl backdrop-blur-2xs rotate-[1.5deg] pointer-events-none overflow-hidden"
              >
                <div className="h-7 border-b border-indigo-100/70 px-4 flex items-center gap-1.5 opacity-50">
                  <div className="w-2 h-2 rounded-full bg-slate-400" />
                  <div className="w-2 h-2 rounded-full bg-slate-400" />
                  <div className="w-2 h-2 rounded-full bg-slate-400" />
                </div>
                <div className="p-6 space-y-3 opacity-25">
                  <div className="w-24 h-1.5 bg-indigo-300 rounded" />
                  <div className="w-48 h-1.5 bg-slate-300 rounded" />
                  <div className="w-36 h-1.5 bg-slate-300 rounded" />
                </div>
              </motion.div>

              {/* Connecting Workflow Spline (SVG) */}
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
                viewBox="0 0 680 440"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  <linearGradient id="workflowLineGrad" x1="40" y1="200" x2="640" y2="200" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#818CF8" stopOpacity="0.5" />
                    <stop offset="0.3" stopColor="#6366F1" stopOpacity="0.9" />
                    <stop offset="0.7" stopColor="#8B5CF6" stopOpacity="0.9" />
                    <stop offset="1" stopColor="#A855F7" stopOpacity="0.5" />
                  </linearGradient>
                </defs>

                {/* Upper Flow Path (connecting User to Cards and Analytics) */}
                <motion.path
                  d="M 50 190 C 130 140, 180 80, 270 75 C 360 70, 420 120, 500 125 C 570 130, 600 170, 640 185"
                  stroke="#C7D2FE"
                  strokeWidth="5"
                  strokeLinecap="round"
                  initial={shouldReduceMotion ? { pathLength: 1, opacity: 0.4 } : { pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 0.4 }}
                  transition={{ duration: 0.9, delay: 0.35, ease: EASING }}
                />
                <motion.path
                  d="M 50 190 C 130 140, 180 80, 270 75 C 360 70, 420 120, 500 125 C 570 130, 600 170, 640 185"
                  stroke="url(#workflowLineGrad)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  initial={shouldReduceMotion ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 0.9, delay: 0.35, ease: EASING }}
                />

                {/* Lower Looping Spline Arc */}
                <motion.path
                  d="M 70 210 C 150 270, 290 285, 410 270 C 500 260, 580 230, 630 190"
                  stroke="#E0E7FF"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                  initial={shouldReduceMotion ? { pathLength: 1, opacity: 0.7 } : { pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 0.7 }}
                  transition={{ duration: 0.8, delay: 0.5, ease: EASING }}
                />

                {/* Connected Glowing Nodes along Flow */}
                {/* Node at Card 1 */}
                <motion.circle
                  cx="270"
                  cy="75"
                  r="5"
                  fill="#3B82F6"
                  stroke="#FFFFFF"
                  strokeWidth="2"
                  initial={shouldReduceMotion ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.4, delay: 0.65, ease: EASING }}
                />
                {/* Intermediate Node */}
                <motion.circle
                  cx="395"
                  cy="115"
                  r="4.5"
                  fill="#6366F1"
                  stroke="#FFFFFF"
                  strokeWidth="2"
                  initial={shouldReduceMotion ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.4, delay: 0.75, ease: EASING }}
                />
                {/* Node at Card 2 */}
                <motion.circle
                  cx="500"
                  cy="125"
                  r="5"
                  fill="#8B5CF6"
                  stroke="#FFFFFF"
                  strokeWidth="2"
                  initial={shouldReduceMotion ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.4, delay: 0.85, ease: EASING }}
                />
                {/* Node at Card 3 */}
                <motion.circle
                  cx="585"
                  cy="165"
                  r="4.5"
                  fill="#9333EA"
                  stroke="#FFFFFF"
                  strokeWidth="2"
                  initial={shouldReduceMotion ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.4, delay: 0.95, ease: EASING }}
                />
                {/* Node on lower arc */}
                <motion.circle
                  cx="410"
                  cy="270"
                  r="3.5"
                  fill="#A855F7"
                  initial={shouldReduceMotion ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.4, delay: 0.8, ease: EASING }}
                />
              </svg>

              {/* Floating Node 1: Candidate Avatar */}
              <motion.div
                initial={shouldReduceMotion ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.45, ease: EASING }}
                className="absolute top-40 left-0 sm:left-4 z-30 w-10 h-10 rounded-full bg-white/95 backdrop-blur-md border border-indigo-100 shadow-md flex items-center justify-center text-indigo-600 select-none"
              >
                <User className="w-4 h-4" />
              </motion.div>

              {/* Floating Card 1: Application Received */}
              <motion.div
                initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.5, ease: EASING }}
                className="absolute top-2 left-10 sm:left-18 lg:left-14 z-20 w-64 sm:w-72 bg-white/95 backdrop-blur-md rounded-2xl p-4 border border-white/80 shadow-[0_12px_32px_rgba(79,70,229,0.08)] select-none"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 leading-none">Application Received</h4>
                      <p className="text-[10.5px] text-slate-500 mt-1 leading-snug">
                        New application submitted and added to pipeline.
                      </p>
                    </div>
                  </div>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 mt-1 shadow-2xs" />
                </div>
                <div className="mt-3 pt-2.5 border-t border-slate-50 flex flex-col gap-1.5">
                  <div className="h-1 bg-slate-100 rounded-full w-24" />
                  <div className="h-1 bg-slate-100 rounded-full w-16" />
                </div>
              </motion.div>

              {/* Floating Card 2: Interview Scheduled */}
              <motion.div
                initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.65, ease: EASING }}
                className="absolute top-28 left-24 sm:left-40 lg:left-36 z-20 w-64 sm:w-72 bg-white/95 backdrop-blur-md rounded-2xl p-4 border border-white/80 shadow-[0_12px_32px_rgba(79,70,229,0.08)] select-none"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 leading-none">Interview Scheduled</h4>
                      <p className="text-[10.5px] text-slate-500 mt-1 leading-snug">
                        Interview slot confirmed with candidate.
                      </p>
                    </div>
                  </div>
                  <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0 mt-1 shadow-2xs" />
                </div>
                <div className="mt-3 pt-2.5 border-t border-slate-50 flex flex-col gap-1.5">
                  <div className="h-1 bg-slate-100 rounded-full w-24" />
                  <div className="h-1 bg-slate-100 rounded-full w-20" />
                </div>
              </motion.div>

              {/* Floating Card 3: Feedback Submitted */}
              <motion.div
                initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.8, ease: EASING }}
                className="absolute top-56 left-32 sm:left-56 lg:left-52 z-20 w-64 sm:w-72 bg-white/95 backdrop-blur-md rounded-2xl p-4 border border-white/80 shadow-[0_12px_32px_rgba(79,70,229,0.08)] select-none"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 leading-none">Feedback Submitted</h4>
                      <p className="text-[10.5px] text-slate-500 mt-1 leading-snug">
                        Interview feedback recorded and shared with hiring team.
                      </p>
                    </div>
                  </div>
                  <span className="w-2 h-2 rounded-full bg-purple-600 shrink-0 mt-1 shadow-2xs" />
                </div>
                <div className="mt-3 pt-2.5 border-t border-slate-50 flex flex-col gap-1.5">
                  <div className="h-1 bg-slate-100 rounded-full w-24" />
                  <div className="h-1 bg-slate-100 rounded-full w-16" />
                </div>
              </motion.div>

              {/* Floating Node 2: Analytics Badge */}
              <motion.div
                initial={shouldReduceMotion ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.95, ease: EASING }}
                className="absolute top-40 right-1 sm:right-6 z-30 w-10 h-10 rounded-full bg-white/95 backdrop-blur-md border border-purple-100 shadow-md flex items-center justify-center text-purple-600 select-none"
              >
                <BarChart2 className="w-4 h-4" />
              </motion.div>

            </div>

          </div>
        </div>
      </section>

      {/* Section 2: Five Focused Workspaces */}
      <section id="workspaces" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        {/* Section Heading */}
        <motion.div
          initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.5, ease: EASING }}
          className="text-center max-w-2xl mx-auto"
        >
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight">
            One platform. Five focused workspaces.
          </h2>
          <p className="text-sm sm:text-base text-slate-500 mt-2 font-normal">
            Purpose-built experiences for every stage of the recruitment journey.
          </p>
        </motion.div>

        {/* 5-Role Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4.5 mt-12">
          {ROLE_PORTALS.map((portal, index) => {
            const Icon = portal.icon;
            const isUserRole = user?.role === portal.role;
            const destination =
              isAuthenticated && isUserRole ? portal.path : `/auth?role=${portal.role}`;

            return (
              <motion.div
                key={portal.role}
                initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-20px' }}
                whileHover={shouldReduceMotion ? {} : { y: -4 }}
                transition={{
                  duration: 0.22,
                  ease: EASING,
                  delay: shouldReduceMotion ? 0 : index * 0.07,
                }}
                onClick={() => navigate(destination)}
                className="group bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs hover:shadow-[0_12px_28px_rgba(79,70,229,0.08)] hover:border-indigo-300 transition-colors flex flex-col justify-between cursor-pointer"
              >
                <div>
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 transition-transform duration-200 ease-out group-hover:scale-105 ${portal.iconColor}`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center justify-between">
                    <span>{portal.title}</span>
                    {isUserRole && (
                      <span className="text-[10px] bg-indigo-50 text-indigo-700 font-bold px-1.5 py-0.5 rounded">
                        Active
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                    {portal.description}
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-100">
                  <Link
                    to={destination}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center text-xs font-semibold text-indigo-600 hover:text-indigo-700 group-hover:gap-1.5 gap-1 transition-all"
                  >
                    <span>{portal.actionLabel}</span>
                    <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 ease-out group-hover:translate-x-1" />
                  </Link>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
