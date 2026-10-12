### Decided by the file-split builder, 2026-10-11, lightly held (splitting a class across files)

- Decided by the file-split builder, 2026-10-11, lightly held: a big class (`Counterpart`, `McpServer`, `Store`)
  is split by moving a method's BODY into a free function in a sibling part file, `export function name(cp:
  Counterpart, …params)` (`server: McpServer`, `store: Store`), and leaving the method on the class as a one-line
  delegate with the same name, modifiers, parameter types and return type: `return boundaryPart.name(this, …)`.
  The body is unchanged but for one rewrite: `this.x` becomes `cp.x`, or `cp["x"]` when `x` is private (or
  protected), and a bare `this` becomes `cp`. Why: TypeScript's bracket access to a private member is
  type-checked and leaves the class's declared surface as it was, where dropping `private` would have widened
  `Counterpart`'s and `Store`'s exported types (and `ReadOnlyStore`, which is `Omit<Store, …>` over the public
  members). The codebase had no pattern for this; its nearest, free functions taking `store: Store`
  (`mint.ts`, `reconsolidation.ts`), only ever use the public surface.
- Decided by the file-split builder, 2026-10-11, lightly held: a delegate drops `async` (the body keeps it, so
  the promise and its timing are the body's own), a defaulted parameter becomes optional on the delegate and keeps
  its default in the body (evaluated once, where it was), and a public method keeps its doc comment on the class
  while a private one's comment moves with its body. Section dividers (`// ── … ──`) stay on the class. Why: the
  class still documents what callers may call; how a body works is read beside the body.
- Decided by the file-split builder, 2026-10-11, lightly held: the parts holding class bodies are pinned to one
  importer each, their class's file (`test/split-parts.test.ts`). Why: the functions are exported so the class can
  import them, which also lets anyone who imports a part call a PRIVATE body (`Counterpart`'s deposit) past the
  checks the public doors make first; the pin makes a second importer a decision rather than an import.
- Decided by the file-split builder, 2026-10-11, lightly held: in `Store`, only public read bodies moved. Every
  write method stays whole in `store/index.ts` (the `WRITE_METHODS` totality test reads its `this.mutate` sites from
  that file), as do `embedOne`, `today` and `dateOf`, which tests read there, and no private method's body moved:
  those are the store's internals (its raw insert, its transaction seam, its deny-list check), and nothing outside
  the class should be able to import one. So
  `store/index.ts` lands at about 218 KiB rather than the ~200 aimed for.
