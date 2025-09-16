import React from 'react';
import { ReactElement } from 'react';
import { render } from '@test-utils';
import { ToastProvider } from '@/components/ui/Toast';
import { BoardStoreProvider } from '@/state/BoardStoreProvider';

export function appRender(ui: ReactElement, options?: Parameters<typeof render>[1]) {
  return render(
    <ToastProvider>
      <BoardStoreProvider>{ui}</BoardStoreProvider>
    </ToastProvider>,
    options,
  );
}

export default appRender;
