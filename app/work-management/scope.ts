import type { AuthenticatedUser } from "../server-auth.ts";

type TaskLike = { id: number; department?: unknown; person?: unknown; activityId?: unknown; assigneeAccountId?: unknown };
type SubtaskLike = { id?: unknown; parentTaskId?: unknown; assignee?: unknown; assigneeAccountId?: unknown };
type ActivityLike = { id: string; name?: unknown; organizer?: unknown; departments?: unknown };
type ArchiveLike = { id?: unknown; owner?: unknown; activity?: unknown };
type NotificationLike = { id?: unknown; recipientUsernames?: unknown };

export type SharedStateInput<TTask, TSubtask, TActivity, TArchive, TNotification> = {
  tasks: TTask[];
  subtasks: TSubtask[];
  activities: TActivity[];
  archive: TArchive[];
  notifications: TNotification[];
};

export function scopeSharedState<
  TTask extends TaskLike,
  TSubtask extends SubtaskLike,
  TActivity extends ActivityLike,
  TArchive extends ArchiveLike,
  TNotification extends NotificationLike,
>(state: SharedStateInput<TTask, TSubtask, TActivity, TArchive, TNotification>, user: AuthenticatedUser) {
  const notifications = state.notifications.filter((item) =>
    Array.isArray(item.recipientUsernames) && item.recipientUsernames.map(String).includes(user.username),
  );

  if (["admin", "chair", "teacher"].includes(user.role)) {
    return { ...state, notifications };
  }

  let tasks: TTask[];
  let subtasks: TSubtask[];

  if (user.role === "leader") {
    tasks = state.tasks.filter((task) => String(task.department || "") === user.department || Number(task.assigneeAccountId) === user.id || String(task.person || "") === user.name);
    const taskIds = new Set(tasks.map((task) => task.id));
    subtasks = state.subtasks.filter((subtask) => taskIds.has(Number(subtask.parentTaskId)) || Number(subtask.assigneeAccountId) === user.id || String(subtask.assignee || "") === user.name);
  } else {
    const assignedSubtasks = state.subtasks.filter((subtask) => Number(subtask.assigneeAccountId) === user.id || String(subtask.assignee || "") === user.name);
    const parentIds = new Set(assignedSubtasks.map((subtask) => Number(subtask.parentTaskId)));
    tasks = state.tasks.filter((task) => Number(task.assigneeAccountId) === user.id || String(task.person || "") === user.name || parentIds.has(task.id));
    const visibleTaskIds = new Set(tasks.map((task) => task.id));
    subtasks = state.subtasks.filter((subtask) => (Number(subtask.assigneeAccountId) === user.id || String(subtask.assignee || "") === user.name) && visibleTaskIds.has(Number(subtask.parentTaskId)));
  }

  const visibleActivityIds = new Set(tasks.map((task) => String(task.activityId || "")).filter(Boolean));
  const activities = state.activities.filter((activity) => {
    const departments = Array.isArray(activity.departments) ? activity.departments.map(String) : [];
    return visibleActivityIds.has(activity.id) || String(activity.organizer || "") === user.department || departments.includes(user.department);
  });
  const visibleActivityNames = new Set(activities.map((activity) => String(activity.name || "")));
  const archive = state.archive.filter((item) =>
    String(item.owner || "") === user.name ||
    String(item.owner || "") === user.department ||
    visibleActivityNames.has(String(item.activity || "")),
  );

  return { tasks, subtasks, activities, archive, notifications };
}

