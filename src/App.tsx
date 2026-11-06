import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import LandingPage from './components/LandingPage';
import Login from './components/Login';
import RoleBasedDashboard from './components/RoleBasedDashboard';
import PMDashboard from './components/dashboards/PMDashboard';
import ProjectDetail from './components/ProjectDetail';
import Profile from './components/Profile';
import Settings from './components/Settings';
import Users from './components/Users';
import Clients from './components/Clients';
import CompletedProjects from './components/CompletedProjects';
import ResetPassword from './components/ResetPassword';
import ClientUpdateFormView from './components/ClientUpdateFormView';
import RapidProspectOnboardingEntry from './components/RapidProspectOnboardingEntry';
import FormBuilder from './components/FormBuilder';
import DepartmentView from './components/DepartmentView';
import MyProjectsView from './components/MyProjectsView';
import DepartmentActivityLog from './components/DepartmentActivityLog';
import PMActivityLog from './components/PMActivityLog';
import TasksDueTodayView from './components/TasksDueTodayView';
import DailyFocusAndEodView from './components/DailyFocusAndEodView';
import DepartmentPrioritiesPmView from './components/DepartmentPrioritiesPmView';
import RapidProspectDashboard from './components/dashboards/RapidProspectDashboard';
import RoleDashboard from './components/dashboards/RoleDashboard';
import TuesdayView from './components/tuesday/TuesdayView';
import BoardsPage from './components/boards/BoardsPage';
import ForumConversations from './components/ForumConversations';
import TimelinePage from './components/TimelinePage';
import DashboardLayout from './components/DashboardLayout';
import AssistantWidget from './components/AssistantWidget';
import MBTIAssessment from './components/MBTIAssessment';
import HubRoot from './components/hub/HubRoot';
import AllProducts from './components/hub/AllProducts';
import ProductPage from './components/hub/ProductPage';
import SharePage from './components/hub/SharePage';
import FormsRoot from './components/forms/FormsRoot';
import FormsHome from './components/forms/FormsHome';
import FormEditor from './components/forms/FormEditor';
import PublicForm from './components/forms/PublicForm';
import WorkspaceRoot from './components/workspace/WorkspaceRoot';
import MyDay from './components/workspace/MyDay';
import VaultPage from './components/workspace/VaultPage';
import PagesHome from './components/workspace/PagesHome';
import PageEditor from './components/workspace/PageEditor';
import MeetingNotePage from './components/meetings/MeetingNotePage';
import MeetingsHome from './components/meetings/MeetingsHome';
import { authService } from './services/auth.service';
import './App.css';

// The video library is large, so it only loads for people opening a call.
const MeetingRoom = React.lazy(() => import('./components/meetings/MeetingRoom'));
const DrivelyRoot = React.lazy(() => import('./components/drively/DrivelyRoot'));
const DrivelyHome = React.lazy(() => import('./components/drively/DrivelyHome'));
const DriveOpen = React.lazy(() => import('./components/drively/DriveOpen'));
const GuestMeeting = React.lazy(() => import('./components/meetings/GuestMeeting'));

const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const fromPath = `${location.pathname}${location.search}${location.hash}`;

  if (!authService.isAuthenticated()) {
    try {
      sessionStorage.setItem('postLoginRedirect', fromPath);
    } catch {
      // Ignore storage failures; query/state fallback still works.
    }
  }

  return authService.isAuthenticated() ? (
    <>{children}</>
  ) : (
    <Navigate
      to={`/login?redirect=${encodeURIComponent(fromPath)}`}
      replace
      state={{ from: fromPath }}
    />
  );
};

/** PM Dashboard route: accessible by Project Managers and department heads (isTeamLead) */
const PMDashboardRoute: React.FC = () => {
  const user = authService.getUser();
  const isPM = user?.role === 'Project Manager' || user?.role === 'FOUNDER/CEO';
  const isHead = !!user?.isTeamLead;
  if (isPM || isHead) {
    return <PMDashboard />;
  }
  return <Navigate to="/dashboard" replace />;
};

/** Tuesday view: same access as PMDashboard. */
const TuesdayRoute: React.FC = () => {
  const user = authService.getUser();
  const isPM = user?.role === 'Project Manager' || user?.role === 'FOUNDER/CEO';
  const isHead = !!user?.isTeamLead;
  if (isPM || isHead) {
    return <TuesdayView />;
  }
  return <Navigate to="/dashboard" replace />;
};

