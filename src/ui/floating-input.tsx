import * as React from "react"
import { cn } from "@/lib/utils"
import { Input } from "./input"

const FloatingInput = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<"input"> & { label: string; error?: boolean }
>(({ className, label, value, error, hasIcon, onFocus, onBlur, ...props }, ref) => {
  const [isFocused, setIsFocused] = React.useState(false)
  
  // Handle both controlled and uncontrolled scenarios
  const internalRef = React.useRef<HTMLInputElement>(null)
  const combinedRef = (ref as React.MutableRefObject<HTMLInputElement>) || internalRef
  
  const [hasValue, setHasValue] = React.useState(false)

  React.useEffect(() => {
    const el = combinedRef.current
    if (el) {
      setHasValue(!!el.value || !!value)
    }
  }, [value, combinedRef])

  return (
    <div className="relative group/floating w-full">
      <Input
        {...props}
        value={value}
        ref={combinedRef}
        onFocus={(e) => {
          setIsFocused(true)
          onFocus?.(e)
        }}
        onBlur={(e) => {
          setIsFocused(false)
          setHasValue(!!e.target.value)
          onBlur?.(e)
        }}
        onChange={(e) => {
          setHasValue(!!e.target.value)
          props.onChange?.(e)
        }}
        placeholder=" " 
        className={cn(
          "h-12 w-full bg-transparent border-zinc-700/50 text-zinc-100 focus:border-primary/60 focus:ring-0 rounded-xl transition-all px-4 pt-2",
          error && "border-destructive/50 focus:border-destructive/80",
          className
        )}
      />
      <label
        className={cn(
          "absolute top-1/2 -translate-y-1/2 text-sm text-zinc-500 pointer-events-none transition-all duration-200 ease-out",
          hasIcon ? "left-12" : "left-4",
          // The background here must match the modal background EXACTLY to 'break' the border seamlessly
          // We use the theme variable for zinc-900 to ensure consistency across the project
          (isFocused || hasValue) && "-top-[2px] px-1.5 text-[10px] uppercase tracking-wider text-primary font-bold bg-zinc-900 rounded-sm leading-none py-0.5",
          (isFocused || hasValue) && (hasIcon ? "left-10" : "left-3"),
          (isFocused || hasValue) && error && "text-destructive"
        )}
      >
        {label}
      </label>
    </div>
  )
})
FloatingInput.displayName = "FloatingInput"

export { FloatingInput }
