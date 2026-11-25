"use server";

import dayjs from "dayjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, userWith, type ActionResult } from "@/lib/actionResult";
import { RECORDABLE_CATEGORIES, type FinanceCategory } from "@/lib/finance";
import { createClient } from "@/utils/supabase/server";

const expenseSchema = z.object({
	date: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the date it was paid.")
		.refine((d) => !dayjs(d).isAfter(dayjs(), "day"), "The date can't be in the future."),
	category: z
		.string()
		.refine(
			(c): c is FinanceCategory => RECORDABLE_CATEGORIES.includes(c as FinanceCategory),
			"Pick a category. Materials are recorded on purchase orders.",
		),
	amount: z.number().positive("Enter an amount greater than ₦0."),
	paidTo: z.string().trim().min(1, "Enter who was paid."),
	method: z.enum(["transfer", "cash", "pos"]),
	reference: z.string().trim().default(""),
	note: z.string().trim().default(""),
});

export type NewExpense = z.input<typeof expenseSchema>;

/** Records a running cost (wages, rent, power, delivery, outsourced work, other). */
export async function recordExpenseAction(raw: NewExpense): Promise<ActionResult> {
	const actor = await userWith("costs.view_full");
	if (!actor) return fail("You don't have permission to record expenses.");
	const parsed = expenseSchema.safeParse(raw);
	if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid expense.");
	const e = parsed.data;

	const reference =
		e.reference || `MAJ-EXP-${dayjs(e.date).format("YYYYMMDD")}-${dayjs().format("HHmm")}`;

	const supabase = await createClient();
	const { data, error } = await supabase
		.from("expenses")
		.insert({
			paid_on: e.date,
			category: e.category,
			amount: e.amount,
			paid_to: e.paidTo,
			method: e.method,
			reference,
			note: e.note,
			recorded_by: actor.id,
			recorded_by_name: actor.name,
		})
		.select("id")
		.single();
	if (error) return fail(error.message);

	await supabase.from("audit_logs").insert({
		actor_id: actor.id,
		action: "expense.recorded",
		entity_type: "expense",
		entity_id: data.id as string,
		new_values: { ...e, reference },
	});

	revalidatePath("/finance");
	revalidatePath("/");
	return { ok: true };
}
