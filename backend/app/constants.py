PROJECT_TYPES = ["Academic Project", "Mini Project", "Major Project", "Final Year Project", "Research Project", "Internship Project", "Hackathon Project", "Other"]
PROJECT_STATUSES = ["Planning", "Not Started", "In Progress", "On Hold", "Completed", "Cancelled"]
PRIORITIES = ["Low", "Medium", "High", "Critical"]
TASK_STATUSES = ["Todo", "In Progress", "Review", "Done"]
TASK_TYPES = ["Development", "Design", "Research", "Testing", "Documentation", "Meeting", "Other"]
MILESTONE_STATUSES = ["Pending", "In Progress", "Completed"]
ROLES = ["Project Owner", "Project Manager", "Team Lead", "Developer", "Designer", "Researcher", "Tester", "Student", "Mentor", "Viewer"]
REVIEW_STAGES = ["Review 1", "Review 2", "Review 3", "Final Review"]
DOC_FOLDERS = ["Requirements", "Design", "Reports", "Presentations", "Other"]
EVENT_TYPES = ["meeting", "review", "submission"]
NOTIFICATION_TYPES = ["deadline", "assigned", "project_deadline", "comment", "completed", "milestone", "document", "review"]
TECH_OPTIONS = ["Python", "FastAPI", "React", "JavaScript", "HTML", "CSS", "Bootstrap", "Tailwind CSS", "PostgreSQL", "MySQL", "MongoDB", "Machine Learning", "AI", "Docker", "AWS", "Other"]

# Project-level permission groups (from the spec's permissions section)
MANAGER_ROLES = {"Project Owner", "Project Manager", "Team Lead"}
READ_ONLY_ROLES = {"Viewer", "Mentor"}  # mentors can additionally create reviews