/** Daily focus & EOD: Project Managers only */
const DailyFocusRoute: React.FC = () => {
  const user = authService.getUser();
  if (user?.role === 'Project Manager') {
    return <DailyFocusAndEodView />;
  }
  return <Navigate to="/dashboard" replace />;
};

/** Canonical department client priorities — PM or Head PM */
const DepartmentPrioritiesRoute: React.FC = () => {
  const user = authService.getUser();
  if (user?.role === 'Project Manager' || user?.isHeadPM) {
    return <DepartmentPrioritiesPmView />;
  }
  return <Navigate to="/dashboard" replace />;
};

/** Rapid Prospect dashboard — PM, Head PM, Founder, or Rapid Prospect team */
const RapidProspectRoute: React.FC = () => {
  const user = authService.getUser();
  if (user?.role === 'Project Manager' || user?.isHeadPM || user?.role === 'FOUNDER/CEO' || user?.role === 'Rapid Prospect') {
    return <RapidProspectDashboard />;
  }
  return <Navigate to="/dashboard" replace />;
};

const DEPARTMENT_ROLE_BY_SLUG: Record<string, string> = {
  'copy-writing': 'Copy Writing',
  'designer': 'Designer',
  'developer': 'Developer',
  'ai-developer': 'AI Developer',
  'social-media': 'Social Media',
  'crm': 'CRM',
  'seo-geo': 'SEO/GEO',
};

/** Department board quick view for PM/Head PM/Founder */
const DepartmentBoardRoute: React.FC = () => {
  const user = authService.getUser();
  const { roleSlug } = useParams<{ roleSlug: string }>();
  const mappedRole = roleSlug ? DEPARTMENT_ROLE_BY_SLUG[roleSlug] : undefined;
  const canAccess = user?.role === 'Project Manager' || user?.isHeadPM || user?.role === 'FOUNDER/CEO';

  if (!canAccess || !mappedRole) {
    return <Navigate to="/pm-dashboard" replace />;
  }

  return <RoleDashboard role={mappedRole} pmPreviewMode={user?.role === 'Project Manager'} />;
};

/** Pages anyone can open: the assistant must never appear here, even if a teammate is logged in on this browser. */
const PUBLIC_PATHS = ['/', '/login', '/signup', '/reset-password', '/rapid-prospect-onboarding'];
const PUBLIC_PREFIXES = ['/share/', '/f/', '/m/', '/client-updates/forms/'];
/** A floating button would sit over the call's own controls. */
const isCallPage = (path: string) => /^\/meetings\/[^/]+$/.test(path);

