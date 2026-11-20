import type { Metadata } from "next";
import VerifyForm from "@/components/auth/verifyForm";

export const metadata: Metadata = { title: "Enter your sign-in code" };

export default function VerifyPage() {
	return <VerifyForm />;
}
