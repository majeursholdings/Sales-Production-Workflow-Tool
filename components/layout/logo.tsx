import Image from "next/image";

type LogoProps = {
	mode: "light" | "dark";
};

export default function Logo({ mode }: LogoProps) {
	return (
		<Image
			src={mode === "light" ? `/majeurs-logo-black.png` : `/majeurs-logo-white.png`}
			alt="Majeurs Logo"
			width={104}
			height={16}
		/>
	);
}
