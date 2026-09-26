/**
 * Can this machine launch playwright's chromium? Run by `harness.ts` in a child;
 * prints one JSON line: `{"ok":true}` or `{"ok":false,"why":"..."}`.
 */
try {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  await browser.close();
  console.log(JSON.stringify({ ok: true }));
} catch (err) {
  const why = err instanceof Error ? (err.message.split("\n")[0] ?? String(err)) : String(err);
  console.log(JSON.stringify({ ok: false, why }));
}
