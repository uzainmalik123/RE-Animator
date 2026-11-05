/// <reference types="vite/client" />

interface ImportMetaEnv {
  // R11: set by `vite build --mode replay` (.env.replay), so the hosted page opens the replay.
  readonly VITE_REPLAY?: string;
}
