import test from "node:test";
import assert from "node:assert/strict";
import { platformIdentityFromHeaders } from "../app/platform-identity.ts";

test("accepts Sites identity when only email and name are supplied", () => {
  const identity = platformIdentityFromHeaders(new Headers({
    "oai-authenticated-user-email": " Owner@Example.COM ",
    "oai-authenticated-user-full-name": "%E5%BE%90%E4%BB%8B%E7%BF%B0",
  }));

  assert.deepEqual(identity, {
    externalUserId: "email:owner@example.com",
    email: "owner@example.com",
    fullName: "徐介翰",
  });
});

test("prefers the platform user id when present", () => {
  const identity = platformIdentityFromHeaders(new Headers({
    "oai-authenticated-user-id": "account-123",
    "oai-authenticated-user-email": "owner@example.com",
  }));

  assert.equal(identity?.externalUserId, "account-123");
});

test("rejects requests without an authenticated email", () => {
  assert.equal(platformIdentityFromHeaders(new Headers()), null);
});
