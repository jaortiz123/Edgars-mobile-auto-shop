import React, { createContext, useContext, useState } from 'react';

interface ToastMsg { id: number; kind: 'success'|'error'|'info'; text: string }
const ToastCtx = createContext<{ push: (m: Omit<ToastMsg,'id'>) => void } | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastMsg[]>([]);
  const push = (m: Omit<ToastMsg,'id'>) => {
    const msg: ToastMsg = { id: Date.now(), ...m } as ToastMsg;
    setItems((p) => [...p, msg]);
    setTimeout(() => setItems((p) => p.filter((i) => i.id !== msg.id)), 4000);
  };
  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-50">
        {items.map((i) => (
          <div key={i.id} className={`rounded-md px-4 py-2 shadow-md text-white ${i.kind==='error'?'bg-red-600':i.kind==='success'?'bg-green-600':'bg-gray-800'}`}>
            {i.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast(){
  const v = useContext(ToastCtx);
  if(!v) throw new Error('useToast must be used within ToastProvider');
  return v;
}
