// 部署适配层端口（Ports）。
//
// 目标：在国内云主机自托管时，用 Node / PostgreSQL / S3(MinIO) 实现替换
// Cloudflare 实现，业务层只依赖这些接口、不直接依赖 `cloudflare:workers`。
//
// 四个端口对应提示词 §十三：
//  - IdentityProvider：身份识别（平台身份头 → 用户）
//  - DatabaseRepository：关系数据访问
//  - ObjectStorage：附件对象存储
//  - NotificationService：通知投递与已读回执

export interface SqlStatement {
  bind(...values: unknown[]): SqlStatement;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}

export interface DatabaseRepository {
  prepare(sql: string): SqlStatement;
  batch(statements: SqlStatement[]): Promise<unknown[]>;
}

export interface StoredObject {
  body: ReadableStream | null;
  contentType?: string;
  metadata?: Record<string, string>;
}

export interface ObjectStorage {
  put(
    key: string,
    value: ReadableStream,
    options?: { contentType?: string; metadata?: Record<string, string> },
  ): Promise<unknown>;
  get(key: string): Promise<StoredObject | null>;
  delete(key: string): Promise<void>;
}

export interface IdentifiedUser {
  localMode: boolean;
  id: number;
  username: string;
  name: string;
  email: string;
  role: string;
  department: string;
  title: string;
  scope: string;
  active: boolean;
}

export interface IdentityProvider {
  currentUser(request: Request): Promise<IdentifiedUser | null>;
}

export interface NotificationRecordInput {
  recipientUsernames: string[];
  title: string;
  detail: string;
  level?: string;
  entity?: { type: string; id?: string | number; parentTaskId?: number };
}

export interface NotificationService {
  create(records: NotificationRecordInput[]): Promise<void>;
  listReadIds(username: string): Promise<string[]>;
  markRead(username: string, ids: string[]): Promise<void>;
}

export interface Platform {
  db: DatabaseRepository;
  storage: ObjectStorage;
  identity: IdentityProvider;
  notifications: NotificationService;
}
