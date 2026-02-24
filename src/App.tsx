import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './components/LandingPage';
import Login from './components/Login';
import Signup from './components/Signup';
import RoleBasedDashboard from './components/RoleBasedDashboard';
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
import { authService } from './services/auth.service';
import './App.css';

const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return authService.isAuthenticated() ? <>{children}</> : <Navigate to="/login" />;
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
        {/* Fallback route - redirect to landing page if route not found */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
};

export default App;

