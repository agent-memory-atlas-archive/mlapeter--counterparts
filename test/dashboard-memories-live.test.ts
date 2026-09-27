/**
 * The memories tab refreshes live and closes nothing — in a real browser, run in
 * a child process. The scenario and its assertions are
 * `test/live/dashboard-memories.live.ts`; why a child is in
 * `test/dashboard-self-live.test.ts` and `test/live/harness.ts`.
 */
import { liveScenario } from "./live/harness.js";

liveScenario({
  label: "dashboard-memories-live",
  title: "the memories tab, live > a refresh through the pulse redraws the list and closes nothing",
  scenario: "dashboard-memories.live.ts",
});
