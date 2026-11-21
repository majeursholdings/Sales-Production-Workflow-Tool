import dayjs from "dayjs";
import type { FinanceCategory, FinanceEntry } from "@/lib/finance";

export type OwedToday = {
	toMajeurs: { amount: number; invoices: number };
	toSuppliers: { amount: number; purchaseOrders: number };
};

export type FinanceData = {
	/** YYYY-MM-DD, so the server and the browser agree on what "today" is. */
	today: string;
	entries: FinanceEntry[];
	owed: OwedToday;
};

const CLIENTS = [
	"Tunde Bakare",
	"Harbourview Suites",
	"Moyo & Okeke Interiors",
	"Adaeze Okafor",
	"Fatima Bello",
	"Ngozi Adeyemi",
	"Kola Martins",
	"Halima Musa",
	"Lekki Pearl Residences",
	"Ibrahim Danjuma",
];
const SUPPLIERS = [
	"Ogun Timber Co.",
	"Balogun Textiles",
	"Lagos Foam Supply",
	"Ladipo Hardware Traders",
	"Springfield Seating Ltd",
	"Coastline Cord Imports",
];
const PARTNERS = ["Yaba Upholstery Works", "Ikorodu Metal Fabricators"];

/** Small seeded generator, so the sample ledger is the same on every load. */
function seeded(seed: number) {
	let a = seed;
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/**
 * TODO: replace with real payments and expenses once invoices, purchase orders and
 * an expenses table exist. Until then this is a sample ledger covering the last
 * 14 months, ending today, so every period on the page has something to show.
 * The page only talks to finance through here, so swapping in real data is a one-file change.
 */
function sampleEntries(today: string): FinanceEntry[] {
	const rand = seeded(20261149);
	const pick = <T>(list: T[]) => list[Math.floor(rand() * list.length)];
	const amount = (lo: number, hi: number) => Math.round((lo + rand() * (hi - lo)) / 50) * 50;

	const entries: FinanceEntry[] = [];
	const end = dayjs(today);
	const days = end.diff(end.subtract(14, "month"), "day");

	for (let i = days; i >= 0; i--) {
		const day = end.subtract(i, "day");
		const date = day.format("YYYY-MM-DD");
		const stamp = day.format("YYYYMMDD");
		const dow = day.day();
		const dom = day.date();
		const add = (
			kind: "in" | "out",
			category: FinanceCategory,
			value: number,
			description: string,
			prefix: string,
			recordedBy: string,
			href?: string,
		) =>
			entries.push({
				id: `${prefix}-${stamp}-${entries.length}`,
				date,
				kind,
				category,
				amount: value,
				description,
				reference: `MAJ-${prefix}-${stamp}-${String(8 + Math.floor(rand() * 10)).padStart(2, "0")}${String(Math.floor(rand() * 12) * 5).padStart(2, "0")}`,
				recordedBy,
				href,
			});

		if (dow !== 0 && rand() < 0.42) {
			const deposit = rand() < 0.6;
			add(
				"in",
				deposit ? "dep" : "bal",
				amount(600000, 5800000),
				`${deposit ? "Deposit from" : "Balance payment from"} ${pick(CLIENTS)}`,
				"INV",
				rand() < 0.7 ? "Bisi Lawal" : "Amaka Udeh",
				"/invoices",
			);
		}
		if (dow !== 0 && rand() < 0.28) {
			add(
				"out",
				"mat",
				amount(300000, 3500000),
				`Payment to ${pick(SUPPLIERS)}`,
				"PO",
				"Bisi Lawal",
				"/purchase-orders",
			);
		}
		if (dom === 25) {
			add(
				"out",
				"wag",
				9450000,
				`Workshop and office wages, ${day.format("MMMM")}`,
				"EXP",
				"Bisi Lawal",
			);
		}
		if (dom === 1) {
			add(
				"out",
				"rent",
				1800000,
				`Workshop rent, Ikeja, ${day.format("MMMM")}`,
				"EXP",
				"Bisi Lawal",
			);
		}
		if (dow === 1) {
			add(
				"out",
				"pow",
				amount(180000, 320000),
				rand() < 0.6 ? "Diesel for workshop generator" : "Electricity token, workshop",
				"EXP",
				"Bisi Lawal",
			);
		}
		if (rand() < 0.18) {
			add(
				"out",
				"del",
				amount(60000, 350000),
				`Delivery and installation for ${pick(CLIENTS)}`,
				"EXP",
				"Bisi Lawal",
			);
		}
		if (rand() < 0.04) {
			add(
				"out",
				"out",
				amount(400000, 1500000),
				`Outsourced work, ${pick(PARTNERS)}`,
				"EXP",
				"Bisi Lawal",
			);
		}
	}
	return entries;
}

export async function getFinanceData(): Promise<FinanceData> {
	const today = dayjs().format("YYYY-MM-DD");
	return {
		today,
		entries: sampleEntries(today),
		owed: {
			toMajeurs: { amount: 4543500, invoices: 2 },
			toSuppliers: { amount: 1822000, purchaseOrders: 3 },
		},
	};
}
