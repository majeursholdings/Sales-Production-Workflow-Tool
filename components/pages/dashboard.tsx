import PageTitle from "../layout/pageTitle";

type DashboardPageProps = {
	greeting: string;
};

export default function DashboardPage({ greeting }: DashboardPageProps) {
	return (
		<div>
			<PageTitle pageTitle={greeting} pageDescription="Saturday, 7 November 2026" />
		</div>
	);
}
