import { LinkButton } from "@/components/common/buttons";

export default function NotFound() {
	return (
		<div className="mx-auto flex min-h-screen max-w-md flex-col items-start justify-center gap-4 px-4">
			<h1>Page not found</h1>
			<p className="text-fg-secondary">
				The page you are looking for doesn&apos;t exist or has moved.
			</p>
			<LinkButton href="/" variant="primary">
				Back to dashboard
			</LinkButton>
		</div>
	);
}
