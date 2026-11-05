import { createContext } from 'react';
import { frameUrl } from './attack/attackClient';

// Where the attack scene finds the engine's frames: the backend live, the recording in a replay (R11).
export const FrameUrlContext = createContext<(attackId: string, ghostId: string, seq: number) => string>(frameUrl);
