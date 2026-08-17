import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "../app/password.ts";

test("密码哈希与校验", async () => {
  const stored = await hashPassword("123456");
  assert.equal(typeof stored, "string");
  assert.match(stored, /^[0-9a-f]+:[0-9a-f]+$/);

  assert.equal(await verifyPassword("123456", stored), true);
  assert.equal(await verifyPassword("wrong", stored), false);
});

test("相同密码每次产生不同哈希（随机盐）", async () => {
  const a = await hashPassword("123456");
  const b = await hashPassword("123456");
  assert.notEqual(a, b);
  assert.equal(await verifyPassword("123456", a), true);
  assert.equal(await verifyPassword("123456", b), true);
});
