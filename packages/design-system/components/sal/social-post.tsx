import { logos } from "../../brand/logos";
import { cn } from "../../lib/utils";

export type SocialPostGround = "crimson" | "ink" | "white" | "tint";

interface SocialPostProps {
  /** One line of Arabic, bottom end (needs native review if written for us). */
  readonly arabic?: string;
  readonly className?: string;
  /** The date (and time) line, e.g. "Tuesday, October 13, 4:00 PM". */
  readonly date: string;
  /**
   * Choose by purpose: crimson for calls and moments, ink for recruiting,
   * white for membership, tint for regular programmes.
   */
  readonly ground: SocialPostGround;
  /** The account handle; the brand puts @auibsal on every post. */
  readonly handle?: string;
  /** Two or three words with a full stop. No exclamation marks. */
  readonly headline: string;
}

const grounds: Record<
  SocialPostGround,
  { frame: string; headline: string; name: string; dark: boolean }
> = {
  crimson: {
    dark: true,
    frame: "bg-[var(--sal-crimson)] text-[var(--sal-white)]",
    headline: "",
    name: "text-[var(--sal-crimson-100)]",
  },
  ink: {
    dark: true,
    frame: "bg-[var(--sal-ink)] text-[var(--sal-white)]",
    headline: "",
    name: "text-[var(--sal-crimson-100)]",
  },
  tint: {
    dark: false,
    frame: "bg-[var(--sal-crimson-50)] text-[var(--sal-ink)]",
    headline: "text-[var(--sal-crimson)]",
    name: "text-[var(--sal-crimson-700)]",
  },
  white: {
    dark: false,
    frame:
      "bg-[var(--sal-white)] text-[var(--sal-ink)] outline outline-1 outline-[var(--sal-rule)]",
    headline: "text-[var(--sal-crimson)]",
    name: "text-[var(--sal-crimson-700)]",
  },
};

/** Units of 1/1080 of the post's width, as in the brand's bundle.css. */
const u = (n: number) => `calc(${n} * 100cqw / 1080)`;

/**
 * The brand's Social Post (brand/components/SocialPost): 1080 × 1350 at any
 * width. The Society's name top start, the symbol top end, the headline,
 * the date and handle bottom start, one line of Arabic bottom end. The
 * layout is the brand's and is not mirrored for Arabic pages.
 */
export const SocialPost = ({
  arabic,
  className,
  date,
  ground,
  handle = "@auibsal",
  headline,
}: SocialPostProps) => {
  const style = grounds[ground];
  return (
    <div className={cn("@container w-full", className)} dir="ltr">
      <div
        className={cn(
          "relative aspect-[4/5] w-full overflow-hidden font-sans",
          style.frame
        )}
      >
        <p
          className={cn("absolute m-0 font-bold leading-[1.15]", style.name)}
          style={{ fontSize: u(34), left: u(80), top: u(80) }}
        >
          Society of
          <br />
          Arts and Letters
        </p>
        {/* biome-ignore lint/performance/noImgElement: SVG symbol, served as supplied */}
        <img
          alt=""
          className="absolute w-auto"
          height={124}
          src={style.dark ? logos.symbol.onDark : logos.symbol.onLight}
          style={{ height: u(124), right: u(80), top: u(80) }}
          width={Math.round(124 * logos.symbol.aspect)}
        />
        <h2
          className={cn(
            "absolute m-0 font-bold leading-[1.02]",
            style.headline
          )}
          style={{ fontSize: u(132), left: u(80), right: u(80), top: u(430) }}
        >
          {headline}
        </h2>
        <p
          className="absolute m-0 leading-[1.5]"
          style={{ bottom: u(80), fontSize: u(30), left: u(80) }}
        >
          <span className="block">{date}</span>
          <span className="block">{handle}</span>
        </p>
        {arabic ? (
          <p
            className="absolute m-0 leading-[1.8]"
            dir="rtl"
            lang="ar"
            style={{ bottom: u(80), fontSize: u(32), right: u(80) }}
          >
            {arabic}
          </p>
        ) : null}
      </div>
    </div>
  );
};
