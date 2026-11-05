export type SupervisionScheduleState = "unscheduled" | "not-started" | "active" | "due-soon" | "overdue" | "done" | "risk";

export type SupervisionAttachment = { key: string; name: string; size?: number; type?: string };

export type SupervisionNode = {
  id: string | number;
  entityType: "activity" | "task" | "subtask";
  title: string;
  department: string;
  assignee: string;
  status: string;
  description: string;
  start: string;
  end: string;
  deadline: string;
  progress: number;
  scheduleState: SupervisionScheduleState;
  attachments: SupervisionAttachment[];
  completionNote: string;
  children: SupervisionNode[];
};

export type SupervisionEvent = {
  id: number;
  entityType: string;
  entityId: string;
  entityTitle: string;
  action: string;
  actionLabel: string;
  fromStatus: string;
  toStatus: string;
  actorName: string;
  actorRole: string;
  reason: string;
  createdAt: string;
};

export type ActivitySupervisionSummary = {
  taskCount: number;
  subtaskCount: number;
  leafCount: number;
  completedLeafCount: number;
  progress: number;
  overdueCount: number;
  dueSoonCount: number;
  unscheduledCount: number;
};

export type ActivitySupervisionDetail = {
  activity: Record<string, unknown> & { id: string; name: string };
  summary: ActivitySupervisionSummary;
  range: { start: string; end: string };
  tasks: SupervisionNode[];
  events: SupervisionEvent[];
};

export type ActivitySupervisionCard = {
  id: string;
  name: string;
  category: string;
  state: string;
  date: string;
  time: string;
  location: string;
  organizer: string;
  departments: string[];
  progress: number;
  taskCount: number;
  completedLeafCount: number;
  leafCount: number;
  overdueCount: number;
  dueSoonCount: number;
  unscheduledCount: number;
  nextDeadline: string;
};

export type SupervisionOverview = {
  stats: {
    activityCount: number;
    activeActivityCount: number;
    overdueTaskCount: number;
    dueSoonTaskCount: number;
  };
  departments: string[];
  activities: ActivitySupervisionCard[];
};
