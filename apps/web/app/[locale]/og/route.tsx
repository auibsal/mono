import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// The brand's share card on the tint ground (brand/components/SocialPost),
// at the Open Graph size. Colours from brand/tokens.json; logo as supplied.
// assets-og/ holds Ubuntu Arabic with its Extension lookups rewritten as
// direct ones (Satori cannot read type 7), and the symbol byte for byte.
const TINT = "#f7ecef";
const CRIMSON = "#9c213e";
const CRIMSON_700 = "#7e1a32";
const INK = "#273236";
const INK_SECONDARY = "#4a5559";

const SIZE = { height: 630, width: 1200 };
const WHITESPACE = /\s+/;

/** Words with their position in the text (a stable key). */
const wordsOf = (text: string) => {
  let at = 0;
  return text.split(WHITESPACE).map((word) => {
    const entry = { at, word };
    at += word.length + 1;
    return entry;
  });
};

const asset = (name: string) =>
  readFile(join(process.cwd(), "assets-og", name));

const NAME = {
  ar: "جمعية الفنون والآداب",
  en: "AUIB Society of Arts and Letters",
} as const;

/**
 * Satori lays words out left to right whatever the direction, so an Arabic
 * line is drawn as its words in a reversed, wrapping row starting at the
 * right. Letters within a word are shaped by the font as usual.
 */
const Line = ({
  rtl,
  style,
  text,
}: {
  rtl: boolean;
  style: Record<string, string | number>;
  text: string;
}) =>
  rtl ? (
    <div
      style={{
        ...style,
        columnGap: "0.12em",
        display: "flex",
        flexDirection: "row-reverse",
        flexWrap: "wrap",
      }}
    >
      {wordsOf(text).map(({ at, word }) => (
        <span key={at}>{word}</span>
      ))}
    </div>
  ) : (
    <div style={{ ...style, display: "flex" }}>{text}</div>
  );

export const GET = async (
  request: Request,
  { params }: { params: Promise<{ locale: string }> }
) => {
  const { locale } = await params;
  const lang = locale === "ar" ? "ar" : "en";
  const rtl = lang === "ar";
  const search = new URL(request.url).searchParams;
  const title = (search.get("title") ?? NAME[lang]).slice(0, 120);
  const kicker = (search.get("kicker") ?? "").slice(0, 80);
  const [regular, bold, symbol] = await Promise.all([
    asset("UbuntuArabic-Regular.ttf"),
    asset("UbuntuArabic-Bold.ttf"),
    asset("sal-symbol.svg"),
  ]);
  const symbolSrc = `data:image/svg+xml;base64,${symbol.toString("base64")}`;

  return new ImageResponse(
    <div
      style={{
        background: TINT,
        color: INK,
        display: "flex",
        flexDirection: "column",
        fontFamily: "Ubuntu Arabic",
        height: "100%",
        justifyContent: "space-between",
        padding: "64px 72px",
        width: "100%",
      }}
    >
      <div
        style={{
          alignItems: "flex-start",
          display: "flex",
          flexDirection: rtl ? "row-reverse" : "row",
          justifyContent: "space-between",
        }}
      >
        <Line
          rtl={rtl}
          style={{ color: CRIMSON_700, fontSize: 30, fontWeight: 700 }}
          text={NAME[lang]}
        />
        {/* biome-ignore lint/performance/noImgElement: Satori renders plain img */}
        <img alt="" height={96} src={symbolSrc} width={80} />
      </div>
      <div
        style={{
          alignItems: rtl ? "flex-end" : "flex-start",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {kicker ? (
          <Line
            rtl={rtl}
            style={{ color: INK_SECONDARY, fontSize: 30 }}
            text={kicker}
          />
        ) : null}
        <Line
          rtl={rtl}
          style={{
            color: CRIMSON,
            fontSize: title.length > 60 ? 56 : 72,
            fontWeight: 700,
            lineHeight: 1.3,
          }}
          text={title}
        />
      </div>
      <div
        style={{
          color: INK_SECONDARY,
          display: "flex",
          fontSize: 26,
          justifyContent: rtl ? "flex-end" : "flex-start",
        }}
      >
        @auibsal · auibsal.org
      </div>
    </div>,
    {
      ...SIZE,
      fonts: [
        { data: regular, name: "Ubuntu Arabic", style: "normal", weight: 400 },
        { data: bold, name: "Ubuntu Arabic", style: "normal", weight: 700 },
      ],
      headers: { "Cache-Control": "public, max-age=86400, immutable" },
    }
  );
};
