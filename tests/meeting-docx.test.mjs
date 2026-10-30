import { test } from "node:test";
import assert from "node:assert/strict";
import { strFromU8, unzipSync } from "fflate";
import { buildMeetingDocx } from "../app/office-service/meeting-docx.ts";

test("例会汇总生成横向 A4 双栏 Word，并包含多个部门表格", () => {
  const bytes = buildMeetingDocx("第十周学生联盟例会通报", [
    { department: "办公室", lastWeek: "完成材料收集", thisWeek: "筹备例会", noticeCount: 2, mediaCount: 0, emailReceived: 3, emailSent: 1, meetingAttendance: 6, meetingDuration: "1小时", unplannedWorkload: "临时统计" },
    { department: "科创中心", lastWeek: "竞赛报名", thisWeek: "机房测试", noticeCount: 1, mediaCount: 1, emailReceived: 2, emailSent: 2, meetingAttendance: 8, meetingDuration: "1.5小时", unplannedWorkload: "无" },
  ]);
  assert.equal(bytes[0], 0x50);
  assert.equal(bytes[1], 0x4b);
  const files = unzipSync(bytes);
  const documentXml = strFromU8(files["word/document.xml"]);
  assert.match(documentXml, /w:orient="landscape"/);
  assert.match(documentXml, /w:cols w:num="2"/);
  assert.match(documentXml, /办公室/);
  assert.match(documentXml, /科创中心/);
  assert.match(documentXml, /上周工作汇报/);
  assert.match(documentXml, /数据周报/);
});
