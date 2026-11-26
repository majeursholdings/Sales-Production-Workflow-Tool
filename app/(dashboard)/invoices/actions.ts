"use server";

import dayjs from "dayjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, userWith, type ActionResult } from "@/lib/actionResult";
import { createClient } from "@/utils/supabase/server";

const paymentSchema = z.object({
	amount: z.number().positive("Enter an amount greater than ₦0."),
	reference: z.string().trim().min(1, "Enter the transfer reference."),
	date: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the date the payment landed.")
		.refine((d) => !dayjs(d).isAfter(dayjs(), "day"), "The date can't be in the future."),
	method: z.enum(["transfer", "cash", "pos"]).default("transfer"),
});

/** Records a balance or part payment on an invoice. The database refuses anything over what's owed. */
export async function recordInvoicePaymentAction(
	invoiceNumber: string,
	raw: z.input<typeof paymentSchema>,
): Promise<ActionResult<{ balance: number }>> {
	const actor = await userWith("invoices.edit");
	if (!actor) return fail("You don't have permission to record payments.");
	const parsed = paymentSchema.safeParse(raw);
	if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid payment.");
	const { amount, reference, date, method } = parsed.data;

	const supabase = await createClient();
	const { data, error } = await supabase.rpc("record_invoice_payment", {
		p_invoice_number: invoiceNumber,
		p_amount: amount,
		p_paid_on: date,
		p_reference: reference,
		p_method: method,
		p_actor_name: actor.name,
	});
	if (error) return fail(error.message);
	const balance = Number(data);

	await supabase.from("audit_logs").insert({
		actor_id: actor.id,
		action: "invoice.payment_recorded",
		entity_type: "invoice",
		entity_id: invoiceNumber,
		new_values: { amount, reference, date, method, balance },
	});

	revalidatePath("/invoices", "layout");
	revalidatePath("/finance");
	revalidatePath("/");
	return { ok: true, data: { balance } };
}
