import { Switch as SwitchPrimitive } from '@base-ui/react/switch';
import { cn } from '@/lib/utils';

export function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        'primitive:inline-flex primitive:h-6 primitive:w-10.5 primitive:shrink-0 primitive:cursor-pointer primitive:items-center primitive:rounded-full primitive:border primitive:border-input primitive:bg-secondary primitive:p-0.75 primitive:outline-none primitive:focus-visible:ring-2 primitive:focus-visible:ring-ring primitive:focus-visible:ring-offset-2 primitive:disabled:cursor-not-allowed primitive:disabled:opacity-50 primitive:data-checked:bg-primary',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="primitive:size-4 primitive:rounded-full primitive:bg-muted-foreground primitive:data-checked:translate-x-4.5 primitive:data-checked:bg-background"
      />
    </SwitchPrimitive.Root>
  );
}
