import * as React from "react";

import { cn } from "@/lib/utils";

type TextareaProps = React.ComponentProps<"textarea"> & { autoSize?: boolean };

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, autoSize = false, ...props }, ref) => {
    const localRef = React.useRef<HTMLTextAreaElement | null>(null);

    React.useEffect(() => {
      const element = localRef.current;
      if (!autoSize || !element) return;
      const resize = () => {
        element.style.height = "auto";
        const borders = element.offsetHeight - element.clientHeight;
        element.style.height = `${element.scrollHeight + borders}px`;
      };
      resize();
      let width = element.getBoundingClientRect().width;
      const observer = new ResizeObserver(() => {
        const nextWidth = element.getBoundingClientRect().width;
        if (nextWidth !== width) {
          width = nextWidth;
          resize();
        }
      });
      observer.observe(element);
      element.addEventListener("input", resize);
      return () => {
        observer.disconnect();
        element.removeEventListener("input", resize);
      };
    }, [autoSize, props.value, props.defaultValue]);

    return (
      <textarea
        className={cn(
          "flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
          autoSize && "!resize-none !overflow-hidden",
        )}
        ref={(element) => {
          localRef.current = element;
          if (typeof ref === "function") ref(element);
          else if (ref) ref.current = element;
        }}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
