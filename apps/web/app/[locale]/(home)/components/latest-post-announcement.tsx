import { blog } from "@repo/cms";
import { Button } from "@repo/design-system/components/ui/button";
import { Link } from "@repo/internationalization/navigation";
import { MoveRight } from "lucide-react";

interface LatestPostAnnouncementProps {
  readonly label: string;
}

export const LatestPostAnnouncement = async ({
  label,
}: LatestPostAnnouncementProps) => {
  const latestPost = await blog.getLatestPost();

  if (!latestPost) {
    return null;
  }

  return (
    <div>
      <Button asChild className="gap-4" size="sm" variant="secondary">
        <Link href={`/blog/${latestPost._slug}`}>
          {label} <MoveRight className="h-4 w-4 rtl:rotate-180" />
        </Link>
      </Button>
    </div>
  );
};
