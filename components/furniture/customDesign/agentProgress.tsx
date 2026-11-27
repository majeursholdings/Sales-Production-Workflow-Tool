"use client";

import { Check } from "lucide-react";
import RequestPhoto from "@/components/costRequests/requestPhoto";
import { cn } from "@/lib/cn";
import { agentSteps } from "@/lib/customDesign";

/** While the agent works: the first photo with a scanning band, and the steps so far. */
export default function AgentProgress({
	images,
	step,
}: {
	images: { src: string; alt: string }[];
	/** Index of the step in progress; earlier ones show as done. */
	step: number;
}) {
	const steps = agentSteps(images.length);
	return (
		<div className="flex flex-wrap items-start gap-6">
			<div className="flex max-w-105 min-w-0 flex-[1_1_320px] flex-col gap-3">
				{images[0] && (
					<RequestPhoto image={images[0]} rows={[]} focus={null} onFocus={() => {}}>
						<div
							aria-hidden="true"
							className="absolute inset-x-0 top-0 h-[34%] photo-scan border-b-2 border-accent bg-linear-to-b from-transparent to-accent/20 motion-reduce:h-full motion-reduce:border-0 motion-reduce:bg-accent/10"
						/>
					</RequestPhoto>
				)}
				<span className="text-small text-fg-secondary">
					{images.length} photo{images.length === 1 ? "" : "s"}
				</span>
			</div>

			<div
				role="status"
				aria-live="polite"
				className="flex min-w-0 flex-[999_1_420px] flex-col gap-4"
			>
				<h2>Building the parts list</h2>
				<ol className="flex flex-col gap-3">
					{steps.map((label, i) => {
						const done = i < step;
						const on = i === step;
						return (
							<li
								key={label}
								className={cn(
									"flex items-center gap-3 text-body",
									done
										? "text-fg"
										: on
											? "font-bold text-fg"
											: "text-fg-tertiary",
								)}
							>
								<span
									aria-hidden="true"
									className={cn(
										"grid size-6 shrink-0 place-items-center rounded-full text-small font-bold",
										done
											? "bg-success-fg text-surface"
											: on
												? "bg-inverse text-fg-inverse"
												: "border border-line bg-subtle text-fg-secondary",
									)}
								>
									{done ? (
										<Check className="size-3.5" strokeWidth={2.5} />
									) : (
										i + 1
									)}
								</span>
								<span>
									{label}
									{done && <span className="sr-only"> (done)</span>}
								</span>
							</li>
						);
					})}
				</ol>
				<p className="text-small text-fg-secondary">
					Usually under a minute. Keep this page open until it finishes.
				</p>
			</div>
		</div>
	);
}
