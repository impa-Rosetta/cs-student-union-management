import { getDb } from "./db.ts";

const db = getDb();
let schemaPromise: Promise<void> | null = null;

export type TaskDependency = { id: number; predecessorTaskId: number; successorTaskId: number; dependencyType: "finish_to_start"; createdBy: string; createdAt: string };
type Row = { id: number; predecessor_task_id: number; successor_task_id: number; dependency_type: "finish_to_start"; created_by: string; created_at: string };

async function prepareSchema() {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS task_dependencies (
      id INTEGER PRIMARY KEY AUTOINCREMENT, predecessor_task_id INTEGER NOT NULL, successor_task_id INTEGER NOT NULL,
      dependency_type TEXT NOT NULL DEFAULT 'finish_to_start', created_by TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(predecessor_task_id, successor_task_id)
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_task_dependencies_successor ON task_dependencies(successor_task_id)"),
  ]);
}

export function ensureTaskDependencySchema() {
  if (!schemaPromise) schemaPromise = prepareSchema().catch((error) => { schemaPromise = null; throw error; });
  return schemaPromise;
}

function toEntity(row: Row): TaskDependency {
  return { id: row.id, predecessorTaskId: row.predecessor_task_id, successorTaskId: row.successor_task_id, dependencyType: row.dependency_type, createdBy: row.created_by, createdAt: row.created_at };
}

export async function listTaskDependencies(): Promise<TaskDependency[]> {
  await ensureTaskDependencySchema();
  const rows = await db.prepare("SELECT * FROM task_dependencies ORDER BY id").all<Row>();
  return (rows.results || []).map(toEntity);
}

export async function createTaskDependency(predecessorTaskId: number, successorTaskId: number, createdBy: string) {
  await ensureTaskDependencySchema();
  if (predecessorTaskId === successorTaskId) throw new Error("任务不能依赖自身");
  const dependencies = await listTaskDependencies();
  const edges = new Map<number, number[]>();
  for (const item of dependencies) edges.set(item.predecessorTaskId, [...(edges.get(item.predecessorTaskId) || []), item.successorTaskId]);
  edges.set(predecessorTaskId, [...(edges.get(predecessorTaskId) || []), successorTaskId]);
  const visited = new Set<number>();
  const reaches = (current: number): boolean => {
    if (current === predecessorTaskId) return true;
    if (visited.has(current)) return false;
    visited.add(current);
    return (edges.get(current) || []).some(reaches);
  };
  visited.add(predecessorTaskId);
  if ((edges.get(successorTaskId) || []).some(reaches)) throw new Error("该依赖会形成循环，不能保存");
  await db.prepare("INSERT INTO task_dependencies (predecessor_task_id, successor_task_id, created_by) VALUES (?, ?, ?)")
    .bind(predecessorTaskId, successorTaskId, createdBy).run();
}

export async function removeTaskDependency(id: number) {
  await ensureTaskDependencySchema();
  await db.prepare("DELETE FROM task_dependencies WHERE id = ?").bind(id).run();
}

export async function listIncompletePredecessors(successorTaskId: number): Promise<Array<{ id: number; title: string; status: string }>> {
  await ensureTaskDependencySchema();
  const rows = await db.prepare(`SELECT tasks.id,tasks.title,tasks.status FROM task_dependencies
    JOIN tasks ON tasks.id = task_dependencies.predecessor_task_id
    WHERE task_dependencies.successor_task_id = ? AND tasks.status <> '已完成' ORDER BY tasks.id`)
    .bind(successorTaskId).all<{ id: number; title: string; status: string }>();
  return rows.results || [];
}

