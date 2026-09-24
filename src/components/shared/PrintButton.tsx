"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * PrintButton — triggers the browser's print dialog while temporarily
 * renaming the document so the saved PDF/printed file gets a clean title
 * (instead of the SPA route).
 *
 * Pair with a `<div className="print-area">…</div>` wrapper so only that
 * element is printed (see print CSS in `src/app/globals.css`).
 */
export function PrintButton({
  title,
  label = "Exporter PDF",
  variant = "outline",
  size = "sm",
  className,
}: {
  title: string;
  label?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  className?: string;
}) {
  const onPrint = () => {
    if (typeof document === "undefined") return;
    const previous = document.title;
    try {
      document.title = title;
      window.print();
    } finally {
      // Restore after the print dialog closes (next tick).
      setTimeout(() => {
        document.title = previous;
      }, 300);
    }
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={onPrint}
      className={className}
    >
      <Printer className="h-3.5 w-3.5" />
      {label}
    </Button>
  );
}

export default PrintButton;
