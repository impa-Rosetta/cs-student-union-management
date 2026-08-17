// Self-contained ambient types for the `cloudflare:workers` virtual module that
// @cloudflare/vite-plugin injects at build time, plus the narrow runtime types
// (D1 / R2 / Fetcher) the app and Drizzle rely on.
//
// We intentionally do NOT reference `@cloudflare/workers-types` globally: that
// package overrides browser globals (Response / Headers / fetch) with Workers
// versions, which would break the client components' DOM types. These
// declarations model only the subset this application actually uses.

declare interface D1Result<T = unknown> {
  results: T[];
  success: boolean;
  meta: Record<string, unknown>;
  error?: string;
}

declare interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  all<T = unknown>(): Promise<D1Result<T>>;
  run(): Promise<D1Result>;
  raw<T = unknown>(options?: { columnNames?: boolean }): Promise<T[]>;
}

declare interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<D1Result>;
  dump(): Promise<ArrayBuffer>;
}

declare interface R2HTTPMetadata {
  contentType?: string;
  cacheControl?: string;
  contentEncoding?: string;
  contentLanguage?: string;
  contentDisposition?: string;
}

declare interface R2PutOptions {
  httpMetadata?: R2HTTPMetadata;
  customMetadata?: Record<string, string>;
}

declare interface R2Object {
  key: string;
  version: string;
  size: number;
  etag: string;
  httpEtag: string;
  uploaded: Date;
  httpMetadata: R2HTTPMetadata;
  customMetadata: Record<string, string>;
  writeHttpMetadata(headers: Headers): void;
}

declare interface R2ObjectBody extends R2Object {
  body: ReadableStream;
  bodyUsed: boolean;
  arrayBuffer(): Promise<ArrayBuffer>;
  text(): Promise<string>;
  json<T>(): Promise<T>;
}

declare interface R2Bucket {
  put(
    key: string,
    value: ReadableStream | ArrayBuffer | ArrayBufferView | string | null | Blob,
    options?: R2PutOptions,
  ): Promise<R2Object>;
  get(key: string): Promise<R2ObjectBody | null>;
  head(key: string): Promise<R2Object | null>;
  delete(key: string | string[]): Promise<void>;
}

declare interface Fetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

declare module "cloudflare:workers" {
  export const env: {
    DB: D1Database;
    FILES: R2Bucket;
  };
}
