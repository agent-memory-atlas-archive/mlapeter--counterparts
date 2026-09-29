/**
 * THE HOOK ENVELOPE'S SHAPE, in one place (2026-09-29, review of #285, S2).
 *
 * `bin/hook.ts#hostDelivery` prints it, and `hooks.ts` measures it BEFORE it
 * decides which asks go beside the wake — so the two cannot disagree about how
 * big the JSON form of an envelope is. A person-facing line (a plain reminder,
 * a doctor notice) reaches the terminal only inside this JSON form, whose
 * budget is `TUNABLES.ENVELOPE_CHARS`; everything else is measured as plain
 * stdout against `TUNABLES.HOST_OUTPUT_CHARS`.
 */

/**
 * The host's own spelling of the event that carries a notice at a session's
 * start. It appears twice — as a key in the hook's event map, and as
 * `hookSpecificOutput.hookEventName` in the JSON form — and the host matches
 * that field against its own name, so the two spellings must be one constant.
 */
export const HOST_SESSION_START = "SessionStart";

/** The same, for a prompt (the update notice, plain reminders, the dream offer). */
export const HOST_USER_PROMPT_SUBMIT = "UserPromptSubmit";

/** The JSON form of an envelope: the person's line(s) and the model's context. */
export function envelopeJson(hookEventName: string, systemMessage: string, additionalContext: string): string {
  return JSON.stringify({
    systemMessage,
    hookSpecificOutput: { hookEventName, additionalContext },
  });
}

/**
 * What `text` costs inside the JSON form, in bytes: its escaped length (a
 * newline is two characters, a quote two). Bytes, so the count is never under
 * the characters the host measures.
 */
export function escapedBytes(text: string): number {
  return Buffer.byteLength(JSON.stringify(text), "utf8") - 2;
}
