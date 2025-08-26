declare module "*.svg" {
  const src: string;
  export default src;
}

declare module "*.png" {
  const src: string;
  export default src;
}

declare module "classnames" {
  export default function cx(...args: Array<string | number | false | null | undefined | Record<string, boolean>>): string;
}

// Allow process.env usage in browser code under Node types
declare const process: {
  env: Record<string, string | undefined>;
};

// Fallback stubs for path aliases used in admin code during app-only typecheck
declare module "@lib/*" {
  const mod: unknown;
  export = mod;
}

declare module "@lib/prefs" {
  export type ViewMode = 'calendar' | 'board';
  export function getViewMode(): ViewMode;
  export function setViewMode(mode: ViewMode): void;
}

declare module "@lib/api" {
  export function handleApiError(...args: unknown[]): unknown;
  export function isOnline(): boolean;
  export function updateAppointmentStatus(id: string, status: unknown): unknown;
  export function login(username: string, password: string): Promise<unknown>;
  export const http: {
    get: (...args: unknown[]) => Promise<unknown>;
    post: (...args: unknown[]) => Promise<unknown>;
    put: (...args: unknown[]) => Promise<unknown>;
    patch: (...args: unknown[]) => Promise<unknown>;
    delete: (...args: unknown[]) => Promise<unknown>;
  };
}

declare module "@lib/utils" {
  export function parseDurationToMinutes(s: string): number;
}

declare module "@lib/quickAddUtils" {
  export function saveLastQuickAdd(payload: unknown): void;
}
