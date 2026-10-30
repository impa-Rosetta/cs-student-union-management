import { strToU8, zipSync } from "fflate";

export type MeetingExportReport = {
  department: string;
  lastWeek: string;
  thisWeek: string;
  noticeCount: number;
  mediaCount: number;
  emailReceived: number;
  emailSent: number;
  meetingAttendance: number;
  meetingDuration: string;
  unplannedWorkload: string;
};

const xml = (value: unknown) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const p = (text: unknown, bold = false, size = 18) => `<w:p><w:pPr><w:spacing w:after="80"/></w:pPr><w:r><w:rPr>${bold ? "<w:b/>" : ""}<w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr><w:t xml:space="preserve">${xml(text)}</w:t></w:r></w:p>`;
const cell = (content: string, width: number, options = "") => `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${options}</w:tcPr>${content}</w:tc>`;
const row = (cells: string, keep = false) => `<w:tr>${keep ? "<w:trPr><w:cantSplit/></w:trPr>" : ""}${cells}</w:tr>`;

function departmentTable(report: MeetingExportReport) {
  const metrics = [
    ["通知发文数", report.noticeCount],
    ["新媒体发布数", report.mediaCount],
    ["公邮收/发数", `${report.emailReceived}/${report.emailSent}`],
    ["部门例会人数/时长", `${report.meetingAttendance}人 / ${report.meetingDuration || "0小时"}`],
    ["计划外工作量", report.unplannedWorkload || "无"],
  ];
  const metricRows = metrics.map(([label, value], index) => row(
    `${cell(index === 0 ? p(report.lastWeek || "无") : "", 2350, index === 0 ? '<w:vMerge w:val="restart"/>' : "<w:vMerge/>")}` +
    `${cell(index === 0 ? p(report.thisWeek || "无") : "", 2350, index === 0 ? '<w:vMerge w:val="restart"/>' : "<w:vMerge/>")}` +
    `${cell(p(label, true, 16), 1850)}${cell(p(value, false, 16), 1150)}`,
  )).join("");
  const inner = `<w:tbl><w:tblPr><w:tblW w:w="7700" w:type="dxa"/><w:tblBorders><w:top w:val="single" w:sz="6"/><w:left w:val="single" w:sz="6"/><w:bottom w:val="single" w:sz="6"/><w:right w:val="single" w:sz="6"/><w:insideH w:val="single" w:sz="4"/><w:insideV w:val="single" w:sz="4"/></w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="2350"/><w:gridCol w:w="2350"/><w:gridCol w:w="1850"/><w:gridCol w:w="1150"/></w:tblGrid>${row(`${cell(p("上周工作汇报", true), 2350)}${cell(p("本周工作安排", true), 2350)}${cell(p("数据周报", true), 3000, '<w:gridSpan w:val="2"/>')}`, true)}${metricRows}</w:tbl>`;
  return `<w:tbl><w:tblPr><w:tblW w:w="7700" w:type="dxa"/><w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/></w:tblBorders></w:tblPr>${row(cell(`${p(report.department, true, 24)}${inner}${p("", false, 8)}`, 7700), true)}</w:tbl>`;
}

export function buildMeetingDocx(title: string, reports: MeetingExportReport[]) {
  const body = reports.map(departmentTable).join("") || p("本轮暂无已提交的部门通报。", false, 22);
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${p(title, true, 32)}${p(`生成时间：${new Date().toLocaleString("zh-CN", { hour12: false })}`, false, 18)}${body}<w:sectPr><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/><w:pgMar w:top="567" w:right="567" w:bottom="567" w:left="567" w:header="360" w:footer="360"/><w:cols w:num="2" w:space="360"/></w:sectPr></w:body></w:document>`;
  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`),
    "_rels/.rels": strToU8(`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`),
    "word/document.xml": strToU8(documentXml),
    "docProps/core.xml": strToU8(`<?xml version="1.0" encoding="UTF-8"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${xml(title)}</dc:title><dc:creator>计算学院学生联盟管理系统</dc:creator></cp:coreProperties>`),
    "docProps/app.xml": strToU8(`<?xml version="1.0" encoding="UTF-8"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>计算学院学生联盟管理系统</Application></Properties>`),
  };
  return zipSync(files, { level: 6 });
}
