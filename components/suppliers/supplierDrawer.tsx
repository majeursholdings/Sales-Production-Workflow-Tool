"use client";

import { useForm } from "react-hook-form";
import { Button } from "@/components/common/buttons";
import { Drawer } from "@/components/common/drawer";
import MainForm from "@/components/forms";
import { PHONE_PLACEHOLDER, validators } from "@/components/forms/form.validators";
import type { FormFieldConfig } from "@/components/forms/types";
import type { Supplier } from "@/lib/suppliers";

/** What the add / edit form collects. Materials, ratings and orders are managed on the supplier's page. */
export type SupplierDetails = Pick<
	Supplier,
	"business" | "contact" | "address" | "phone" | "email" | "bankDetails" | "notes"
>;

type Values = {
	contact: string;
	business: string;
	address: string;
	phone: string;
	email: string;
	bank: string;
	accountNumber: string;
	accountName: string;
	notes: string;
};

/** Add a supplier, or edit one's contact, bank and terms. */
export default function SupplierDrawer({
	supplier,
	onSave,
	onClose,
}: {
	/** The supplier being edited; leave out to add one. */
	supplier?: Supplier;
	onSave: (details: SupplierDetails) => void;
	onClose: () => void;
}) {
	const methods = useForm<Values>({ mode: "onTouched" });

	const fields: FormFieldConfig[] = [
		{
			name: "contact",
			type: "text",
			label: "Contact name",
			placeholder: "Person you deal with",
			defaultValue: supplier?.contact ?? "",
			validation: validators.required("Contact name"),
		},
		{
			name: "business",
			type: "text",
			label: "Business name",
			placeholder: "Registered or trading name",
			defaultValue: supplier?.business ?? "",
			validation: validators.required("Business name"),
		},
		{
			name: "address",
			type: "textarea",
			label: "Address",
			placeholder: "Street, area, city, state",
			defaultValue: supplier?.address ?? "",
			rows: 2,
			validation: validators.required("Address"),
		},
		{
			name: "phone",
			type: "tel",
			label: "Phone number",
			placeholder: PHONE_PLACEHOLDER,
			inputMode: "tel",
			defaultValue: supplier?.phone ?? "",
			validation: validators.phone(),
		},
		{
			name: "email",
			type: "email",
			label: "Email (optional)",
			placeholder: "name@example.com",
			defaultValue: supplier?.email ?? "",
			validation: {
				pattern: {
					value: /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,8}$/i,
					message: "Please enter a valid email address",
				},
			},
		},
		{
			name: "bank",
			type: "text",
			label: "Bank (optional)",
			placeholder: "e.g. Access Bank",
			defaultValue: supplier?.bankDetails.bank ?? "",
		},
		{
			name: "accountNumber",
			type: "text",
			label: "Account number (optional)",
			placeholder: "10 digits (NUBAN)",
			inputMode: "numeric",
			maxLength: 10,
			defaultValue: supplier?.bankDetails.accountNumber ?? "",
			validation: {
				pattern: { value: /^\d{10}$/, message: "Enter the 10-digit account number" },
			},
		},
		{
			name: "accountName",
			type: "text",
			label: "Account name (optional)",
			placeholder: "As it appears at the bank",
			description:
				"Accounting pays suppliers from these details. A change is flagged to Accounting, who confirm it with the supplier by phone before the next payment.",
			defaultValue: supplier?.bankDetails.accountName ?? "",
		},
		{
			name: "notes",
			type: "textarea",
			label: "Terms and notes (optional)",
			placeholder: "Payment terms, delivery days, minimum orders…",
			defaultValue: supplier?.notes ?? "",
			rows: 3,
		},
	];

	return (
		<Drawer
			title={supplier ? `Edit ${supplier.business}` : "Add supplier"}
			description="Fields marked optional can be left blank."
			onClose={onClose}
		>
			<MainForm<Values>
				methods={methods}
				fields={fields}
				rowPairs={[
					["phone", "email"],
					["bank", "accountNumber"],
				]}
				hideRequiredMarks
				onSubmit={(v) =>
					onSave({
						contact: v.contact.trim(),
						business: v.business.trim(),
						address: v.address.trim(),
						phone: v.phone.trim(),
						email: v.email?.trim() ?? "",
						bankDetails: {
							bank: v.bank?.trim() ?? "",
							accountNumber: v.accountNumber?.trim() ?? "",
							accountName: v.accountName?.trim() ?? "",
						},
						notes: v.notes?.trim() ?? "",
					})
				}
				renderFooter={({ canSubmit }) => (
					<>
						<p className="text-small text-fg-tertiary">
							{supplier
								? "Materials and ratings are managed on the supplier’s page."
								: "After saving, add the materials they supply and rate each one on the supplier’s page."}
						</p>
						<div className="flex flex-wrap items-center gap-3">
							<span className="flex-1" />
							<Button onClick={onClose}>Cancel</Button>
							<Button type="submit" variant="primary" disabled={!canSubmit}>
								{supplier ? "Save changes" : "Add supplier"}
							</Button>
						</div>
					</>
				)}
			/>
		</Drawer>
	);
}