const AssistantOnAppPages: React.FC = () => {
  const { pathname } = useLocation();
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  const isPublic = PUBLIC_PATHS.includes(path) || PUBLIC_PREFIXES.some((prefix) => path.startsWith(prefix));
  return authService.isAuthenticated() && !isPublic && !isCallPage(path) ? <AssistantWidget /> : null;
};

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Navigate to="/login" replace />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/rapid-prospect-onboarding" element={<RapidProspectOnboardingEntry />} />
        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <RoleBasedDashboard />
            </PrivateRoute>
          }
        />
        <Route
          path="/pm-dashboard"
          element={
            <PrivateRoute>
              <PMDashboardRoute />
            </PrivateRoute>
          }
        />
        <Route
          path="/department-view/:roleSlug"
          element={
            <PrivateRoute>
              <DepartmentBoardRoute />
            </PrivateRoute>
          }
        />
        <Route
          path="/project/:id"
          element={
            <PrivateRoute>
              <ProjectDetail />
            </PrivateRoute>
          }
        />
        {/* Routes that use the shared side navigation layout */}
        <Route element={<PrivateRoute><DashboardLayout /></PrivateRoute>}>
          <Route path="tuesday" element={<TuesdayRoute />} />
          <Route path="boards" element={<BoardsPage />} />
          <Route path="boards/:projectId" element={<BoardsPage />} />
          <Route path="boards/:projectId/:taskId" element={<BoardsPage />} />
          <Route path="timeline" element={<TimelinePage />} />
          <Route path="timeline/:userId" element={<TimelinePage />} />
          <Route path="my-projects" element={<MyProjectsView />} />
          <Route path="forum" element={<ForumConversations />} />
          <Route path="tasks-due-today" element={<TasksDueTodayView />} />
          <Route path="daily-focus" element={<DailyFocusRoute />} />
          <Route path="department-priorities" element={<DepartmentPrioritiesRoute />} />
          <Route path="rapid-prospect" element={<RapidProspectRoute />} />
          <Route path="profile" element={<Profile />} />
          <Route path="settings" element={<Settings />} />
          <Route path="mbti-assessment" element={<MBTIAssessment />} />
          {/* Katalyst Hub */}
          <Route path="products" element={<HubRoot />}>
            <Route index element={<AllProducts />} />
            <Route path=":slug" element={<ProductPage />} />
            <Route path=":slug/:tab" element={<ProductPage />} />
          </Route>
          {/* Workspace */}
          <Route element={<WorkspaceRoot />}>
            <Route path="my-day" element={<MyDay />} />
            <Route path="vault" element={<VaultPage />} />
            <Route path="pages" element={<PagesHome />} />
            <Route path="pages/:id" element={<PageEditor />} />
          </Route>
          {/* Meetings */}
          <Route element={<HubRoot />}>
            <Route path="meetings" element={<MeetingsHome />} />
            <Route path="meetings/notes/:noteId" element={<MeetingNotePage />} />
          </Route>
          {/* Forms */}
          <Route path="forms" element={<FormsRoot />}>
            <Route index element={<FormsHome />} />
            <Route path=":id" element={<FormEditor />} />
            <Route path=":id/:tab" element={<FormEditor />} />
          </Route>
        </Route>
        {/* Katalyst Hub: public client page for a shared vault login (no sign-in) */}
        <Route path="/share/:token" element={<SharePage />} />
        {/* Drively: a Drive of its own, with its own navigation; editors fill the window */}
        <Route
          path="/drively"
          element={
            <PrivateRoute>
              <Suspense fallback={null}>
                <DrivelyRoot />
              </Suspense>
            </PrivateRoute>
          }
        >
          <Route index element={<DrivelyHome />} />
          <Route path="my-drive" element={<DrivelyHome section="mine" />} />
          <Route path="shared" element={<DrivelyHome section="shared" />} />
          <Route path="recent" element={<DrivelyHome section="recent" />} />
          <Route path="starred" element={<DrivelyHome section="starred" />} />
          <Route path="trash" element={<DrivelyHome section="trash" />} />
          <Route path="folders/:folderId" element={<DrivelyHome />} />
          <Route path="d/:id" element={<DriveOpen />} />
        </Route>
        {/* Meetings: the call fills the window, so it sits outside the side navigation */}
        <Route
          path="/meetings/:id"
          element={
            <PrivateRoute>
              <HubRoot>
                <Suspense fallback={null}>
                  <MeetingRoom />
                </Suspense>
              </HubRoot>
            </PrivateRoute>
          }
        />
        {/* Meetings: public page a guest joins from (no sign-in) */}
        <Route
          path="/m/:code"
          element={
            <HubRoot>
              <Suspense fallback={null}>
                <GuestMeeting />
              </Suspense>
            </HubRoot>
          }
        />
        {/* Forms: public page a client fills in (no sign-in) */}
        <Route path="/f/:token" element={<PublicForm />} />
        <Route
          path="/users"
          element={
            <PrivateRoute>
              <Users />
            </PrivateRoute>
          }
        />
        <Route
          path="/clients"
          element={
            <PrivateRoute>
              <Clients />
            </PrivateRoute>
          }
        />
        <Route
          path="/completed-projects"
          element={
            <PrivateRoute>
              <CompletedProjects />
            </PrivateRoute>
          }
        />
        <Route
          path="/client-updates/forms/:publicToken"
          element={<ClientUpdateFormView />}
        />
        <Route
          path="/project/:projectId/form-builder/:updateId"
          element={
            <PrivateRoute>
              <FormBuilder />
            </PrivateRoute>
          }
        />
        <Route
          path="/project/:projectId/form-builder/:updateId/:formId"
          element={
            <PrivateRoute>
              <FormBuilder />
            </PrivateRoute>
          }
        />
        <Route
          path="/department/:department"
          element={
            <PrivateRoute>
              <DepartmentView />
            </PrivateRoute>
          }
        />
        <Route
          path="/department-activity-log"
          element={
            <PrivateRoute>
              <DepartmentActivityLog />
            </PrivateRoute>
          }
        />
        <Route
          path="/pm-activity-log"
          element={
            <PrivateRoute>
              <PMActivityLog />
            </PrivateRoute>
          }
        />
        {/* Fallback route - redirect to Home Page if route not found */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <AssistantOnAppPages />
    </Router>
  );
};

export default App;

