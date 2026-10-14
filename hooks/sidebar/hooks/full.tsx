/**
 * The plugin's own build's hooks module: the sidebar (`register.tsx`) and the
 * speak-first (`speak-first.tsx`) in one, since a plugin loads one hooks
 * module (`hooks.json` "modules" takes one entry). The plugin directory's
 * build names `register.tsx` alone.
 */
import type { Register } from 'claude-code'

import { register as sidebar } from './register'
import { register as speakFirst } from './speak-first'

export const register: Register = (on, options) => {
  sidebar(on, options)
  speakFirst(on, options)
}
