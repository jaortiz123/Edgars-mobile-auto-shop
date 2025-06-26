import * as React from "react";
import { Link } from "react-router-dom";
import { cva, type VariantProps } from "class-variance-authority";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-lg text-base font-semibold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed",
  {
    variants: {
      variant: {
        primary: "bg-accent text-accent-foreground hover:bg-accent/90 shadow-lg hover:shadow-xl hover:-translate-y-0.5",
        secondary: "bg-primary text-primary-foreground hover:bg-primary/90",
        outline: "border-2 border-primary text-primary bg-transparent hover:bg-primary hover:text-primary-foreground",
        ghost: "bg-transparent text-primary hover:bg-primary/10",
      },
      size: {
        sm: "px-4 py-2",
        md: "px-6 py-3",
        lg: "px-8 py-4 text-lg",
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
        <Link to={to} className={classNames} {...(props as any)} />
      );
    }

    return (
      <button className={classNames} ref={ref} {...props} />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
