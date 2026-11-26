import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/cn";
import { PASSWORD_RULES } from "@/lib/passwordRules";

/** Live list of the password rules, ticked as the new password meets each one. */
export default function PasswordChecklist({ password }: { password: string }) {
	return (
		<ul aria-label="Password requirements" className="flex flex-col gap-1">
			{PASSWORD_RULES.map((rule) => {
				const met = rule.test(password);
				return (
					<li
						key={rule.id}
						className={cn(
							"flex items-center gap-2 text-small",
							met ? "text-success-fg" : "text-fg-tertiary",
						)}
					>
						{met ? (
							<Check aria-hidden="true" className="size-4" />
						) : (
							<Minus aria-hidden="true" className="size-4" />
						)}
						{rule.label}
						<span className="sr-only">{met ? " (met)" : " (not met yet)"}</span>
					</li>
				);
			})}
		</ul>
	);
}
