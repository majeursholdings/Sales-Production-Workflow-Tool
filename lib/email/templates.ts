import type { Email } from "./mailer";

/**
 * The emails the app sends. Plain, table-free HTML with inline styles (what
 * email clients handle), plus a text version. Anything a person typed (names)
 * is escaped.
 */

const CHARCOAL = "#373435";
const GOLD = "#b5933e";

const ENTITIES: Record<string, string> = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	'"': "&quot;",
	"'": "&#39;",
};

function escape(value: string): string {
	return value.replace(/[&<>"']/g, (c) => ENTITIES[c]);
}

function layout(title: string, body: string): string {
	return `<!doctype html><html><body style="margin:0;padding:24px;background:#f5f4f2;font-family:Arial,Helvetica,sans-serif;color:${CHARCOAL}">
<div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden">
<div style="background:${CHARCOAL};padding:20px 28px;color:#fefdfd;font-size:18px;font-weight:bold;letter-spacing:0.04em">MAJEURS<div style="height:3px;width:40px;background:${GOLD};margin-top:10px"></div></div>
<div style="padding:28px;font-size:15px;line-height:1.55">
<h1 style="font-size:20px;margin:0 0 16px">${title}</h1>
${body}
</div></div></body></html>`;
}

function button(href: string, label: string): string {
	return `<p style="margin:24px 0"><a href="${escape(href)}" style="display:inline-block;background:${CHARCOAL};color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:6px">${label}</a></p>
<p style="font-size:13px;color:#6b6766">Or paste this link into your browser:<br><span style="word-break:break-all">${escape(href)}</span></p>`;
}

const muted = (text: string) => `<p style="font-size:13px;color:#6b6766">${text}</p>`;

/** Two-step sign-in code. A code only, never a link, so it can't sign anyone in without the password. */
export function signInCodeEmail(to: string, code: string): Email {
	return {
		to,
		subject: `${code} is your Majeurs sign-in code`,
		html: layout(
			"Your sign-in code",
			`<p>Enter this code to finish signing in:</p>
<p style="font-size:30px;font-weight:bold;letter-spacing:8px;margin:20px 0">${escape(code)}</p>
<p>It expires in 10 minutes and works once.</p>
${muted("If you didn't try to sign in, someone may know your password. Change it in Settings → Security, or tell your MD or GM.")}`,
		),
		text: `Your Majeurs sign-in code is ${code}. It expires in 10 minutes and works once.\n\nIf you didn't try to sign in, someone may know your password. Change it in Settings → Security, or tell your MD or GM.`,
	};
}

export function inviteEmail(to: string, fullName: string, link: string): Email {
	const first = fullName.trim().split(/\s+/)[0] || "there";
	return {
		to,
		subject: "You're invited to Majeurs",
		html: layout(
			`Welcome, ${escape(first)}`,
			`<p>Your MD or GM has set up a Majeurs account for you. Use the button below to set your password.</p>
${button(link, "Set up my account")}
<p>The link works for 48 hours. Sign-in codes will come to this email address; you can also add an authenticator app.</p>
${muted("If you weren't expecting this, you can ignore this email.")}`,
		),
		text: `Welcome, ${first}.\n\nYour MD or GM has set up a Majeurs account for you. Set your password here (the link works for 48 hours):\n${link}\n\nSign-in codes will come to this email address.\n\nIf you weren't expecting this, you can ignore this email.`,
	};
}

export function unlockEmail(to: string, link: string): Email {
	return {
		to,
		subject: "Your Majeurs account is unlocked",
		html: layout(
			"Your account is unlocked",
			`<p>Your account was locked after 5 incorrect passwords and signed out everywhere. Your MD or GM has now unlocked it.</p>
${button(link, "Sign in to Majeurs")}
<p>The link expires in 10 minutes and works once. Once you're in, we'll ask whether the incorrect passwords were you. If they weren't, you'll set a new, stronger password.</p>
${muted("If you didn't expect this, tell your MD or GM straight away.")}`,
		),
		text: `Your Majeurs account was locked after 5 incorrect passwords and signed out everywhere. Your MD or GM has now unlocked it.\n\nSign in (the link expires in 10 minutes and works once):\n${link}\n\nOnce you're in, we'll ask whether the incorrect passwords were you.`,
	};
}

export function passwordResetEmail(to: string, link: string): Email {
	return {
		to,
		subject: "Reset your Majeurs password",
		html: layout(
			"Reset your password",
			`<p>Use the button below to choose a new password.</p>
${button(link, "Choose a new password")}
<p>The link expires in 10 minutes and works once.</p>
${muted("If you didn't ask for this, you can ignore this email. Your password won't change.")}`,
		),
		text: `Choose a new Majeurs password (the link expires in 10 minutes and works once):\n${link}\n\nIf you didn't ask for this, you can ignore this email.`,
	};
}
