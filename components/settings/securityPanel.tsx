import PasswordCard from "./passwordCard";
import SessionsCard from "./sessionsCard";
import TwoStepCard, { type EnrolledFactor } from "./twoStepCard";

/** Security & sign-in: two-step verification, password, and where you're signed in. */
export default function SecurityPanel({
	email,
	factors,
}: {
	email: string;
	factors: EnrolledFactor[];
}) {
	return (
		<>
			<TwoStepCard factors={factors} />
			<PasswordCard email={email} />
			<SessionsCard />
		</>
	);
}
