import React from 'react';
import { authService } from '../services/auth.service';
import FounderDashboard from './dashboards/FounderDashboard';
import PMDashboard from './dashboards/PMDashboard';
import RoleDashboard from './dashboards/RoleDashboard';

const RoleBasedDashboard: React.FC = () => {
  const user = authService.getUser();

  if (!user) {
    return <div>Loading...</div>;
  }

  const role = user.role;

  switch (role) {
    case 'FOUNDER/CEO':
      return <FounderDashboard />;
    case 'Project Manager':
      return <PMDashboard />;
    case 'Copy Writing':
    case 'Designer':
    case 'Developer':
    case 'AI Developer':
    case 'Social Media':
    case 'CRM':
    case 'SEO/GEO':
      return <RoleDashboard role={role} />;
    default:
      return <PMDashboard />;
  }
};

export default RoleBasedDashboard;

