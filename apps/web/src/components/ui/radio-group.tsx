import type { ReactNode } from "react";
import { Radio as RadioPrimitive } from "@base-ui/react/radio";
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group";
import { cn } from "cn";

function RadioGroup({ className, ...props }: RadioGroupPrimitive.Props) {
  return (
    <RadioGroupPrimitive
      data-slot="radio-group"
      className={cn("grid w-full gap-3", className)}
      {...props}
    />
  );
}

function RadioGroupItem({
  className,
  children,
  ...props
}: RadioPrimitive.Root.Props & { children?: ReactNode }) {
  const isCard = children != null;
  return (
    <RadioPrimitive.Root
      data-slot="radio-group-item"
      className={cn(
        isCard
          ? "group/radio-card peer relative flex min-h-16 w-full items-start gap-3 rounded-lg border border-line bg-surface p-3 text-left outline-none transition-colors hover:border-line-strong focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 data-checked:border-cobalt data-checked:bg-cobalt/5 disabled:cursor-not-allowed disabled:opacity-50"
          : "group/radio-group-item peer relative flex aspect-square size-5 shrink-0 rounded-full border border-line bg-surface outline-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 data-checked:border-cobalt data-checked:bg-cobalt data-checked:text-primary-foreground",
        className,
      )}
      {...props}
    >
      {children}
      <RadioPrimitive.Indicator
        data-slot="radio-group-indicator"
        className={cn(
          isCard
            ? "ml-auto flex size-5 shrink-0 items-center justify-center rounded-full border border-line-strong group-data-checked/radio-card:border-cobalt group-data-checked/radio-card:bg-cobalt"
            : "flex size-5 items-center justify-center",
        )}
      >
        <span className="absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-foreground" />
      </RadioPrimitive.Indicator>
    </RadioPrimitive.Root>
  );
}

export { RadioGroup, RadioGroupItem };
