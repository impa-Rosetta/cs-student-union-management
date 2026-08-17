#!/usr/bin/env bash
# 备份脚本：PostgreSQL 逻辑备份 + 对象存储镜像。
# 用法：BACKUP_DIR=/data/backups KEEP_DAYS=30 ./scripts/backup.sh
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/union}"
KEEP_DAYS="${KEEP_DAYS:-30}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$BACKUP_DIR/db"

# 1) PostgreSQL 逻辑备份（pg_dump 自定义格式，便于恢复演练）
docker compose -f deploy/docker-compose.yml exec -T db \
  pg_dump -U union -d union -Fc > "$BACKUP_DIR/db/union-$TIMESTAMP.dump"

# 2) 对象存储：用 MinIO 客户端 mc 增量镜像到备份目录（需先 `mc alias set myminio ...`）
if command -v mc >/dev/null 2>&1; then
  mkdir -p "$BACKUP_DIR/files"
  mc mirror --overwrite myminio/files "$BACKUP_DIR/files" >/dev/null 2>&1 || \
    echo "警告：对象存储镜像失败，请检查 mc 配置"
else
  echo "提示：未安装 mc，跳过对象存储备份"
fi

# 3) 清理超过保留天数的数据库备份
find "$BACKUP_DIR/db" -name '*.dump' -mtime +"$KEEP_DAYS" -delete

echo "备份完成：$TIMESTAMP（数据库 + 对象存储）"
