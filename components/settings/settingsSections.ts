export type SettingsSection = { label: string; href: string };
export type SettingsGroup = { label: string; sections: SettingsSection[]; ownerOnly?: boolean };

export const SETTINGS_GROUPS: SettingsGroup[] = [
	{
		label: "Your account",
		sections: [
			{ label: "Profile", href: "/settings" },
			{ label: "Notifications", href: "/settings/notifications" },
			{ label: "Security & sign-in", href: "/settings/security" },
		],
	},
	{
		label: "Company",
		ownerOnly: true,
		sections: [
			{ label: "Company details", href: "/settings/company" },
			{ label: "Bank & terms", href: "/settings/documents" },
			{ label: "Document numbering", href: "/settings/numbering" },
			{ label: "Tax & currency", href: "/settings/tax" },
			{ label: "Trade program", href: "/settings/trade" },
			{ label: "Custom design agent", href: "/settings/agent" },
		],
	},
];
