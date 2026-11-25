import type { RegisterOptions } from "react-hook-form";
import { NIGERIAN_PHONE_MESSAGE, isPhoneNumber } from "@/components/forms/form.validators";

/** "7.5%" or "7.5" → 7.5; NaN when it isn't a number. */
export const percentOf = (v: unknown) => Number(String(v ?? "").replace(/[%\s,]/g, ""));

/** A percentage between min and max, typed with or without the % sign. */
export const percentRule = (label: string, min = 0, max = 100): RegisterOptions => ({
	required: `${label} is required`,
	validate: (v: string) => {
		const n = percentOf(v);
		return (
			(Number.isFinite(n) && n >= min && n <= max) ||
			`Enter a percentage from ${min} to ${max}`
		);
	},
});

/** A whole number from min up. */
export const wholeRule = (label: string, min = 1): RegisterOptions => ({
	required: `${label} is required`,
	validate: (v: string) =>
		(/^\d+$/.test(String(v ?? "").trim()) && Number(v) >= min) ||
		`Enter a whole number from ${min}`,
});

/** An optional Nigerian phone number. */
export const optionalPhone: RegisterOptions = {
	validate: (v: string) => !v?.trim() || isPhoneNumber(v) || NIGERIAN_PHONE_MESSAGE,
};

/** An optional 10-digit NUBAN account number. */
export const optionalAccountNumber: RegisterOptions = {
	validate: (v: string) =>
		!v?.trim() || /^\d{10}$/.test(v.replace(/\s/g, "")) || "Account numbers have 10 digits",
};

/** "70" → "70%", for showing a saved percentage in a text field. */
export const pct = (n: number) => `${n}%`;
