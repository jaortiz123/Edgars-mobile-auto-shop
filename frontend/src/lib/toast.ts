// filepath: frontend/src/lib/toast.ts

let pushFn: (m: { kind: 'success'|'error'|'info'; text: string; key?: string }) => void = () => {};
export function setToastPush(fn: typeof pushFn) {
  pushFn = fn;
}

export const toast = {
  success: (text: string, opts?: { key?: string }) => pushFn({ kind: 'success', text, key: opts?.key }),
  error: (text: string, opts?: { key?: string }) => pushFn({ kind: 'error', text, key: opts?.key }),
  info: (text: string, opts?: { key?: string }) => pushFn({ kind: 'info', text, key: opts?.key }),
};
