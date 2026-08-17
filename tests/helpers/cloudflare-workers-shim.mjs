// Node 下对 `cloudflare:workers` 虚拟模块的运行时垫片。
//
// 业务存储模块通过 getDb() 访问数据库；测试用 setDb() 注入自定义实现，
// 因此这里的 env.DB / env.FILES 不会被真正使用，仅保证模块可被加载。

export const env = {
  DB: null,
  FILES: null,
};
