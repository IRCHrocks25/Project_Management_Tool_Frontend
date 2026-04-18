import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import LandingPage from './components/LandingPage';
import Login from './components/Login';
import Signup from './components/Signup';
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
import ForumConversations from './components/ForumConversations';
import TimelinePage from './components/TimelinePage';
import DashboardLayout from './components/DashboardLayout';
import FAQHelpButton from './components/FAQHelpButton';
import MBTIAssessment from './components/MBTIAssessment';
import { authService } from './services/auth.service';
import './App.css';

const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  return authService.isAuthenticated() ? (
    <>{children}</>
  ) : (
    <Navigate
      to="/login"
      replace
      state={{ from: `${location.pathname}${location.search}${location.hash}` }}
    />
  );
};

/** PM Dashboard route: accessible by Project Managers and department heads (isTeamLead) */
const PMDashboardRoute: React.FC = () => {
  const user = authService.getUser();
  const isPM = user?.role === 'Project Manager';
  const isHead = !!user?.isTeamLead;
  if (isPM || isHead) {
    return <PMDashboard />;
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

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
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
        </Route>
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
      {authService.isAuthenticated() && <FAQHelpButton />}
    </Router>
  );
};

export default App;

