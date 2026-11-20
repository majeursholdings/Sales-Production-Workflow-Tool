import Image from "next/image";
import type { ReactNode } from "react";

/**
 * Split screen: charcoal brand panel on one side, the form on the other.
 * The panel is decorative (aria-hidden) and stacks above the form on narrow screens.
 * Its colours are fixed brand colours, so it looks the same in light and dark mode.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
	return (
		<div className="flex min-h-screen flex-wrap bg-page">
			<section
				aria-hidden="true"
				className="flex min-h-70 flex-[1_1_480px] flex-col justify-between gap-8 bg-brand-charcoal p-8 md:p-12"
			>
				<Image
					src="/majeurs-logo-white.png"
					alt=""
					width={160}
					height={25}
					priority
					className="h-auto w-40"
				/>
				<div className="flex max-w-110 flex-col gap-4">
					<span className="block h-1 w-12 bg-brand-gold" />
					<p className="font-display text-[32px] leading-[1.15] font-bold tracking-[-0.01em] text-[#fefdfd]">
						Quotes built from real parts, real costs and one source of truth.
					</p>
					<p className="text-body text-[#d8d4d0]">
						For customer care, sales, procurement, production and accounting.
					</p>
				</div>
			</section>
			<div className="flex flex-[1_1_480px] items-center justify-center px-6 py-12">
				<div className="flex w-full max-w-100 flex-col gap-5">{children}</div>
			</div>
		</div>
	);
}
