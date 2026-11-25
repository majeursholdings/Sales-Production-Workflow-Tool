export type MarkupCategory = {
	id: string;
	name: string;
	/** How many furniture types are in the category. */
	types: number;
	/** The markup now, as a percentage. */
	markup: number;
	/** The most the markup can be, as a percentage. */
	ceiling: number;
	/** A cost to show the price for. */
	exampleCost: number;
};

export type PricingRule = { label: string; who: string; value: string };
export type PricingChange = { what: string; who: string };
