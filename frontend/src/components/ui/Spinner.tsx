import * as React from "react";

export interface SpinnerProps {
  size?: number;
  className?: string;
  "aria-label"?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({ size = 24, className = "", "aria-label": ariaLabel = "Loading" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={["animate-spin", className].join(" ")}
    role="status"
    aria-label={ariaLabel}
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
    />
  </svg>
);
