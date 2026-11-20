import PageTitle from "@/components/layout/pageTitle";
import PageWrapper from "@/components/layout/pageWrapper";
import { Button, LinkButton } from "@/components/common/buttons";
import { Settings } from "lucide-react";

export default function NotificationsPage() {
	return (
		<PageWrapper>
			<PageTitle
				pageTitle="Notifications"
				pageDescription="Alerts and updates that need your attention."
				actions={
					<>
						<Button disabled>Mark all as read</Button>
						<LinkButton
							href="/settings/notifications"
							variant="ghost"
							icon
							aria-label="Notification settings"
							title="Notification settings"
						>
							<Settings />
						</LinkButton>
					</>
				}
			/>
		</PageWrapper>
	);
}
