import * as React from "react";

type Variant = "default" | "ghost";
type Size = "sm" | "md";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant = "default", size = "md", ...props }, ref) => {
    let variantClasses = "";
    if (variant === "default") {
      variantClasses = "bg-blue-600 text-white hover:bg-blue-700";
    } else if (variant === "ghost") {
      variantClasses = "bg-transparent hover:bg-gray-100 text-gray-600";
    }

    let sizeClasses = "";
    if (size === "sm") {
      sizeClasses = "px-2 py-1 text-sm";
    } else if (size === "md") {
      sizeClasses = "px-4 py-2 text-base";
    }

    return (
      <button
        ref={ref}
        className={`rounded-xl transition ${variantClasses} ${sizeClasses} ${className}`}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
