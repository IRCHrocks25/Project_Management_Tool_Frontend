import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'https://projectmanagementtoolbackend-production.up.railway.app';

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };
};

export interface DepartmentProjectFocusRow {
  id: string;
  focusDate: string;
  departmentKey: string;
  sortOrder: number;
  notes: string | null;
  taskId: string | null;
  taskTitle: string | null;
  projectId: string | null;
  clientName: string;
  stage: string;
  pmName: string | null;
  /** pm = set by PM/Head PM; override = team lead add-ons */
  source?: 'pm' | 'override';
}

/**
 * GET merged list (PM priorities + team add-ons).
 * PUT /department-project-focus — PM / Head PM only (canonical list).
 * PUT /department-project-focus/team-override — team lead (or PM) for add-ons only.
 */
export const departmentProjectFocusService = {
  async getByDateAndDepartment(date: string, departmentKey: string): Promise<DepartmentProjectFocusRow[]> {
    const params = new URLSearchParams({ date, departmentKey });
    const res = await axios.get(`${API_URL}/department-project-focus?${params.toString()}`, getAuthHeaders());
    return res.data;
  },

  async savePmPins(date: string, departmentKey: string, taskIds: string[]): Promise<DepartmentProjectFocusRow[]> {
    const res = await axios.put(
      `${API_URL}/department-project-focus`,
      { date, departmentKey, taskIds },
      getAuthHeaders()
    );
    return res.data;
  },

  async saveTeamOverride(date: string, departmentKey: string, taskIds: string[]): Promise<DepartmentProjectFocusRow[]> {
    const res = await axios.put(
      `${API_URL}/department-project-focus/team-override`,
      { date, departmentKey, taskIds },
      getAuthHeaders()
    );
    return res.data;
  },
};
