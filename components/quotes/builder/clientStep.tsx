"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";
import ClientForm from "@/components/clients/clientForm";
import { Button } from "@/components/common/buttons";
import { Avatar, Card } from "@/components/common/card";
import { SegmentedControl } from "@/components/common/segmented-control";
import PageWrapper from "@/components/layout/pageWrapper";
import { cn } from "@/lib/cn";
import type { Client } from "@/lib/clients";
import { DEPOSIT_RATE, VALID_DAYS } from "@/lib/quoteBuilder";
import { updateDraft, useQuoteDraft } from "@/lib/quoteDraft";
import BuilderHeader from "./builderHeader";

type Mode = "existing" | "new";

export default function ClientStep({
	clients,
	createdBy,
}: {
	clients: Client[];
	createdBy: string;
}) {
	const router = useRouter();
	const { client: selected } = useQuoteDraft();
	const [mode, setMode] = useState<Mode>("existing");
	const [search, setSearch] = useState("");

	const q = search.trim().toLowerCase();
	const shown = q
		? clients.filter((c) =>
				[c.name, c.contact, c.company, c.location].some((v) => v.toLowerCase().includes(q)),
			)
		: clients;

	return (
		<PageWrapper>
			<BuilderHeader
				step={1}
				createdBy={createdBy}
				actions={
					<>
						<Button
							onClick={() => {
								toast.success("Draft kept for this session.");
								router.push("/quotes");
							}}
						>
							Save draft
						</Button>
						<Button
							variant="primary"
							disabled={!selected}
							onClick={() => router.push("/quotes/new/items")}
						>
							Continue to items
							<ArrowRight />
						</Button>
					</>
				}
			/>

			<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
				<Card className="gap-5">
					<div className="flex flex-wrap items-center gap-3">
						<h2 className="flex-1">Who is this quote for?</h2>
						<SegmentedControl<Mode>
							label="Client source"
							value={mode}
							onChange={setMode}
							options={[
								{ value: "existing", label: "Existing client" },
								{ value: "new", label: "New client" },
							]}
						/>
					</div>

					{mode === "existing" ? (
						<div className="flex flex-col gap-3">
							<label className="flex flex-col gap-2">
								<span className="text-body font-bold">Search clients</span>
								<input
									type="search"
									value={search}
									onChange={(e) => setSearch(e.target.value)}
									placeholder="Name, phone or email"
									className="h-10 w-full rounded-md border border-line-control bg-surface px-3 text-fg outline-none placeholder:text-fg-tertiary focus:border-focus focus:ring-1 focus:ring-focus"
								/>
							</label>
							<div role="group" aria-label="Clients" className="flex flex-col gap-2">
								{shown.map((c) => {
									const on = selected?.id === c.id;
									return (
										<button
											key={c.id}
											type="button"
											aria-pressed={on}
											onClick={() => updateDraft({ client: c })}
											className={cn(
												"flex w-full cursor-pointer items-center gap-3 rounded-md border bg-surface p-3 text-start transition-colors hover:bg-page",
												on
													? "border-focus ring-1 ring-focus"
													: "border-line",
											)}
										>
											<Avatar
												initials={c.name
													.split(/\s+/)
													.map((w) => w[0])
													.join("")
													.slice(0, 2)
													.toUpperCase()}
												className="size-9"
											/>
											<span className="flex min-w-0 flex-1 flex-col">
												<strong className="text-fg">{c.name}</strong>
												<span className="text-small text-fg-secondary">
													{c.company ? `${c.company} · ` : ""}
													{c.type === "Trade" ? "trade · " : ""}
													{c.contact}
												</span>
											</span>
											<span className="text-small whitespace-nowrap text-fg-secondary">
												{c.quotes === 0
													? "No orders yet"
													: `${c.quotes} ${c.quotes === 1 ? "quote" : "quotes"}`}
											</span>
										</button>
									);
								})}
								{shown.length === 0 && (
									<p className="rounded-md border border-dashed border-line-strong p-4 text-center text-body text-fg-secondary">
										No client matches that. Switch to New client to add them.
									</p>
								)}
							</div>
							<p className="text-small text-fg-tertiary">
								Not here? Switch to <strong>New client</strong> to add them;
								they&apos;re saved to Clients when the quote is sent.
							</p>
						</div>
					) : (
						<ClientForm
							clients={clients}
							submitLabel="Save client and continue"
							onSubmit={(client) => {
								updateDraft({ client });
								router.push("/quotes/new/items");
							}}
						/>
					)}
				</Card>

				<aside aria-label="Quote client" className="flex min-w-0 flex-col gap-6">
					<Card>
						<h2>Selected client</h2>
						{selected ? (
							<div className="flex flex-col gap-1">
								<strong className="text-fg">{selected.name}</strong>
								<span className="text-small whitespace-pre-line text-fg-secondary">
									{[
										selected.location,
										selected.contact,
										selected.type === "Trade" ? "Trade account" : "",
									]
										.filter(Boolean)
										.join("\n")}
								</span>
							</div>
						) : (
							<p className="text-body text-fg-secondary">
								Pick a client, or add a new one, to continue.
							</p>
						)}
					</Card>
					<Card>
						<h2>Quote settings</h2>
						<dl className="flex flex-col gap-2 text-body">
							{[
								["Prepared by", createdBy],
								["Currency", "Naira (NGN)"],
								["Valid for", `${VALID_DAYS} days`],
								["Deposit to confirm", `${Math.round(DEPOSIT_RATE * 100)}%`],
							].map(([k, v]) => (
								<div key={k} className="flex justify-between gap-3">
									<dt className="text-fg-secondary">{k}</dt>
									<dd>{v}</dd>
								</div>
							))}
						</dl>
						<p className="text-small text-fg-tertiary">
							Validity is set by the MD or GM; deposit and VAT by Accounting. You can
							switch to USD when sending.
						</p>
					</Card>
				</aside>
			</div>
		</PageWrapper>
	);
}
