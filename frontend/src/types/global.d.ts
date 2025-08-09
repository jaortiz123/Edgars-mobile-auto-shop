declare module "*.svg" {
  const src: string;
  export default src;
}

declare module "*.png" {
  const src: string;
  export default src;
}

declare module "classnames" {
  export default function cx(...args: any[]): string;
}

// Allow process.env usage in browser code under Node types
declare let process: {
  env: Record<string, string | undefined>;
};

// Fallback stubs for path aliases used in admin code during app-only typecheck
declare module "@lib/*" {
  const mod: any;
  export = mod;
}

declare module "@lib/prefs" {
  export type ViewMode = 'calendar' | 'board';
  export function getViewMode(): ViewMode;
  export function setViewMode(mode: ViewMode): void;
}

declare module "@lib/api" {
  export function handleApiError(...args: any[]): any;
  export function isOnline(): boolean;
  export function updateAppointmentStatus(id: string, status: any): any;
  export function login(username: string, password: string): Promise<any>;
}

declare module "@lib/utils" {
  export function parseDurationToMinutes(s: string): number;
}

declare module "@lib/quickAddUtils" {
  export function saveLastQuickAdd(payload: any): void;
}


