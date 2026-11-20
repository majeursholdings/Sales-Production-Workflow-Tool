"use client";

import { useState, type KeyboardEvent, type ReactNode } from "react";
import { useController, useForm, useWatch, type Control } from "react-hook-form";
import { Loader2, Star } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/cn";
import MainForm from "./index";
import type { FormFieldConfig } from "./types";
import { Button } from "@/components/common/buttons";
import { API_PHOTO_ACCEPT, DEFAULT_MAX_FILE_SIZE_MB } from "./fileRules";

const getErrorMessage = (err: unknown, fallback: string) =>
	err instanceof Error && err.message ? err.message : fallback;

export type RatingReview = {
	rating: number;
	comment: string;
	/** Picked photos: send with toFormData */
	photos?: File[];
};

type RatingReviewFormValues = {
	rating: number;
	comment: string;
	photos?: FileList | File[] | null;
};

const MAX_RATING = 5;
const RATING_LABELS = ["Poor", "Fair", "Good", "Very good", "Excellent"];
export const REVIEW_MAX_LENGTH = 120;

// ─────────────────────────────────────────────────────────────────────────────
// RatingReviewForm — five stars and a short review of a Majeurs piece, with
// optional customer photos. The button stays off until both a rating and a
// review are given, and its label can follow the rating.
// ─────────────────────────────────────────────────────────────────────────────

export default function RatingReviewForm({
	ratingLabel,
	placeholder = "Give reasons for your rating above",
	submitLabel,
	loadingLabel,
	errorMessage,
	withPhotos = false,
	onSubmit,
}: {
	/** Over the stars, e.g. "Rate this piece". */
	ratingLabel: string;
	placeholder?: string;
	/** The button's label for the chosen rating (0 before one's chosen). */
	submitLabel: string | ((rating: number) => string);
	loadingLabel: string;
	/** Shown if saving fails. */
	errorMessage: string;
	/** Let the customer add photos of the piece in their space. */
	withPhotos?: boolean;
	onSubmit: (review: RatingReview) => void | Promise<void>;
}) {
	const [isLoading, setIsLoading] = useState(false);
	const methods = useForm<RatingReviewFormValues>({
		mode: "onTouched",
		defaultValues: { rating: 0, comment: "", photos: null },
	});
	const rating = useWatch({ control: methods.control, name: "rating" });

	const fields: FormFieldConfig[] = [
		{
			name: "comment",
			type: "textarea",
			label: "Review",
			placeholder,
			height: 88,
			validation: {
				required: "Give a reason for your rating",
				validate: (value: string) =>
					value.trim().length > 0 || "Give a reason for your rating",
				maxLength: {
					value: REVIEW_MAX_LENGTH,
					message: `Keep it under ${REVIEW_MAX_LENGTH} characters`,
				},
			},
		},
		...(withPhotos
			? [
					{
						name: "photos",
						type: "image" as const,
						label: (
							<>
								Photos{" "}
								<span className="font-normal text-fg-tertiary">
									(optional, the piece in your space)
								</span>
							</>
						),
						description: `JPG, PNG or WebP, up to ${DEFAULT_MAX_FILE_SIZE_MB}MB each`,
						accept: API_PHOTO_ACCEPT,
						multiple: true,
						maxFiles: 5,
					},
				]
			: []),
	];

	const handleSubmit = async ({
		rating,
		comment,
		photos: photoFiles,
	}: RatingReviewFormValues) => {
		setIsLoading(true);
		try {
			const photos = Array.from((photoFiles as File[] | FileList | null) ?? []).filter(
				(f): f is File => f instanceof File,
			);

			await onSubmit({ rating, comment: comment.trim(), photos });
		} catch (err: unknown) {
			const message = getErrorMessage(err, errorMessage);
			toast.error(message);
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="flex flex-col gap-6">
			<StarRatingInput control={methods.control} label={ratingLabel} />
			<MainForm<RatingReviewFormValues>
				methods={methods}
				fields={fields}
				onSubmit={handleSubmit}
				isLoading={isLoading}
				hideRequiredMarks
				renderFooter={({ isLoading, canSubmit }) => (
					<div className="flex justify-end pt-2">
						<Button
							type="submit"
							variant="primary"
							disabled={isLoading || !canSubmit || rating === 0}
						>
							{isLoading ? (
								<>
									<Loader2 className="size-4 animate-spin" />
									{loadingLabel}
								</>
							) : typeof submitLabel === "function" ? (
								submitLabel(rating)
							) : (
								submitLabel
							)}
						</Button>
					</div>
				)}
			/>
		</div>
	);
}

/** Five big stars as a radio group — click one, or use the arrow keys. */
function StarRatingInput({
	control,
	label,
}: {
	control: Control<RatingReviewFormValues>;
	label: ReactNode;
}) {
	const { field } = useController({ control, name: "rating", rules: { min: 1 } });
	const [hovered, setHovered] = useState(0);
	const shown = hovered || field.value;

	const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		const step =
			event.key === "ArrowRight" || event.key === "ArrowUp"
				? 1
				: event.key === "ArrowLeft" || event.key === "ArrowDown"
					? -1
					: 0;
		if (!step) return;
		event.preventDefault();
		field.onChange(Math.min(MAX_RATING, Math.max(1, (field.value || 0) + step)));
	};

	return (
		<div className="flex flex-col gap-3">
			<span id="rating-label" className="text-body font-bold">
				{label}
			</span>
			<div
				role="radiogroup"
				aria-labelledby="rating-label"
				onKeyDown={handleKeyDown}
				onMouseLeave={() => setHovered(0)}
				className="flex items-center justify-between px-2"
			>
				{Array.from({ length: MAX_RATING }, (_, index) => {
					const value = index + 1;
					return (
						<button
							key={value}
							type="button"
							role="radio"
							aria-checked={field.value === value}
							aria-label={`${value} star${value === 1 ? "" : "s"}, ${RATING_LABELS[index]}`}
							// One tab stop for the group, on the chosen star (or the first)
							tabIndex={
								field.value === value || (field.value === 0 && value === 1) ? 0 : -1
							}
							onClick={() => field.onChange(value)}
							onMouseEnter={() => setHovered(value)}
							className="cursor-pointer rounded-md p-1"
						>
							<Star
								className={cn(
									"size-9 transition-colors duration-150",
									value <= shown
										? "fill-brand-gold text-brand-gold"
										: "fill-subtle text-line-strong",
								)}
								strokeWidth={1.5}
							/>
						</button>
					);
				})}
			</div>
			<span className="h-4 text-center text-small text-fg-secondary" aria-live="polite">
				{shown > 0 ? RATING_LABELS[shown - 1] : ""}
			</span>
		</div>
	);
}
