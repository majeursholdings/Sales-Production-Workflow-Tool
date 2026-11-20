"use client";

import { useTheme, type Theme } from "@/providers/theme-provider";
import { SegmentedControl } from "./segmented-control";

const options: { value: Theme; label: string }[] = [
	{ value: "light", label: "Light" },
	{ value: "dark", label: "Dark" },
	{ value: "system", label: "System" },
];

export function ThemeToggle() {
	const { theme, setTheme } = useTheme();
	return (
		<SegmentedControl
			label="Colour theme"
			options={options}
			value={theme}
			onChange={setTheme}
		/>
	);
}
