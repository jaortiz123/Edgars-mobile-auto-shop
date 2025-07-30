import * as React from "react";
import { Link } from "react-router-dom";
import { cva, type VariantProps } from "class-variance-authority";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-lg text-fs-2 font-semibold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed",
  {
    variants: {
      variant: {
        primary: "bg-accent text-accent-foreground hover:bg-accent/90 shadow-lg hover:shadow-xl hover:-translate-y-0.5",
        accent: "bg-accent text-accent-foreground hover:bg-accent/90",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        ghost: "bg-transparent hover:bg-primary-foreground/10 text-primary-foreground",
        success: "bg-green-600 text-white hover:bg-green-700 shadow-lg",
        warning: "bg-orange-500 text-white hover:bg-orange-600 shadow-lg",
        danger: "bg-red-600 text-white hover:bg-red-700 shadow-lg",
        info: "bg-blue-500 text-blue-900 hover:bg-blue-600 shadow-lg",
      },
      size: {
        sm: "px-sp-3 py-sp-2",
        md: "px-sp-4 py-sp-3",
        lg: "px-sp-5 py-sp-4 text-fs-3",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asLink?: boolean;
  to?: string;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asLink, to, ...props }, ref) => {
    const classNames = buttonVariants({ variant, size, className });

    if (asLink && to) {
      return (
        <Link to={to} className={classNames} />
      );
    }

    return (
      <button className={classNames} ref={ref} {...props} />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
