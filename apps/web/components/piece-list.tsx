import type { Locale } from "@repo/internationalization";
import { Link } from "@repo/internationalization/navigation";
import { localized } from "@repo/sal-data";
import { getTranslations } from "next-intl/server";

interface PieceRow {
  category: string;
  contributor: { name_ar: string | null; name_en: string; slug: string } | null;
  id: string;
  members_only: boolean;
  slug: string;
  title_ar: string | null;
  title_en: string | null;
  readonly [key: string]: unknown;
}

/** Pieces with their category and contributor. */
export const PieceList = async ({
  locale,
  pieces,
  showContributor = true,
}: {
  locale: Locale;
  pieces: readonly PieceRow[];
  showContributor?: boolean;
}) => {
  const t = await getTranslations({ locale, namespace: "web.journal" });
  return (
    <ul className="grid gap-4">
      {pieces.map((piece) => (
        <li className="grid gap-1 border-rule border-b pb-4" key={piece.id}>
          <p className="type-kicker">
            {t(`categories.${piece.category as "poetry"}`)}
            {piece.members_only ? ` · ${t("membersOnly")}` : ""}
          </p>
          <h3 className="type-subheading">
            <Link
              className="underline-offset-4 hover:underline"
              href={`/journal/pieces/${piece.slug}`}
            >
              {localized(piece, "title", locale)}
            </Link>
          </h3>
          {showContributor && piece.contributor ? (
            <p className="type-caption">
              <Link
                className="underline-offset-4 hover:underline"
                href={`/journal/contributors/${piece.contributor.slug}`}
              >
                {localized(piece.contributor, "name", locale)}
              </Link>
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
};
