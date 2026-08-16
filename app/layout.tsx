import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "学生联盟管理系统 | 计算学院",
  description: "计算学院学生联盟活动、任务、资料与组织成员管理系统。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
