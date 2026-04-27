export const DEPARTMENTS = [
  'Design',
  'Copy Writing',
  'Development',
  'AI Team',
  'Social Media Team',
  'CRM',
  'SEO/GEO Team',
  'Onboarding',
] as const;

export type Department = typeof DEPARTMENTS[number];

export function taskTypeToDepartment(taskType: string): string {
  switch (taskType) {
    case 'Copy':         return 'Copy Writing';
    case 'Design':       return 'Design';
    case 'Dev':          return 'Development';
    case 'AI':           return 'AI Team';
    case 'Social Media': return 'Social Media Team';
    case 'CRM':          return 'CRM';
    case 'SEO/GEO':      return 'SEO/GEO Team';
    case 'Onboarding':   return 'Onboarding';
    default:             return taskType;
  }
}

export function filterUsersByDepartment(users: any[], department: Department | string): any[] {
  if (!department) return users;
  return users.filter((user) => {
    switch (department) {
      case 'Design': return user.role === 'Designer';
      case 'Copy Writing': return user.role === 'Copy Writing';
      case 'Development': return user.role === 'Developer';
      case 'AI Team': return user.role === 'AI Developer';
      case 'Social Media Team': return user.role === 'Social Media';
      case 'CRM': return user.role === 'CRM';
      case 'SEO/GEO Team': return user.role === 'SEO/GEO';
      case 'Onboarding': return user.role === 'Project Manager' || user.role === 'FOUNDER/CEO';
      default: return true;
    }
  });
}
