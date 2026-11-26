"use client";

import { useState } from "react";
import LockoutReviewCard from "./lockoutReviewCard";
import PasswordCard from "./passwordCard";
import SessionsCard from "./sessionsCard";
import TwoStepCard, { type EnrolledFactor } from "./twoStepCard";

/** Security & sign-in: lockout review (after an unlock), two-step verification, password, and where you're signed in. */
export default function SecurityPanel({
	email,
	factors,
	emailOn,
	lockoutReview,
	requireTwoStep,
}: {
	email: string;
	factors: EnrolledFactor[];
	/** Two-step codes by email are on. */
	emailOn: boolean;
	/** Just unlocked after a lockout; the person hasn't said whether it was them. */
	lockoutReview: boolean;
	/** Company policy requires at least one two-step method to stay enabled. */
	requireTwoStep: boolean;
}) {
	const [notMe, setNotMe] = useState(false);
	const mustChange = lockoutReview && notMe;

	return (
		<>
			{lockoutReview && <LockoutReviewCard onNotMe={() => setNotMe(true)} />}
			{mustChange && <PasswordCard mustChange />}
			<TwoStepCard
				factors={factors}
				email={email}
				emailOn={emailOn}
				requireTwoStep={requireTwoStep}
			/>
			{!mustChange && <PasswordCard />}
			<SessionsCard />
		</>
	);
}
