import React from 'react';
import { authService } from '../services/auth.service';
import FounderDashboard from './dashboards/FounderDashboard';
import PMDashboard from './dashboards/PMDashboard';
import CopyDashboard from './dashboards/CopyDashboard';
import DesignerDashboard from './dashboards/DesignerDashboard';
import DeveloperDashboard from './dashboards/DeveloperDashboard';
import AIDeveloperDashboard from './dashboards/AIDeveloperDashboard';
import SocialMediaDashboard from './dashboards/SocialMediaDashboard';
import CRMDashboard from './dashboards/CRMDashboard';
import SEODashboard from './dashboards/SEODashboard';

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
      return <CopyDashboard />;
    case 'Designer':
      return <DesignerDashboard />;
    case 'Developer':
      return <DeveloperDashboard />;
    case 'AI Developer':
      return <AIDeveloperDashboard />;
    case 'Social Media':
      return <SocialMediaDashboard />;
    case 'CRM':
      return <CRMDashboard />;
    case 'SEO/GEO':
      return <SEODashboard />;
    default:
      return <PMDashboard />;
  }
};

export default RoleBasedDashboard;

