import { test } from "node:test";
import assert from "node:assert/strict";
import { meetingReportTransition, meetingRoundTransition, venueTimeLabel, venueTransition } from "../app/office-service/state-machines.ts";

const applicant = { role: "leader", department: "科创中心", username: "leader" };
const office = { role: "leader", department: "办公室", username: "office" };

test("场地申请按申请人提交、办公室办理、成功后归档", () => {
  assert.equal(venueTransition("草稿", "submit", applicant, "leader"), "待办公室审核");
  assert.equal(venueTransition("待办公室审核", "process", office, "leader"), "办理中");
  assert.equal(venueTransition("办理中", "success", office, "leader"), "借用成功");
  assert.equal(venueTransition("借用成功", "archive", office, "leader"), "已归档");
  assert.throws(() => venueTransition("待办公室审核", "process", applicant, "leader"), /办公室/);
});

test("例会通报由办公室发起，部门负责人提交，办公室确认", () => {
  assert.equal(meetingRoundTransition("草稿", "publish", office), "收集中");
  assert.equal(meetingReportTransition("未填写", "save", { ...applicant, role: "staff" }, "科创中心"), "草稿");
  assert.throws(() => meetingReportTransition("草稿", "submit", { ...applicant, role: "staff" }, "科创中心"), /负责人/);
  assert.equal(meetingReportTransition("草稿", "submit", applicant, "科创中心"), "已提交");
  assert.equal(meetingReportTransition("已提交", "confirm", office, "科创中心"), "已确认");
});

test("实际借用时间派生待使用、使用中和已结束", () => {
  assert.equal(venueTimeLabel("2026-11-01", "09:00", "10:00", new Date("2026-11-01T08:00:00")), "待使用");
  assert.equal(venueTimeLabel("2026-11-01", "09:00", "10:00", new Date("2026-11-01T09:30:00")), "使用中");
  assert.equal(venueTimeLabel("2026-11-01", "09:00", "10:00", new Date("2026-11-01T11:00:00")), "已结束");
});
