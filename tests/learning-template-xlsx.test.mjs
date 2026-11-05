import { test } from "node:test";
import assert from "node:assert/strict";
import { strFromU8, unzipSync } from "fflate";
import { buildWhiteCardTemplate } from "../app/learning-department/template-xlsx.ts";

test("白卡 Excel 模板包含合并标题与学号姓名两列", () => {
  const files = unzipSync(buildWhiteCardTemplate());
  assert.ok(files["xl/workbook.xml"]);
  const sheet = strFromU8(files["xl/worksheets/sheet1.xml"]);
  assert.match(sheet, /日期＋星期＋白卡/);
  assert.match(sheet, /<t>学号<\/t>/);
  assert.match(sheet, /<t>姓名<\/t>/);
  assert.match(sheet, /mergeCell ref="A1:B1"/);
});
