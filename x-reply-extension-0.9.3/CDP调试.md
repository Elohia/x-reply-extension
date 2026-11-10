# CDP 调试台（常驻）

## 一条命令：常驻调试实例

```powershell
powershell -ExecutionPolicy Bypass -File tools\start-debug-chrome.ps1
# → CDP 就绪：http://127.0.0.1:9222
```

**它是常驻的**：用 WMI 起进程（父进程是 WmiPrvSE），关掉我的 shell 也不会跟着退。
挂掉/重启机器后再跑一次脚本即可。

| 项 | 值 |
|:--|:--|
| CDP 端口 | `http://127.0.0.1:9222` |
| profile | `tests\out\chrome-profile`（从你的 Chrome 默认 profile 复制，cookie 用 auth_token/ct0 注入） |
| 代理 | `--proxy-server=http://127.0.0.1:7890` |
| 装插件 | CDP `Extensions.loadUnpacked`（Chrome 137+ 已禁用 `--load-extension`） |

## 复用的验证脚本

```bash
node tests/cdp-session.mjs   # 连 9222 → 装插件 → 注 cookie → 打开 x.com/home
node tests/probe3.mjs        # 点 R → 点「填入回复框」→ 报告 编辑器长度 / 重复次数
node tests/shot.mjs          # 截图到 tests/out/live-fixed.png
```

最近一次实测（真实 x.com，Chrome 157）：

```
页面: {"url":"https://x.com/home","tweets":6,"buttons":6}
插件填入复验: {"draftLen":27,"editorLen":27,"hits":1}   ← 只有一份
```

## 已知坑（都已验证）

1. **Chrome 136+**：默认 profile 禁用 CDP → 调试实例必须用独立 user-data-dir。
2. **Chrome 137+**：`--load-extension` 失效 → 必须用 CDP `Extensions.loadUnpacked`。
3. **复制来的 profile** 带 `Default\LOCK` 会让 Chrome 静默退出 → 启动前删 Singleton*/LOCK。
4. **cookie 复制解不开**（App-Bound Encryption）→ 用环境变量里的 auth_token/ct0 通过 `Network.setCookie` 注入。
5. **X 编辑器写入**：`execCommand('insertText')` 必须用**折叠光标**（collapse 到末尾），不要先全选 ——
   全选状态下 X 会把同一段文本应用两次（实测 27 字变 54 字）。`beforeinput` / `paste` / `textInput` 三种事件都写不进去。
