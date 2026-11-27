import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Encrypts API keys before they're stored, with AES-256-GCM under a key derived
 * from AI_KEYS_SECRET. Without that secret, keys can't be saved or read.
 */

const VERSION = "v1";

function secretKey(): Buffer | null {
	if (typeof window !== "undefined") throw new Error("secretBox is server-only.");
	const secret = process.env.AI_KEYS_SECRET?.trim();
	if (!secret || secret.length < 32) return null;
	return createHash("sha256").update(secret).digest();
}

export const canEncrypt = () => secretKey() !== null;

export function encryptSecret(plain: string): string {
	const key = secretKey();
	if (!key) throw new Error("AI_KEYS_SECRET is missing or shorter than 32 characters.");
	const iv = randomBytes(12);
	const cipher = createCipheriv("aes-256-gcm", key, iv);
	const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
	return `${VERSION}:${Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64")}`;
}

/** Null when the secret is missing or changed, or the value was tampered with. */
export function decryptSecret(stored: string): string | null {
	const key = secretKey();
	const [version, payload] = stored.split(":");
	if (!key || version !== VERSION || !payload) return null;
	try {
		const raw = Buffer.from(payload, "base64");
		const decipher = createDecipheriv("aes-256-gcm", key, raw.subarray(0, 12));
		decipher.setAuthTag(raw.subarray(12, 28));
		return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString(
			"utf8",
		);
	} catch {
		return null;
	}
}
