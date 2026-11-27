import ProfileForm from "@/components/settings/profileForm";
import { getProfileSettings } from "@/lib/profileSettings";
import { getCurrentUser } from "@/lib/session";

export default async function SettingsProfilePage() {
	const [user, settings] = await Promise.all([getCurrentUser(), getProfileSettings()]);
	return (
		<ProfileForm
			initialName={user.name}
			initialTitle={settings.title}
			initialFirstName={settings.firstName}
			initialSurname={settings.surname}
			email={user.email}
			initialPhone={user.phone}
			roleLabel={user.role}
			initialSignature={settings.emailSignature}
		/>
	);
}
