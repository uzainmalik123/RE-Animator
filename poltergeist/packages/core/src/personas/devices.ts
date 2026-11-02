/**
 * Fixed device presets a persona may run on (F16, D-44). The runner applies them to every actor's
 * context; the LLM never picks a viewport or CPU rate. Network speed stays the DSL `throttle` step.
 */
export const DEVICE_IDS = Object.freeze(['small-slow'] as const);

export type DeviceId = (typeof DEVICE_IDS)[number];

export type DevicePreset = {
  readonly id: DeviceId;
  readonly viewport: { readonly width: number; readonly height: number };
  readonly isMobile: boolean;
  readonly hasTouch: boolean;
  /** CDP `Emulation.setCPUThrottlingRate`: 4 means four times slower. */
  readonly cpuSlowdown: number;
  /** Shown in reports next to a `usable` failure. */
  readonly label: string;
};

const DEVICES: ReadonlyMap<DeviceId, DevicePreset> = new Map([
  [
    'small-slow',
    Object.freeze({
      id: 'small-slow',
      viewport: Object.freeze({ width: 360, height: 640 }),
      isMobile: true,
      hasTouch: true,
      cpuSlowdown: 4,
      label: '360×640 phone, 4× slower CPU',
    }),
  ],
]);

export function getDevice(id: DeviceId): DevicePreset {
  const d = DEVICES.get(id);
  if (!d) throw new TypeError(`unknown device: ${String(id)}`);
  return d;
}
