import { z } from "zod";
import { addressErrors, cleanAddress, isBlankAddress, type PostalAddress } from "./index";

const part = (max: number) => z.string().max(max).default("");

const shape = z.object({
	country: z.string().trim().length(2, "Pick a country"),
	street: part(300),
	area: part(120),
	city: part(120),
	state: part(120),
	postalCode: part(20),
	sortingCode: part(20),
	landmark: part(200),
});

/** A postal address checked against its country's rules, keeping only the parts that country uses. */
export const postalAddressSchema = shape
	.superRefine((a, ctx) => {
		const problem = Object.values(addressErrors(a as PostalAddress))[0];
		if (problem) ctx.addIssue({ code: "custom", message: problem });
	})
	.transform((a) => cleanAddress(a as PostalAddress));

/** The same, but an address with nothing filled in is fine and comes back as null. */
export const optionalPostalAddressSchema = shape
	.nullable()
	.default(null)
	.superRefine((a, ctx) => {
		if (!a || isBlankAddress(a as PostalAddress)) return;
		const problem = Object.values(addressErrors(a as PostalAddress))[0];
		if (problem) ctx.addIssue({ code: "custom", message: problem });
	})
	.transform((a) =>
		!a || isBlankAddress(a as PostalAddress) ? null : cleanAddress(a as PostalAddress),
	);
