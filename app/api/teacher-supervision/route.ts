import { listActivities } from "../../activity-store.ts";
import { authErrorResponse, requireRole } from "../../server-auth.ts";
import { listAllSubtasks, listAllTasks } from "../../task-store.ts";
import { buildActivitySupervision, buildSupervisionOverview } from "../../teacher-supervision/service.ts";
import { listWorkflowEvents } from "../../workflow-events.ts";
import { listActivityServiceWorkItems } from "../../work-management/store.ts";

export async function GET(request: Request) {
  try {
    await requireRole(request, ["teacher", "admin", "chair"]);
    const [activities, tasks, subtasks, events, services] = await Promise.all([
      listActivities(),
      listAllTasks(),
      listAllSubtasks(),
      listWorkflowEvents(1000),
      listActivityServiceWorkItems(),
    ]);
    const activityId = new URL(request.url).searchParams.get("activityId");
    if (!activityId) {
      return Response.json({ overview: buildSupervisionOverview(activities as never[], tasks as never[], subtasks as never[], events as never[], new Date(), services) });
    }
    const activity = activities.find((item) => item.id === activityId);
    if (!activity) return Response.json({ error: "活动不存在" }, { status: 404 });
    return Response.json({ detail: buildActivitySupervision(activity as never, activities as never[], tasks as never[], subtasks as never[], events as never[], new Date(), services) });
  } catch (error) {
    return authErrorResponse(error, "读取活动监管数据失败");
  }
}
