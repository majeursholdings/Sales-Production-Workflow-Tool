import { deliveryNote, poDate, poTotal, type PurchaseOrder } from "@/lib/purchaseOrders";
import type { Supplier } from "@/lib/suppliers";

// The PDF's built-in fonts have no ₦, so money reads "NGN"
const ngn = (n: number) =>
	`NGN ${n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Saves the order as a one-page PDF to send or print. The PDF libraries load only when it's asked for. */
export async function downloadPurchaseOrderPdf(po: PurchaseOrder, supplier: Supplier | undefined) {
	const [{ jsPDF }, { autoTable }] = await Promise.all([
		import("jspdf"),
		import("jspdf-autotable"),
	]);
	const doc = new jsPDF({ unit: "pt", format: "a4" });
	const x = 40;

	doc.setFont("helvetica", "bold").setFontSize(18).text("Purchase order", x, 56);
	doc.setFont("helvetica", "normal").setFontSize(10);
	doc.text(
		[
			po.number,
			`Raised ${poDate(po.date)} by ${po.raisedBy}`,
			po.jobCard ? `For ${po.jobCard}${po.client ? ` (${po.client})` : ""}` : "Restock",
			deliveryNote(po),
		],
		x,
		76,
	);
	doc.text(
		[
			supplier?.business ?? "Supplier",
			supplier?.contact ?? "",
			supplier?.phone ?? "",
			supplier?.email ?? "",
		].filter(Boolean),
		555,
		76,
		{ align: "right" },
	);

	autoTable(doc, {
		startY: 140,
		head: [["SKU", "Part", "Quantity", "Unit cost", "Line"]],
		body: po.lines.map((l) => [
			l.sku,
			l.name,
			`${l.ordered} ${l.unit}`,
			ngn(l.unitCost),
			ngn(l.ordered * l.unitCost),
		]),
		foot: [["", "", "", "Total", ngn(poTotal(po))]],
		styles: { fontSize: 9 },
		headStyles: { fillColor: [110, 64, 34] },
		footStyles: { fillColor: [244, 242, 241], textColor: [33, 29, 26] },
		columnStyles: { 3: { halign: "right" }, 4: { halign: "right" } },
	});

	const after = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable;
	const y = (after?.finalY ?? 200) + 24;
	doc.text(
		[
			`Deliver to: ${po.deliverTo}`,
			`Payment terms: ${po.paymentTerms}`,
			...(po.note ? [`Note: ${po.note}`] : []),
		],
		x,
		y,
		{ maxWidth: 515 },
	);

	doc.save(`${po.number}.pdf`);
}
