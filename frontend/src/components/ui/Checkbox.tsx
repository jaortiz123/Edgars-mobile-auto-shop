import * as React from "react";
import type { InputHTMLAttributes } from "react";

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  error?: string;
  className?: string;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, error, className = "", id, ...props }, ref) => {
    const inputId = id || (label ? label.replace(/\s+/g, "-").toLowerCase() : undefined);
    return (
      <div className="flex items-center gap-2">
        <input
          id={inputId}
          ref={ref}
          type="checkbox"
          className={[
            "h-5 w-5 rounded border border-gray-300 dark:border-gray-700 text-brandAccent focus:ring-brandAccent focus:ring-2 transition-colors",
            className,
          ].join(" ")}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : undefined}
          {...props}
        />
        {label && (
          <label htmlFor={inputId} className="text-sm text-gray-700 dark:text-gray-200 select-none">
            {label}
          </label>
        )}
        {error && (
          <span id={`${inputId}-error`} className="text-xs text-red-500 ml-2">
            {error}
          </span>
        )}
      </div>
    );
  }
);
Checkbox.displayName = "Checkbox";
