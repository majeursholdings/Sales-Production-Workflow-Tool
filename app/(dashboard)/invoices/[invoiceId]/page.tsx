import type { Metadata } from "next";
import dayjs from "dayjs";
import { notFound } from "next/navigation";
import InvoiceDetailView from "@/components/invoices/invoiceDetailView";
import { getCompanySettings } from "@/lib/data/companySettings";
import { getInvoiceDetail, getInvoices } from "@/lib/data/invoices";
import { statusOf } from "@/lib/invoices";
import { hasPermission } from "@/lib/roles";
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
	const [detail, invoices, settings] = await Promise.all([
		getInvoiceDetail(invoiceId),
		getInvoices(),
		getCompanySettings(),
	]);
	if (!detail) notFound();

	// The most recent other invoices
	const others = invoices
		.filter((i) => i.id !== invoiceId)
		.slice(0, 8)
		.map((i) => ({ id: i.id, client: i.client, status: statusOf(i) }));

	return (
		<InvoiceDetailView
			detail={detail}
			others={others}
			canRecordPayment={hasPermission(user.roleKey, "invoices.edit")}
			today={dayjs().format("YYYY-MM-DD")}
			bank={settings.bank}
			footer={settings.terms.invoiceFooter}
		/>
	);
}
