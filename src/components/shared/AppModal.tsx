"use client";

import type { ReactNode } from "react";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/ui/dialog";
import { cn } from "@/lib/utils";

type AppModalProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  contentClassName?: string;
  dialogClassName?: string;
  trigger?: ReactNode;
};

export default function AppModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  contentClassName,
  dialogClassName,
  trigger,
}: AppModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent
        className={cn(
          "flex max-h-[85vh] flex-col border-white/10 bg-slate-950 p-0 text-slate-100",
          dialogClassName
        )}
      >
        <DialogHeader className="shrink-0 border-b border-white/10 px-6 py-5">
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div className={cn("flex-1 overflow-y-auto px-6 py-5", contentClassName)}>{children}</div>
        {footer ? <DialogFooter className="shrink-0 border-t border-white/10 px-6 py-4">{footer}</DialogFooter> : null}
      </DialogContent>
    </Dialog>
  );
}

export { DialogClose };
