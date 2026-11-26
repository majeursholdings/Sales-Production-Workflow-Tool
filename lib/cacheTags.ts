/**
 * Shared Next.js cache tags for slow-changing, non-user-specific configuration.
 *
 * Every Server Action that mutates one of these tables calls `updateTag(...)`
 * for read-your-own-writes consistency, so cached reads stay fast without
 * serving stale configuration after an edit.
 */
export const CACHE_TAGS = {
	companySettings: "company-settings",
	pricingRules: "pricing-rules",
	markupCategories: "markup-categories",
	costItems: "cost-items",
	overheadSettings: "overhead-settings",
} as const;
