import * as React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const Popover = PopoverPrimitive.Root;
const PopoverTrigger = PopoverPrimitive.Trigger;

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = 'center', sideOffset = 6, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        'z-50 w-72 rounded-md border bg-popover p-3 text-sm text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
        className
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
));
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

export { Popover, PopoverTrigger, PopoverContent };

/**
 * Reusable info "?" button that shows a popover on click (mobile-friendly)
 * and on hover (desktop). Click toggles, hover opens.
 */
export function InfoTooltip({ children, className }: { children: React.ReactNode; className?: string }) {
  const [open, setOpen] = React.useState(false);
  const hoverTimer = React.useRef<number | null>(null);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Mai multe informații"
          onMouseEnter={() => {
            if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
            setOpen(true);
          }}
          onMouseLeave={() => {
            hoverTimer.current = window.setTimeout(() => setOpen(false), 150);
          }}
          className={cn(
            'inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            className
          )}
        >
          <HelpCircle className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="text-xs leading-relaxed"
        onMouseEnter={() => {
          if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
        }}
        onMouseLeave={() => {
          hoverTimer.current = window.setTimeout(() => setOpen(false), 150);
        }}
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}
