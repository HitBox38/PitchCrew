import { Switch as SwitchPrimitive } from '@base-ui/react/switch';
import { cn } from '@/lib/utils';

export function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        'primitive:inline-flex primitive:h-6 primitive:w-10.5 primitive:shrink-0 primitive:cursor-pointer primitive:items-center primitive:rounded-full primitive:border-0 primitive:p-0.75 primitive:shadow-sunken primitive:transition-[background,box-shadow,opacity] primitive:duration-160 primitive:ease-material primitive:outline-none primitive:[background:var(--sunken-fill)] primitive:disabled:cursor-not-allowed primitive:disabled:opacity-50 primitive:motion-reduce:transition-none primitive:data-checked:shadow-glaze primitive:data-checked:[background:var(--glaze-fill)] primitive:data-disabled:cursor-not-allowed primitive:data-disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="primitive:block primitive:size-4 primitive:rounded-full primitive:shadow-switch-thumb primitive:transition-transform primitive:duration-160 primitive:ease-material primitive:[background:var(--switch-thumb-fill)] primitive:motion-reduce:transition-none primitive:data-checked:translate-x-5"
      />
    </SwitchPrimitive.Root>
  );
}
