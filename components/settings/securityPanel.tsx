import PasswordCard from "./passwordCard";
import SessionsCard from "./sessionsCard";
import TwoStepCard, { type EnrolledFactor } from "./twoStepCard";

/** Security & sign-in: two-step verification, password, and where you're signed in. */
export default function SecurityPanel({
	email,
	factors,
	emailOn,
}: {
	email: string;
	factors: EnrolledFactor[];
	/** Two-step codes by email are on. */
	emailOn: boolean;
}) {
	return (
		<>
			<TwoStepCard factors={factors} email={email} emailOn={emailOn} />
			<PasswordCard email={email} />
			<SessionsCard />
		</>
	);
}
