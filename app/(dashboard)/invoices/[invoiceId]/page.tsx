import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isOwnerRole } from "@/components/layout/navigation";
import InvoiceDetailView from "@/components/invoices/invoiceDetailView";
import { getInvoiceDetail, getInvoices, statusOf } from "@/lib/invoices";
import { requireRouteAccess } from "@/lib/session";

export async function generateMetadata({
	params,
}: PageProps<"/invoices/[invoiceId]">): Promise<Metadata> {
	const { invoiceId } = await params;
	return { title: `Invoice ${invoiceId}` };
}

export default async function InvoicePage({ params }: PageProps<"/invoices/[invoiceId]">) {
	const user = await requireRouteAccess("/invoices");
	const { invoiceId } = await params;
	const [detail, invoices] = await Promise.all([getInvoiceDetail(invoiceId), getInvoices()]);
	if (!detail) notFound();

	// MD, GM and Accounting record payments
	const canRecordPayment = isOwnerRole(user.role) || /accounting/i.test(user.role);
	const others = invoices
		.filter((i) => i.id !== invoiceId)
		.map((i) => ({ id: i.id, client: i.client, status: statusOf(i) }));

	return (
		<InvoiceDetailView
			detail={detail}
			others={others}
			canRecordPayment={canRecordPayment}
			recordedBy={user.name}
		/>
	);
}
