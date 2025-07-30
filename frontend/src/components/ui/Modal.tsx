import * as React from "react";
import type { ReactNode } from "react";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}

export const Modal: React.FC<ModalProps> = ({ open, onClose, title, children, className = "" }) => {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fadeIn"
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
      onClick={onClose}
    >
      <div
        className={["bg-white dark:bg-gray-900 rounded-lg shadow-lg max-w-lg w-full p-sp-4 relative", className].join(" ")}
        onClick={e => e.stopPropagation()}
      >
        {title && (
          <header className="mb-sp-3 text-fs-3 font-semibold text-gray-900 dark:text-gray-100">
            {title}
          </header>
        )}
        <button
          onClick={onClose}
          aria-label="Close modal"
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 focus:outline-none"
        >
          <span aria-hidden="true">&times;</span>
        </button>
        <div>{children}</div>
      </div>
    </div>
  );
};
