// S3 / MinIO ObjectStorage 实现（国内自托管）。
//
// 通过最小化客户端接口 `S3ClientLike`（put/get/delete）访问对象存储，可在测试中注入
// 假客户端；真实部署时用 `createAwsS3Client()`（懒加载 @aws-sdk/client-s3）提供该接口，
// 或改用 MinIO SDK 实现同一接口。适配器逻辑（含 get 缺失返回 null）与 SDK 无关，可单测。

export function createS3Storage({ bucket, client }) {
  if (!bucket || !client) throw new Error("createS3Storage 需要 bucket 与 client");
  return {
    async put(key, value, options) {
      await client.put(bucket, key, value, options);
    },
    async get(key) {
      const object = await client.get(bucket, key);
      if (!object) return null;
      return { body: object.body, contentType: object.contentType, metadata: object.metadata };
    },
    async delete(key) {
      await client.delete(bucket, key);
    },
  };
}

// 真实 S3 客户端工厂：懒加载 @aws-sdk/client-s3，把 S3 SDK 适配为 S3ClientLike。
// 读取环境变量（AWS_* / S3_ENDPOINT / S3_REGION）初始化，配合 deploy/docker-compose.yml 使用。
export async function createAwsS3Client() {
  const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = await import("@aws-sdk/client-s3");
  const s3 = new S3Client({});
  return {
    async put(bucket, key, body, options) {
      await s3.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: options?.contentType,
        Metadata: options?.metadata,
      }));
    },
    async get(bucket, key) {
      try {
        const result = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        return { body: result.Body, contentType: result.ContentType, metadata: result.Metadata };
      } catch (error) {
        if (error?.name === "NoSuchKey" || error?.$metadata?.httpStatusCode === 404) return null;
        throw error;
      }
    },
    async delete(bucket, key) {
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
  };
}
