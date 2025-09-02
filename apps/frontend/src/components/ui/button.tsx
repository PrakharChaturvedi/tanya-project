import * as React from "react";

type Variant = "default" | "ghost" | "outline" | "secondary";
type Size = "xs" | "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant = "default", size = "md", ...props }, ref) => {
    let variantClasses = "";
    if (variant === "default") {
      variantClasses = "bg-primary-600 text-white hover:bg-primary-700 shadow-sm";
    } else if (variant === "ghost") {
      variantClasses = "bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300";
    } else if (variant === "outline") {
      variantClasses = "bg-transparent border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300";
    } else if (variant === "secondary") {
      variantClasses = "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-700";
    }

    let sizeClasses = "";
    if (size === "xs") {
      sizeClasses = "px-2 py-1 text-xs font-medium";
    } else if (size === "sm") {
      sizeClasses = "px-3 py-1.5 text-sm font-medium";
    } else if (size === "md") {
      sizeClasses = "px-4 py-2.5 text-sm font-medium";
    } else if (size === "lg") {
      sizeClasses = "px-5 py-3 text-base font-medium";
    }

    return (
      <button
        ref={ref}
        className={`rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 ${variantClasses} ${sizeClasses} ${className}`}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
