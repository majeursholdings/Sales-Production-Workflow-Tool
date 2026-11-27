// Downloads Google's open address metadata (libaddressinput, the data behind
// Chrome and Android address autofill) for every country and writes the parts
// the address form needs to lib/address/formats.json.
//
// Run again to refresh: `npm run address:formats`. The app never calls Google.

import { writeFile } from "node:fs/promises";

const BASE = "https://chromium-i18n.appspot.com/ssl-address/data";
const OUT = new URL("../lib/address/formats.json", import.meta.url);

const get = async (path) => {
	const res = await fetch(path ? `${BASE}/${path}` : BASE, { redirect: "follow" });
	if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
	return res.json();
};

const split = (s) => (s ? s.split("~") : []);

/** Only what the form uses; short keys keep the file small. */
function compact(d) {
	const keys = split(d.sub_keys);
	// Latin names first (e.g. China, Japan), then local names, then the keys themselves (e.g. Nigeria).
	const names = split(d.sub_lnames ?? d.sub_names);
	const out = {
		fmt: d.fmt,
		req: d.require,
		zip: d.zip,
		zipex: d.zipex?.split(",")[0],
		zipName: d.zip_name_type,
		stateName: d.state_name_type,
		cityName: d.locality_name_type,
		areaName: d.sublocality_name_type,
		states: keys.length ? keys.map((k, i) => names[i] || k) : undefined,
	};
	return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined && v !== ""));
}

const { countries } = await get("");
const codes = ["ZZ", ...countries.split("~")];
const formats = {};
for (let i = 0; i < codes.length; i += 20) {
	const batch = codes.slice(i, i + 20);
	const data = await Promise.all(batch.map((c) => get(c)));
	batch.forEach((c, j) => (formats[c] = compact(data[j])));
}

await writeFile(OUT, JSON.stringify(formats));
console.log(`Wrote ${codes.length - 1} countries to ${OUT.pathname}`);
