/** The Haunting Plan DSL step vocabulary (design §6). F05 builds its zod enum from this list. */
export const STEP_TYPES = Object.freeze([
  'goto', 'click', 'dblclick', 'fill', 'press', 'back', 'reload', 'wait', 'throttle',
  'barrier', 'holdRequests', 'releaseRequests', 'login', 'logout', 'focus',
] as const);

export type StepType = (typeof STEP_TYPES)[number];

/** Keys a `press` step may use. A persona's `keys` narrows this (F20, D-48). */
export const PRESS_KEYS = Object.freeze([
  'Enter', 'Tab', 'Escape', 'Space', 'Backspace', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
] as const);
export type PressKey = (typeof PRESS_KEYS)[number];
