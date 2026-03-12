import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
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
import FormBuilder from './components/FormBuilder';
import DepartmentView from './components/DepartmentView';
import MyProjectsView from './components/MyProjectsView';
import DepartmentActivityLog from './components/DepartmentActivityLog';
import PMActivityLog from './components/PMActivityLog';
import TasksDueTodayView from './components/TasksDueTodayView';
import ForumConversations from './components/ForumConversations';
import { authService } from './services/auth.service';
import './App.css';

const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return authService.isAuthenticated() ? <>{children}</> : <Navigate to="/login" />;
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

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/reset-password" element={<ResetPassword />} />
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
          path="/project/:id"
          element={
            <PrivateRoute>
              <ProjectDetail />
            </PrivateRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <PrivateRoute>
              <Profile />
            </PrivateRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <PrivateRoute>
              <Settings />
            </PrivateRoute>
          }
        />
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
          path="/my-projects"
          element={
            <PrivateRoute>
              <MyProjectsView />
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
        <Route
          path="/forum"
          element={
            <PrivateRoute>
              <ForumConversations />
            </PrivateRoute>
          }
        />
        <Route
          path="/tasks-due-today"
          element={
            <PrivateRoute>
              <TasksDueTodayView />
            </PrivateRoute>
          }
        />
        {/* Fallback route - redirect to Home Page if route not found */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
};

export default App;

