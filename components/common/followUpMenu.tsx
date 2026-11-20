"use client";

import { ChevronDown, Eye, Mail, MessageCircle, Phone } from "lucide-react";
import { buttonClasses } from "@/components/common/buttons";
import { Menu, MenuItem } from "@/components/tables/menu";

/**
 * "Follow up" button with Email / WhatsApp / Call choices, then (optionally) a
 * link to the thing being followed up. `onFollowed` runs after any contact choice.
 */
export default function FollowUpMenu({
	client,
	email,
	whatsapp,
	phone,
	phoneLabel,
	subject,
	message,
	open,
	onFollowed,
	size = "sm",
}: {
	client: string;
	email: string;
	/** WhatsApp number, digits only with the country code. */
	whatsapp: string;
	phone: string;
	/** Phone as it's shown beside "Call". */
	phoneLabel?: string;
	subject: string;
	message: string;
	/** An extra "Open quote"-style item at the end. */
	open?: { label: string; onSelect: () => void };
	onFollowed?: () => void;
	size?: "sm" | "md";
}) {
	const go = (action: () => void) => () => {
		action();
		onFollowed?.();
	};

	return (
		<Menu
			label={`Follow up with ${client}`}
			triggerClassName={buttonClasses({ variant: "secondary", size })}
			trigger={
				<>
					<MessageCircle aria-hidden="true" />
					Follow up
					<ChevronDown aria-hidden="true" />
				</>
			}
		>
			{email && (
				<MenuItem
					onSelect={go(() =>
						window.location.assign(
							`mailto:${email}?subject=${encodeURIComponent(subject)}`,
						),
					)}
				>
					<Mail aria-hidden="true" />
					Email
				</MenuItem>
			)}
			<MenuItem
				onSelect={go(() =>
					window.open(
						`https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`,
						"_blank",
						"noopener",
					),
				)}
			>
				<MessageCircle aria-hidden="true" />
				WhatsApp
				<span className="ms-auto text-small text-fg-tertiary">Preferred</span>
			</MenuItem>
			<MenuItem onSelect={go(() => window.location.assign(`tel:${phone}`))}>
				<Phone aria-hidden="true" />
				Call
				{phoneLabel && (
					<span className="ms-auto text-small text-fg-tertiary">{phoneLabel}</span>
				)}
			</MenuItem>
			{open && (
				<>
					<div role="separator" className="my-1 h-px bg-line" />
					<MenuItem onSelect={open.onSelect}>
						<Eye aria-hidden="true" />
						{open.label}
					</MenuItem>
				</>
			)}
		</Menu>
	);
}
