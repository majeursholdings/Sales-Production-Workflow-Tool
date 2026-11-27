import { z } from "zod";
import { isTitle } from "./names";

/** Server-side checks for the title + first name + surname fields. */
export const nameSchemaParts = {
	title: z
		.string()
		.trim()
		.default("")
		.refine((t) => !t || isTitle(t), "Pick a title from the list"),
	firstName: z.string().trim().min(1, "First name is required").max(80),
	surname: z.string().trim().min(1, "Surname is required").max(80),
};
