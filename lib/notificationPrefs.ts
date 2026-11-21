export type NotificationEvent = {
	id: string;
	label: string;
	hint?: string;
	/** Whether the email box starts ticked. In-app always starts ticked. */
	emailByDefault: boolean;
};

export const NOTIFICATION_EVENTS: readonly NotificationEvent[] = [
	{
		id: "cost_request_priced",
		label: "A cost request I sent is priced",
		hint: "Procurement replies with a cost",
		emailByDefault: true,
	},
	{
		id: "cost_request_question",
		label: "Procurement asks a question on my request",
		emailByDefault: true,
	},
	{
		id: "quote_expiring",
		label: "My quote expires in 24 hours",
		hint: "Only quotes without a deposit",
		emailByDefault: true,
	},
	{
		id: "deposit_recorded",
		label: "A deposit is recorded on my quote",
		hint: "Accounting records payment",
		emailByDefault: false,
	},
	{
		id: "client_birthday",
		label: "A client of mine has a birthday",
		hint: "3 days before",
		emailByDefault: false,
	},
	{ id: "note_mention", label: "Someone mentions me in a note", emailByDefault: true },
];

export type NotificationChoice = { app: boolean; email: boolean };

export type NotificationPrefs = {
	events: Record<string, NotificationChoice>;
	dailySummary: boolean;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

/** Turns the stored jsonb (possibly empty or partial) into a full set of choices, filling gaps with the defaults. */
export function resolveNotificationPrefs(stored: unknown): NotificationPrefs {
	const saved = isRecord(stored) ? stored : {};
	const savedEvents = isRecord(saved.events) ? saved.events : {};

	const events = Object.fromEntries(
		NOTIFICATION_EVENTS.map((event) => {
			const choice = isRecord(savedEvents[event.id]) ? savedEvents[event.id] : {};
			const { app, email } = choice as Record<string, unknown>;
			return [
				event.id,
				{
					app: typeof app === "boolean" ? app : true,
					email: typeof email === "boolean" ? email : event.emailByDefault,
				},
			];
		}),
	);

	return { events, dailySummary: saved.dailySummary === true };
}
