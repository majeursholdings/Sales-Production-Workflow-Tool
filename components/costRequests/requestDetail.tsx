"use client";

import { useId, useRef, useState } from "react";
import Link from "next/link";
import { Ban, Check, CircleAlert, Plus } from "lucide-react";
import { useForm, type FieldValues, type UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import { Badge } from "@/components/common/badge";
import { Button } from "@/components/common/buttons";
import { Avatar, Card } from "@/components/common/card";
import { ConfirmDialog } from "@/components/common/modal";
import { FormField } from "@/components/forms";
import { IMAGE_ACCEPT } from "@/components/forms/fileRules";
import type { FormFieldConfig } from "@/components/forms/types";
import { cn } from "@/lib/cn";
import {
	DECLINE_REASONS,
	REQUEST_STATUS,
	ageLabel,
	firstName,
	initials,
	naira,
	neededLabel,
	statusOf,
	type CostRequest,
	type DeclineReason,
	type Review,
} from "@/lib/costRequests";
import { MAX_PHOTOS_PER_UPLOAD, MAX_PHOTO_BYTES, resolvePhotoType } from "@/lib/storage";
import { uploadStorageFiles } from "@/lib/storageClient";
import type { SupplierCatalog } from "@/lib/suppliers";
import PartsTable, { type RenderField } from "./partsTable";
import RequestPhoto from "./requestPhoto";

type AskValues = { question: string };
type DeclineValues = { reason: DeclineReason; alternative: string };
type ApproveValues = { saveAsType: boolean };

/** Renders fields of one react-hook-form form with the shared FormField. */
function fieldsOf<T extends FieldValues>(form: UseFormReturn<T>, prefix: string) {
	return function renderField(config: FormFieldConfig) {
		return (
			<FormField<T>
				key={config.name}
				field={{ ...config, id: `${prefix}-${config.name}` }}
				register={form.register}
				control={form.control}
				getValues={form.getValues}
				setValue={form.setValue}
				errors={form.formState.errors}
				hideRequiredMark
			/>
		);
	};
}

/** Ready-made questions: one per part the agent is unsure of or couldn't match, plus a site photo. */
function quickQuestions(review: Review) {
	return [
		...review.rows
			.filter((r) => r.unsure)
			.map((r) => ({
				label: `${r.part.use}?`,
				text: `Does the client want the ${r.part.name.toLowerCase()}? ${r.part.doubt ?? "The photo doesn't show it clearly."}`,
			})),
		...review.rows
			.filter((r) => r.missing)
			.map((r) => ({
				label: `${r.part.use} detail?`,
				text: `Could you send a close-up of the ${r.part.name.toLowerCase()}? It isn't in inventory, so I need to see exactly what it is.`,
			})),
		{ label: "Site photo?", text: "Could you send a photo of the room where it will sit?" },
	];
}

/** One request: the photo, the agent's parts list, the price, and what procurement does next. */
export default function RequestDetail({
	request,
	review,
	catalog,
	now,
	focus,
	pending,
	onFocus,
	field,
	onApprove,
	onAsk,
	onDecline,
	onReopen,
	onAddImages,
}: {
	request: CostRequest;
	review: Review;
	catalog: SupplierCatalog;
	now: string;
	focus: string | null;
	/** A change is being saved: actions are disabled until it's done. */
	pending: boolean;
	onFocus: (partId: string | null) => void;
	/** Renders a field of the page's fix form, for the flagged parts. */
	field: RenderField;
	onApprove: (saveAsType: boolean) => void;
	/** Resolves true once the question is saved. */
	onAsk: (question: string) => Promise<boolean>;
	/** Resolves true once the request is marked can't source. */
	onDecline: (reason: DeclineReason, alternative: string) => Promise<boolean>;
	onReopen: () => void;
	onAddImages: (images: { src: string; alt: string }[]) => Promise<boolean>;
}) {
	const id = useId();
	const quick = quickQuestions(review);
	const [asking, setAsking] = useState(false);
	const [declining, setDeclining] = useState(false);
	const [activeImage, setActiveImage] = useState(0);
	const [uploading, setUploading] = useState(false);
	const photoInputRef = useRef<HTMLInputElement>(null);

	const askForm = useForm<AskValues>({ mode: "onTouched", defaultValues: { question: "" } });
	const declineForm = useForm<DeclineValues>({
		defaultValues: { reason: "deadline", alternative: "" },
	});
	const approveForm = useForm<ApproveValues>({ defaultValues: { saveAsType: true } });
	const askField = fieldsOf(askForm, `${id}-ask`);
	const declineField = fieldsOf(declineForm, `${id}-decline`);
	const approveField = fieldsOf(approveForm, `${id}-approve`);

	const status = statusOf(request);
	const open = request.status === "open";
	const by = firstName(request.requestedBy);
	const safeIndex = Math.min(activeImage, Math.max(0, request.images.length - 1));
	const image = request.images[safeIndex];

	const uploadMorePhotos = async (files: FileList | null) => {
		if (!files?.length) return;
		const valid: File[] = [];
		for (const file of Array.from(files).slice(0, MAX_PHOTOS_PER_UPLOAD)) {
			if (file.size > MAX_PHOTO_BYTES) {
				toast.error(`${file.name} is larger than 10 MB.`);
				continue;
			}
			if (!resolvePhotoType(file)) {
				toast.error(`${file.name} isn't a supported image.`);
				continue;
			}
			valid.push(file);
		}
		if (valid.length === 0) return;
		setUploading(true);
		try {
			const uploaded = await uploadStorageFiles("cost-requests", valid);
			if (!uploaded.ok) {
				toast.error(uploaded.message);
				return;
			}
			await onAddImages(
				uploaded.urls.map((src, i) => ({
					src,
					alt: valid[i]?.name.replace(/\.[^.]+$/, "") || `Reference photo`,
				})),
			);
		} finally {
			setUploading(false);
		}
	};

	const downloadAll = () => {
		for (const img of request.images) {
			const a = document.createElement("a");
			a.href = img.src;
			a.download = img.src.split("/").pop() ?? "photo";
			a.click();
		}
	};

	return (
		<Card aria-labelledby={`${id}-title`} className="min-w-0 flex-[999_1_640px] gap-5">
			<div className="flex flex-wrap items-start gap-3">
				<div className="flex min-w-0 flex-1 flex-col gap-1">
					<span className="text-small text-fg-tertiary">
						{request.id} · for quote{" "}
						<Link href={`/quotes/${request.quote}`} className="text-fg-secondary">
							{request.quote}
						</Link>
					</span>
					<h2 id={`${id}-title`} className="text-xl leading-tight">
						{request.title}
					</h2>
					<p className="text-small text-fg-secondary">
						{request.target} · requested by {request.requestedBy} ·{" "}
						{ageLabel(request.requestedAt, now)} · needed by{" "}
						{neededLabel(request.neededBy)}
					</p>
				</div>
				<Badge variant={REQUEST_STATUS[status].tone}>{REQUEST_STATUS[status].label}</Badge>
			</div>

			<div className="flex flex-wrap items-start gap-6">
				<div className="flex max-w-90 min-w-0 flex-[1_1_280px] flex-col gap-3">
					{image && (
						<RequestPhoto
							image={image}
							rows={safeIndex === 0 ? review.rows : []}
							focus={focus}
							onFocus={onFocus}
						/>
					)}
					{request.images.length > 1 && (
						<ul className="flex flex-wrap gap-2" aria-label="Reference photos">
							{request.images.map((img, i) => (
								<li key={img.src}>
									<button
										type="button"
										onClick={() => setActiveImage(i)}
										aria-current={i === safeIndex ? "true" : undefined}
										className={cn(
											"block cursor-pointer overflow-hidden rounded-md border-2",
											i === safeIndex ? "border-accent" : "border-line",
										)}
									>
										{/* eslint-disable-next-line @next/next/no-img-element -- served from authenticated /api/storage route */}
										<img
											src={img.src}
											alt={img.alt || `Reference photo ${i + 1}`}
											className="size-12 object-cover"
										/>
									</button>
								</li>
							))}
						</ul>
					)}
					<div className="flex flex-wrap items-center gap-2">
						<span className="flex-1 text-small text-fg-secondary">
							{request.images.length} image{request.images.length === 1 ? "" : "s"}{" "}
							from {by}
						</span>
						{open && (
							<>
								<input
									ref={photoInputRef}
									type="file"
									accept={IMAGE_ACCEPT}
									multiple
									className="hidden"
									onChange={(e) => {
										uploadMorePhotos(e.target.files);
										e.target.value = "";
									}}
								/>
								<Button
									size="sm"
									disabled={pending || uploading}
									onClick={() => photoInputRef.current?.click()}
								>
									<Plus />
									{uploading ? "Uploading…" : "Add photos"}
								</Button>
							</>
						)}
						{request.images.length > 0 && (
							<Button variant="ghost" size="sm" onClick={downloadAll}>
								Download all
							</Button>
						)}
					</div>
					<dl className="grid grid-cols-2 gap-3 text-body">
						<div>
							<dt className="text-small text-fg-tertiary">Client</dt>
							<dd>{request.client}</dd>
						</div>
						<div>
							<dt className="text-small text-fg-tertiary">Size · quantity</dt>
							<dd>
								{request.size} · {request.quantity}
							</dd>
						</div>
						<div className="col-span-2">
							<dt className="text-small text-fg-tertiary">Notes from {by}</dt>
							<dd className="text-fg-secondary">{request.notes}</dd>
						</div>
					</dl>
				</div>

				<div className="flex min-w-0 flex-[999_1_420px] flex-col gap-4">
					{open && review.flags.length > 0 && (
						<div className="flex gap-3 rounded-md border border-warning-line bg-warning-subtle px-4 py-3 text-body text-fg">
							<CircleAlert
								aria-hidden="true"
								className="mt-0.5 size-5 shrink-0 text-warning-fg"
							/>
							<div className="flex flex-col gap-2">
								<strong>
									The agent matched {review.rows.length - review.flagged} of{" "}
									{review.rows.length} parts. Check{" "}
									{review.flagged === 1 ? "this one" : `these ${review.flagged}`}:
								</strong>
								<ul className="flex list-disc flex-col gap-1 ps-5">
									{review.flags.map((f) => (
										<li key={f}>{f}</li>
									))}
								</ul>
							</div>
						</div>
					)}

					<PartsTable
						request={request}
						rows={review.rows}
						catalog={catalog}
						editable={open}
						focus={focus}
						onFocus={onFocus}
						field={field}
					/>

					<div className="flex flex-col gap-2 rounded-lg border border-line bg-page p-4 text-body">
						<div className="flex justify-between gap-3">
							<span className="text-fg-secondary">Parts and labour, per piece</span>
							<span className="tabular">{naira(review.cost)}</span>
						</div>
						<div className="flex justify-between gap-3">
							<span className="text-fg-secondary">
								Markup ({request.markupPercent}%, {request.markupCategory})
							</span>
							<span className="tabular">{naira(review.markup)}</span>
						</div>
						<hr className="border-line" />
						<div className="flex justify-between gap-3 font-bold">
							<span>
								{request.newPiece
									? "Price per piece, before VAT"
									: "Adds to the item price, per piece"}
							</span>
							<span className="tabular">
								{naira(review.price)}
								{open && review.open > 0 ? " so far" : ""}
							</span>
						</div>
					</div>
				</div>
			</div>

			{request.questions.length > 0 && (
				<section
					aria-labelledby={`${id}-questions`}
					className="flex flex-col gap-3 border-t border-line pt-5"
				>
					<h3 id={`${id}-questions`} className="text-h3">
						Questions
					</h3>
					<ul className="flex flex-col gap-3">
						{request.questions.map((q) => (
							<li key={q.id} className="flex items-start gap-3 text-body">
								<Avatar initials={initials(q.by)} />
								<span className="flex-1">
									{q.text}
									<span className="block text-small text-fg-tertiary">
										{q.by} · {ageLabel(q.at, now)}
									</span>
								</span>
							</li>
						))}
					</ul>
					{status === "waiting" && (
						<p className="text-small text-fg-secondary">
							Waiting for {by}. The quote stays blocked until you approve the parts
							list.
						</p>
					)}
				</section>
			)}

			{open && asking && (
				<form
					noValidate
					aria-labelledby={`${id}-ask-title`}
					onSubmit={askForm.handleSubmit(async (v) => {
						if (!(await onAsk(v.question.trim()))) return;
						askForm.reset();
						setAsking(false);
					})}
					className="flex flex-col gap-4 border-t border-line pt-5"
				>
					<h3 id={`${id}-ask-title`} className="text-h3">
						Ask {by} a question
					</h3>
					<div className="flex flex-wrap gap-2">
						{quick.map((q) => (
							<Button
								key={q.label}
								size="sm"
								onClick={() =>
									askForm.setValue("question", q.text, { shouldValidate: true })
								}
							>
								{q.label}
							</Button>
						))}
					</div>
					{askField({
						name: "question",
						type: "textarea",
						label: "Question",
						placeholder: quick[0]?.text,
						rows: 4,
						description: `${by} gets it in the app. The request shows “Waiting on reply” until they answer.`,
						validation: {
							validate: (v: string) => !!v?.trim() || "Write your question",
						},
					})}
					<div className="flex flex-wrap gap-3">
						<Button type="submit" variant="primary" disabled={pending}>
							Send question
						</Button>
						<Button onClick={() => setAsking(false)}>Cancel</Button>
					</div>
				</form>
			)}

			{request.status === "declined" && (
				<div
					role="status"
					className="flex gap-3 rounded-md border border-danger-line bg-danger-subtle px-4 py-3 text-body text-fg"
				>
					<Ban aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-danger-fg" />
					<p className="flex-1">
						<strong>Marked can&apos;t source: {request.declineReason}.</strong> {by} can
						change the design or remove the line from {request.quote}.
						{request.alternative && ` Suggested instead: ${request.alternative}`}{" "}
						<Button variant="ghost" size="sm" disabled={pending} onClick={onReopen}>
							Reopen request
						</Button>
					</p>
				</div>
			)}

			{open && !asking && (
				<form
					noValidate
					onSubmit={approveForm.handleSubmit((v) =>
						onApprove(request.newPiece && v.saveAsType),
					)}
					className="flex flex-col gap-3 border-t border-line pt-5"
				>
					{request.newPiece &&
						approveField({
							name: "saveAsType",
							type: "checkbox",
							label: "Also save as a new furniture type, so it can be quoted from the catalogue next time",
						})}
					<div className="flex flex-wrap items-center gap-3">
						<Button
							type="submit"
							variant="primary"
							disabled={pending || review.open > 0}
						>
							Approve parts list
						</Button>
						<Button onClick={() => setAsking(true)}>Ask a question</Button>
						<Button
							variant="danger"
							disabled={pending}
							onClick={() => setDeclining(true)}
						>
							Can&apos;t source
						</Button>
						{review.open > 0 && (
							<span className="text-small text-fg-secondary">
								Sort out {review.open} flagged part{review.open === 1 ? "" : "s"} to
								approve.
							</span>
						)}
					</div>
				</form>
			)}

			{request.status === "approved" && (
				<div
					role="status"
					className="flex gap-3 rounded-md border border-success-line bg-success-subtle px-4 py-3 text-body text-fg"
				>
					<Check aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-success-fg" />
					<p className="flex-1">
						<strong>
							Approved at {naira(request.approvedCost ?? review.cost)} cost
						</strong>{" "}
						by {request.approvedBy}. The line on{" "}
						<Link href={`/quotes/${request.quote}`}>{request.quote}</Link> can now be
						priced.
						{request.newPiece && request.saveAsType && (
							<>
								{" "}
								Next:{" "}
								<Link href="/furniture-types/new">
									create the furniture type
								</Link>{" "}
								so it can be quoted from the catalogue.
							</>
						)}
					</p>
				</div>
			)}

			{declining && (
				<ConfirmDialog
					title={`Can't source the ${request.title.toLowerCase()}?`}
					confirmLabel="Mark can't source"
					cancelLabel="Keep request open"
					onConfirm={declineForm.handleSubmit(async (v) => {
						if (await onDecline(v.reason, v.alternative.trim())) setDeclining(false);
					})}
					onCancel={() => setDeclining(false)}
				>
					<div className="flex flex-col gap-4">
						<p>
							{by} will be told it can&apos;t be made. The line on {request.quote}{" "}
							stays blocked until they change the design or remove it.
						</p>
						{declineField({
							name: "reason",
							type: "radio",
							label: "Why not?",
							options: DECLINE_REASONS.map((r) => ({
								label: r.label,
								value: r.value,
							})),
						})}
						{declineField({
							name: "alternative",
							type: "textarea",
							label: "Suggest an alternative (optional)",
							placeholder:
								"e.g. The same sofa on tapered brass legs is ₦1,020,000 and ready in 3 weeks.",
							rows: 3,
						})}
					</div>
				</ConfirmDialog>
			)}
		</Card>
	);
}
