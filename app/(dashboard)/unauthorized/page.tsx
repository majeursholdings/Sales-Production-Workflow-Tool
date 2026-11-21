import { ShieldAlert } from "lucide-react";
import { LinkButton } from "@/components/common/buttons";
import { Card } from "@/components/common/card";
import PageWrapper from "@/components/layout/pageWrapper";
import { getCurrentUser } from "@/lib/session";

export default async function UnauthorizedPage() {
	const user = await getCurrentUser();

	return (
		<PageWrapper>
			<div className="mx-auto flex w-full max-w-lg flex-col py-12">
				<Card className="items-start gap-4">
					<span className="grid size-11 place-items-center rounded-lg bg-warning-subtle text-warning-fg">
						<ShieldAlert className="size-5" aria-hidden="true" />
					</span>
					<div className="flex flex-col gap-1.5">
						<h1 className="text-xl font-bold">
							You don&apos;t have access to this page
						</h1>
						<p className="text-body text-fg-secondary">
							Your current role is <strong className="text-fg">{user.role}</strong>.
							If you need access to this area, ask your MD or GM to review your role
							in Team &amp; access.
						</p>
					</div>
					<LinkButton href="/" variant="primary">
						Back to dashboard
					</LinkButton>
				</Card>
			</div>
		</PageWrapper>
	);
}
