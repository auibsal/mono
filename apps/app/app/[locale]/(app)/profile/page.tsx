import { ProfileScreen } from "@/components/profile/profile-screen";
import { titleFrom } from "@/lib/metadata";

export const generateMetadata = titleFrom((t) => t("nexus.profile.title"));

const ProfilePage = () => <ProfileScreen />;

export default ProfilePage;
