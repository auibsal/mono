import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

// Brand colors (brand/tokens.json). Email clients need inline styles.
const CRIMSON = "#9c213e";
const CRIMSON_700 = "#7e1a32";
const INK = "#273236";
const INK_SECONDARY = "#4a5559";
const PAPER = "#faf7f5";
const RULE = "#e3dedf";
const WHITE = "#ffffff";

const FONT = "'Ubuntu Arabic', Ubuntu, 'Segoe UI', Tahoma, Arial, sans-serif";

export interface NoticeBlock {
  readonly action?: { readonly href: string; readonly label: string };
  readonly heading: string;
  readonly lang: "en" | "ar";
  readonly paragraphs: readonly string[];
}

export interface NoticeProps {
  /** The recipient's language first, then the other one. */
  readonly blocks: readonly NoticeBlock[];
  readonly preview: string;
}

const NAME = {
  ar: "جمعية الفنون والآداب",
  en: "AUIB Society of Arts and Letters",
};

const FOOTER = {
  ar: "رسالة من النِّكسَس، منصة جمعية الفنون والآداب في الجامعة الأمريكية في العراق – بغداد.",
  en: "Sent by the Nexus, the platform of the AUIB Society of Arts and Letters.",
};

const Block = ({ block }: { block: NoticeBlock }) => {
  const rtl = block.lang === "ar";
  const text = {
    color: INK,
    direction: rtl ? ("rtl" as const) : ("ltr" as const),
    fontFamily: FONT,
    fontSize: rtl ? 17 : 16,
    lineHeight: rtl ? 1.9 : 1.6,
    margin: "0 0 12px",
    textAlign: rtl ? ("right" as const) : ("left" as const),
  };
  return (
    <Section dir={rtl ? "rtl" : "ltr"} lang={block.lang}>
      <Text
        style={{
          ...text,
          color: CRIMSON,
          fontSize: rtl ? 23 : 22,
          fontWeight: 700,
          lineHeight: 1.3,
          margin: "0 0 16px",
        }}
      >
        {block.heading}
      </Text>
      {block.paragraphs.map((paragraph) => (
        <Text key={paragraph} style={text}>
          {paragraph}
        </Text>
      ))}
      {block.action ? (
        <Section style={{ textAlign: rtl ? "right" : "left" }}>
          <Button
            href={block.action.href}
            style={{
              backgroundColor: CRIMSON,
              borderRadius: 6,
              color: WHITE,
              display: "inline-block",
              fontFamily: FONT,
              fontSize: 15,
              padding: "12px 20px",
              textDecoration: "none",
            }}
          >
            {block.action.label}
          </Button>
        </Section>
      ) : null}
    </Section>
  );
};

/**
 * Every notice the platform sends: the Society's name, the message in the
 * recipient's language and then the other, and a plain footer. No images,
 * no tracking, no exclamation marks.
 */
export const Notice = ({ blocks, preview }: NoticeProps) => {
  const first = blocks[0]?.lang ?? "en";
  return (
    <Html dir={first === "ar" ? "rtl" : "ltr"} lang={first}>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: PAPER, margin: 0, padding: "24px 0" }}>
        <Container
          style={{
            backgroundColor: WHITE,
            border: `1px solid ${RULE}`,
            borderRadius: 8,
            maxWidth: 600,
            padding: "32px",
          }}
        >
          <Text
            style={{
              color: CRIMSON_700,
              fontFamily: FONT,
              fontSize: 15,
              fontWeight: 700,
              margin: "0 0 24px",
            }}
          >
            {NAME[first]}
          </Text>
          {blocks.map((block, index) => (
            <Section key={block.lang}>
              {index > 0 ? (
                <Hr style={{ borderColor: RULE, margin: "24px 0" }} />
              ) : null}
              <Block block={block} />
            </Section>
          ))}
          <Hr style={{ borderColor: RULE, margin: "24px 0 16px" }} />
          {blocks.map((block) => (
            <Text
              key={`footer-${block.lang}`}
              lang={block.lang}
              style={{
                color: INK_SECONDARY,
                direction: block.lang === "ar" ? "rtl" : "ltr",
                fontFamily: FONT,
                fontSize: 12,
                lineHeight: 1.6,
                margin: "0 0 4px",
                textAlign: block.lang === "ar" ? "right" : "left",
              }}
            >
              {FOOTER[block.lang]}
            </Text>
          ))}
        </Container>
      </Body>
    </Html>
  );
};

Notice.PreviewProps = {
  blocks: [
    {
      action: { href: "https://nexus.auibsal.org/en", label: "Open the Nexus" },
      heading: "You're booked for the Majlis",
      lang: "en",
      paragraphs: ["Tuesday, October 13 · 6:00 PM", "Library, second floor"],
    },
    {
      action: { href: "https://nexus.auibsal.org/ar", label: "افتح النِّكسَس" },
      heading: "حُجز مكانك في المجلس",
      lang: "ar",
      paragraphs: ["الثلاثاء، 13 تشرين الأول · 6:00 مساءً"],
    },
  ],
  preview: "You're booked for the Majlis",
} satisfies NoticeProps;

// biome-ignore lint/complexity/noRedundantDefaultExport: React Email's preview server loads templates through their default export.
export default Notice;
