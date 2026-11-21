import ProfileForm from "@/components/settings/profileForm";
import { getCurrentUser } from "@/lib/session";

export default async function SettingsProfilePage() {
	const user = await getCurrentUser();
	return (
		<ProfileForm
			userId={user.id}
			initialName={user.name}
			email={user.email}
			initialPhone={user.phone}
			roleLabel={user.role}
		/>
	);
}
