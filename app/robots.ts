import type { MetadataRoute } from "next";

// Internal dashboard: no bot may crawl anything.
export default function robots(): MetadataRoute.Robots {
	return {
		rules: { userAgent: "*", disallow: "/" },
	};
}
