import type { ButtonHTMLAttributes } from 'react';

export default function Button({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className="rounded bg-blue-600 px-4 py-2 text-white" {...props}>
      {children}
    </button>
  );
}
