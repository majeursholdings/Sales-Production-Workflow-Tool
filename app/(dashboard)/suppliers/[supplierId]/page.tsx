import { notFound } from "next/navigation";
import DetailOverviewPage from "@/components/pages/detailOverview";
import { getSupplierDetail, sampleSupplierIds } from "@/lib/overviews";
import { requireRouteAccess } from "@/lib/session";

export function generateStaticParams() {
	return sampleSupplierIds.map((supplierId) => ({ supplierId }));
}

export default async function SupplierPage({ params }: PageProps<"/suppliers/[supplierId]">) {
	await requireRouteAccess("/suppliers");
	const { supplierId } = await params;
	const detail = await getSupplierDetail(supplierId);
	if (!detail) notFound();
	return (
		<DetailOverviewPage parent={{ label: "Suppliers", href: "/suppliers" }} detail={detail} />
	);
}
