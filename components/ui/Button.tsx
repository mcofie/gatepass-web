import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "default" | "outline" | "ghost" | "link" | "glass"
    size?: "default" | "sm" | "lg" | "icon"
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = "default", size = "default", ...props }, ref) => {
        return (
            <button
                ref={ref}
                className={cn(
                    "inline-flex items-center justify-center rounded-full font-medium transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-950 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
                    // Variants
                    variant === "default" &&
                    "bg-primary text-primary-foreground shadow hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20",
                    variant === "outline" &&
                    "border border-gray-200 bg-transparent shadow-sm hover:bg-gray-100 dark:border-gray-800 dark:hover:bg-gray-800",
                    variant === "ghost" && "hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-gray-50",
                    variant === "link" && "text-primary underline-offset-4 hover:underline",
                    variant === "glass" && "glass text-foreground hover:bg-white/20 border-white/20",

                    // Sizes
                    size === "default" && "h-11 px-6 py-2", // Premium pill size
                    size === "sm" && "h-9 rounded-full px-4 text-xs",
                    size === "lg" && "h-12 rounded-full px-8 text-base",
                    size === "icon" && "h-10 w-10",
                    className
                )}
                {...props}
            />
        )
    }
)
Button.displayName = "Button"

export { Button }
