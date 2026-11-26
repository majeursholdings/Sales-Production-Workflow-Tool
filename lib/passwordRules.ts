/**
 * What a new password needs. Shared by the forms (live checklist) and the
 * server actions (the real check), so they never disagree.
 */

export const MIN_PASSWORD_LENGTH = 12;

export type PasswordRule = { id: string; label: string; test: (password: string) => boolean };

export const PASSWORD_RULES: readonly PasswordRule[] = [
	{
		id: "length",
		label: `At least ${MIN_PASSWORD_LENGTH} characters`,
		test: (p) => p.length >= MIN_PASSWORD_LENGTH,
	},
	{ id: "upper", label: "An uppercase letter", test: (p) => /[A-Z]/.test(p) },
	{ id: "lower", label: "A lowercase letter", test: (p) => /[a-z]/.test(p) },
	{ id: "number", label: "A number", test: (p) => /\d/.test(p) },
	{
		id: "symbol",
		label: "A symbol, such as ! ? # or @",
		test: (p) => /[^A-Za-z0-9]/.test(p),
	},
];

/** Words a password must not contain: the person's email name and the obvious ones. */
function guessableWords(email?: string): string[] {
	const name = email?.split("@")[0]?.toLowerCase() ?? "";
	return ["password", "majeurs", "qwerty", "123456", ...(name.length >= 3 ? [name] : [])];
}

/** The first problem with a new password, or null when it's strong enough. */
export function passwordProblem(password: string, email?: string): string | null {
	const failed = PASSWORD_RULES.find((rule) => !rule.test(password));
	if (failed) return `Password needs: ${failed.label.toLowerCase()}.`;
	const lower = password.toLowerCase();
	const word = guessableWords(email).find((w) => lower.includes(w));
	if (word) return `Password can't contain "${word}". Choose something harder to guess.`;
	return null;
}
