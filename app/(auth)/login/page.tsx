import type { Metadata } from "next";
import LoginForm from "@/components/auth/loginForm";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
	return <LoginForm />;
}
