// 注册 Node 模块加载钩子：把 `cloudflare:workers` 虚拟模块重定向到本地垫片，
// 使依赖该模块的 .ts 文件能在纯 Node（type-stripping）下被导入与测试。
//
// 用法：node --import ./tests/helpers/register.mjs --test-isolation=none --test tests/*.test.mjs

import { registerHooks } from "node:module";

const shimUrl = new URL("./cloudflare-workers-shim.mjs", import.meta.url);

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "cloudflare:workers") {
      return { url: shimUrl.href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
