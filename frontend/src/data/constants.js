// Fixed option lists from academic_project_management_system.yaml (same values the API validates).

export const PROJECT_TYPES = ['Academic Project', 'Mini Project', 'Major Project', 'Final Year Project', 'Research Project', 'Internship Project', 'Hackathon Project', 'Other']
export const PROJECT_STATUSES = ['Planning', 'Not Started', 'In Progress', 'On Hold', 'Completed', 'Cancelled']
export const PRIORITIES = ['Low', 'Medium', 'High', 'Critical']
export const TASK_STATUSES = ['Todo', 'In Progress', 'Review', 'Done']
export const TASK_TYPES = ['Development', 'Design', 'Research', 'Testing', 'Documentation', 'Meeting', 'Other']
export const TECH_OPTIONS = ['Python', 'FastAPI', 'React', 'JavaScript', 'HTML', 'CSS', 'Bootstrap', 'Tailwind CSS', 'PostgreSQL', 'MySQL', 'MongoDB', 'Machine Learning', 'AI', 'Docker', 'AWS', 'Other']
export const REVIEW_STAGES = ['Review 1', 'Review 2', 'Review 3', 'Final Review']
export const DOC_FOLDERS = ['Requirements', 'Design', 'Reports', 'Presentations', 'Other']
export const REVIEW_CRITERIA = [
  { key: 'technical', label: 'Technical Implementation' },
  { key: 'documentation', label: 'Documentation' },
  { key: 'innovation', label: 'Innovation' },
  { key: 'presentation', label: 'Presentation' },
  { key: 'team', label: 'Team Contribution' },
]

export const ROLES = [
  { name: 'Project Owner', description: 'Full control over the project.', tone: 'primary' },
  { name: 'Project Manager', description: 'Manages tasks, members, milestones, and reports.', tone: 'pink' },
  { name: 'Team Lead', description: 'Coordinates team members and technical work.', tone: 'sky' },
  { name: 'Developer', description: 'Works on development tasks.', tone: 'mint' },
  { name: 'Designer', description: 'Works on UI/UX and design tasks.', tone: 'peach' },
  { name: 'Researcher', description: 'Handles research and analysis.', tone: 'sun' },
  { name: 'Tester', description: 'Handles testing and quality checks.', tone: 'rose' },
  { name: 'Student', description: 'Works on assigned academic tasks.', tone: 'sky' },
  { name: 'Mentor', description: 'Reviews project progress and provides feedback.', tone: 'primary' },
  { name: 'Viewer', description: 'Read-only project access.', tone: 'muted' },
]

export const PERMISSIONS = {
  Owner: ['Create projects', 'Delete projects', 'Add members', 'Remove members', 'Assign tasks', 'Manage deadlines', 'View reports', 'Manage permissions'],
  Manager: ['Manage tasks', 'Assign members', 'Update milestones', 'View reports'],
  Member: ['View assigned projects', 'Update assigned tasks', 'Upload files', 'Add comments', 'Update progress'],
  Viewer: ['View projects', 'View progress', 'View documents'],
}
