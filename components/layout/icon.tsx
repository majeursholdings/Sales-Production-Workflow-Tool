import Image from "next/image";

type IconProps = {
	mode: "light" | "dark";
};

export default function Icon({ mode }: IconProps) {
	return (
		<Image
			src={mode === "light" ? `/logo-icon-black.png` : `/logo-icon-white.png`}
			alt="Majeurs Icon"
			width={20}
			height={20}
		/>
	);
}
