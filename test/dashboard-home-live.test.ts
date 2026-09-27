/**
 * The home tab refreshes live and closes nothing — in a real browser, run in a
 * child process. The scenario and its assertions are `test/live/dashboard-home.live.ts`;
 * why a child, `test/live/harness.ts`.
 */
import { liveScenario } from "./live/harness.js";

liveScenario({
  label: "dashboard-home-live",
  title: "the home tab, live > a poll after the store moves redraws the counts, feeds only memory events, and closes nothing",
  scenario: "dashboard-home.live.ts",
});
