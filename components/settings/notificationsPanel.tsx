"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/common/buttons";
import { Card, CardHeader, CardTitle } from "@/components/common/card";
import { Table } from "@/components/tables";
import { NOTIFICATION_EVENTS, type NotificationPrefs } from "@/lib/notificationPrefs";
import { createClient } from "@/utils/supabase/client";

const checkboxClass = "size-4.5 cursor-pointer accent-accent";

/** Notifications settings: which events reach you in the app and by email. */
export default function NotificationsPanel({
	userId,
	initialPrefs,
}: {
	userId: string;
	initialPrefs: NotificationPrefs;
}) {
	const [saving, setSaving] = useState(false);
	const { register, handleSubmit, reset } = useForm<NotificationPrefs>({
		defaultValues: initialPrefs,
	});

	const onSubmit = async (values: NotificationPrefs) => {
		setSaving(true);
		const supabase = createClient();
		const { error } = await supabase
			.from("profiles")
			.update({ notification_prefs: values })
			.eq("id", userId);
		setSaving(false);

		if (error) {
			toast.error(error.message);
			return;
		}

		reset(values);
		toast.success("Your notification choices are saved.");
	};

	return (
		<form onSubmit={handleSubmit(onSubmit)} noValidate>
			<Card flush className="overflow-hidden" aria-labelledby="notifications-title">
				<CardHeader>
					<CardTitle id="notifications-title" className="flex-1">
						Notifications
					</CardTitle>
					<span className="text-small text-fg-tertiary">
						In-app alerts also show on the bell.
					</span>
				</CardHeader>

				<Table className="[&_td:not(:first-child)]:text-center [&_th:not(:first-child)]:text-center">
					<thead>
						<tr>
							<th scope="col">Tell me when</th>
							<th scope="col" className="w-24">
								In app
							</th>
							<th scope="col" className="w-24">
								Email
							</th>
						</tr>
					</thead>
					<tbody>
						{NOTIFICATION_EVENTS.map((event) => (
							<tr key={event.id}>
								<td className="text-fg">
									<span className="flex flex-col">
										{event.label}
										{event.hint && (
											<span className="text-small text-fg-tertiary">
												{event.hint}
											</span>
										)}
									</span>
								</td>
								<td>
									<input
										type="checkbox"
										className={checkboxClass}
										aria-label={`${event.label}: in app`}
										{...register(`events.${event.id}.app`)}
									/>
								</td>
								<td>
									<input
										type="checkbox"
										className={checkboxClass}
										aria-label={`${event.label}: email`}
										{...register(`events.${event.id}.email`)}
									/>
								</td>
							</tr>
						))}
					</tbody>
				</Table>

				<div className="flex flex-wrap items-center gap-3 border-t border-line px-5 py-4">
					<label className="flex flex-1 basis-72 items-center gap-2 text-body">
						<input
							type="checkbox"
							className={checkboxClass}
							{...register("dailySummary")}
						/>
						Send one daily summary email at 8:00 instead of separate emails
					</label>
					<Button type="submit" variant="primary" disabled={saving}>
						{saving ? "Saving…" : "Save"}
					</Button>
				</div>
			</Card>
		</form>
	);
}
