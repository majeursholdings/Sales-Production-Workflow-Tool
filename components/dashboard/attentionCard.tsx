"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/common/badge";
import FollowUpMenu from "@/components/common/followUpMenu";
import { LinkButton } from "@/components/common/buttons";
import { Card } from "@/components/common/card";
import type { AttentionItem } from "@/lib/dashboard";

/** "Needs your attention": what's waiting on this person, each with the button that deals with it. */
export default function AttentionCard({ items }: { items: AttentionItem[] }) {
	const router = useRouter();
	// Marks the row as followed up for this visit; the message itself goes out through the menu.
	const [followed, setFollowed] = useState<string[]>([]);

	return (
		<Card>
			<div className="flex items-center gap-3">
				<h2 className="flex-1">Needs your attention</h2>
				<span className="text-small text-fg-tertiary">{items.length} items</span>
			</div>
			{items.length === 0 && (
				<p className="text-body text-fg-secondary">
					Nothing needs your attention right now.
				</p>
			)}
			<ul className="flex flex-col">
				{items.map((item) => {
					const done = followed.includes(item.id);
					return (
						<li
							key={item.id}
							className="flex flex-wrap items-center gap-3 border-t border-line py-3 first:border-t-0 first:pt-0 last:pb-0"
						>
							<Badge variant={done ? "neutral" : item.tone}>
								{done ? "Followed up" : item.tag}
							</Badge>
							<span className="flex min-w-0 flex-1 basis-60 flex-col">
								<strong className="text-fg">{item.title}</strong>
								<span className="text-small text-fg-secondary">{item.detail}</span>
							</span>
							{item.followUp ? (
								<FollowUpMenu
									{...item.followUp}
									open={{
										label: "Open quote",
										onSelect: () => router.push(item.href),
									}}
									onFollowed={() => setFollowed((ids) => [...ids, item.id])}
								/>
							) : (
								<LinkButton href={item.href} size="sm">
									{item.cta}
								</LinkButton>
							)}
						</li>
					);
				})}
			</ul>
		</Card>
	);
}
