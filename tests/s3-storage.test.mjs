// S3/MinIO ObjectStorage 适配器的单元测试（无需安装 SDK，注入假客户端）。

import { test } from "node:test";
import assert from "node:assert/strict";
import { createS3Storage } from "../platform/node-s3-storage.mjs";

function createFakeS3Client() {
  const objects = new Map();
  return {
    objects,
    async put(bucket, key, body, options) {
      objects.set(key, { bucket, body, contentType: options?.contentType, metadata: options?.metadata });
    },
    async get(bucket, key) {
      const object = objects.get(key);
      if (!object || object.bucket !== bucket) return null;
      return { body: object.body, contentType: object.contentType, metadata: object.metadata };
    },
    async delete(bucket, key) {
      objects.delete(key);
    },
  };
}

test("S3Storage：上传/读取/删除闭环", async () => {
  const client = createFakeS3Client();
  const storage = createS3Storage({ bucket: "files", client });

  const stream = new ReadableStream();
  await storage.put("tasks/a.txt", stream, { contentType: "text/plain", metadata: { originalName: "a.txt" } });
  assert.equal(client.objects.size, 1);

  const object = await storage.get("tasks/a.txt");
  assert.ok(object, "应能读取对象");
  assert.equal(object.contentType, "text/plain");
  assert.equal(object.metadata.originalName, "a.txt");

  await storage.delete("tasks/a.txt");
  assert.equal(await storage.get("tasks/a.txt"), null, "删除后应为 null");
});

test("S3Storage：读取不存在的对象返回 null", async () => {
  const storage = createS3Storage({ bucket: "files", client: createFakeS3Client() });
  assert.equal(await storage.get("missing/key"), null);
});

test("S3Storage：缺少 bucket 或 client 时抛错", () => {
  assert.throws(() => createS3Storage({ bucket: "files" }), /bucket 与 client/);
});
