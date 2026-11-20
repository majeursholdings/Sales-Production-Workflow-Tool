import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/** Wraps a page's content: title, cards and sections stacked with a 24px gap. */
export default function PageWrapper({ className, ...props }: ComponentProps<"div">) {
	return <div className={cn("flex flex-col gap-6", className)} {...props} />;
}
