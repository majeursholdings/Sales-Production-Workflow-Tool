import type { Metadata } from "next";
import dayjs from "dayjs";
import { notFound } from "next/navigation";
import InvoiceDetailView from "@/components/invoices/invoiceDetailView";
import { getCompanyConfig } from "@/lib/data/companySettings";
import { getInvoiceDetail, getRecentOtherInvoices } from "@/lib/data/invoices";
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
	const [detail, recentOthers, settings] = await Promise.all([
		getInvoiceDetail(invoiceId),
		getRecentOtherInvoices(invoiceId, 8),
		getCompanyConfig(),
	]);
	if (!detail) notFound();

	// The most recent other invoices
	const others = recentOthers.map((i) => ({
		id: i.id,
		client: i.client,
		status: statusOf(i),
	}));

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
