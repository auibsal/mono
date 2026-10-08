Use this system for anything carrying the Society's name: documents, posts, print, screens. The Society sounds like a well-read friend: warm, precise and never grand. It looks like a page from a good typewriter: white paper, ink, one crimson accent.

## Content fundamentals

- Write warm, not gushing: "We would love you to join us." Never "An AMAZING opportunity!!!"
- Be concrete: "Tuesday, October 13, 4 PM, Room [x]." Never "soon, somewhere on campus."
- Be confident, not grand: "A journal read blind and printed with care." Never "Iraq's premier literary institution."
- Be playful about ideas, never people: "The worst poem at AUIB wins."
- Write Arabic for Arabic readers, then have a native speaker check it. Never ship a translation as an afterthought.
- Names: "AUIB Society of Arts and Letters" in full on first use in formal documents; then "the Society" or "SAL". Never "the club", never "Art and Letter".
- Endorsed programs carry the line "a Society of Arts and Letters programme" (Arabic: «من برامج جمعية الفنون والآداب»). Flag working titles until chosen: Waraq, Side Quest.
- Short titles: "Charter Day", "Every Dinar", "The Ribbon".
- Dates as "Tuesday, October 13"; times as "6:00 PM"; money as "50,000 IQD".
- Numerals in tables; words in prose for numbers under ten.
- American English everywhere (owner's decision, October 8, 2026): organization, program, color. Text quoted from an adopted document keeps its own spelling, as does the endorsement line "a Society of Arts and Letters programme".
- Partners with Arabic names are named in their own language first: Natrok Athar (نترك اثر).
- No emoji, no exclamation marks in headlines. Tag @auibsal on every post, and always give the date.

## Color

- The AUIB three lead: `crimson`, `ink`, `white`. The six supporting tones (`crimson-700`, `crimson-100`, `crimson-50`, `ink-70`, `ink-50`, `paper`) do the quiet work. Never add a color, and no program may add one.
- Aim for about 60% white, 22% crimson, 12% ink, 6% tints. Use crimson boldly but not everywhere.
- Build with the role tokens, not the palette directly: `surface`, `surface-tint`, `text`, `text-secondary`, `text-meta`, `title`, `accent-line`, `band`, `on-band`. They switch correctly between the light and dark themes.
- Set `data-theme="dark"` for the ink "why" pages (mission, preamble, the case for the Society), the Open Call, and the Nexus (see Screens). On ink, titles and text are `white` and lines and kickers are `crimson-100`.
- Never set crimson text or the crimson symbol on `ink` (1.7:1).
- Keep `ink-50` / `text-meta` for captions and meta on `white`, at 8 pt and up. On `crimson-50` or `paper`, use `ink-70` instead.
- `paper` belongs to Waraq. Elsewhere the page is `white`.

## Type

- Ubuntu speaks for the Society, Ubuntu Arabic is its Arabic partner, and Ubuntu Mono types like the Typewriter. Ubuntu and Ubuntu Mono come from Google Fonts. Ubuntu Arabic is not on Google Fonts: it ships with this system in `fonts/` (Regular 400 and Bold 700, under the Ubuntu Font Licence). Install all three before editing any template. Never substitute Noto Kufi Arabic or another Arabic face. Ubuntu Arabic has no Light weight, so Arabic ledes use Regular.
- A4 documents use the `print-*` styles; 1080 × 1350 posts use the `post-*` styles. Each takes the top of the guide's range. Go smaller within the range only when the copy demands it: Display 42–58 pt / 118–132 px, Lede 14–17 pt / 36–44 px, Heading 11.5–18 pt / 28–48 px, Body 9–10.5 pt / 26–30 px, Caption 7.5–8.5 pt / 22–24 px.
- Display (700) is for one- or two-word titles in `title`. A Lede (300) is one sentence. Body is 400 with 1.5 leading, short lines and plain words. Captions are 400 in `text-meta`.
- `print-kicker` is set in uppercase, tracked, in `accent-line`.
- Set document codes, form numbers, clause and article numbers in `code` (Ubuntu Mono): `SAL-GOV-01`, `F-14`.
- Waraq's interior uses Amiri and Literata, as set out in its own guide; Side Quest may add Ubuntu Mono for "typewriter" lines.
- Set all Arabic in Ubuntu Arabic using the `ar-*` styles: `ar-display`, `ar-heading`, `ar-body`, `ar-caption` and `ar-post`. Arabic sits one step larger than the English beside it, with 1.8–2.0 leading (1.4 at display size). Set `dir="rtl"` and `lang="ar"` on Arabic text.

## Space and shape

- A4 pages use `page-margin` (21 mm) at the sides. Separate cards with `gap`, and swatches or small tiles with `gap-tight`. Pad cards with `card-padding`.
- In print, cards sit on `surface-tint` with `radius-card`; swatches use `radius-swatch`. Print has no shadows. Screens follow the Screens section below.
- Rules are `hairline` thick: `accent-line` under table heads and on form headers, `rule` between rows.
- Allow at most one full-bleed `band` per page.

## The symbol, wordmarks and lockups

- The identity has three parts. The **symbol** is a crimson panel with a V-notch cut into its top. The **English wordmark** is "AUIB / Society of / Arts and / Letters" in Ubuntu Bold, on four lines. The **Arabic wordmark** is «جمعيةُ الفنونِ / والآدابِ في / الجامعةِ / الأمريكيةِ» in Ubuntu Arabic Bold, on four lines, right-aligned. Use the files in Logos (`assets/Logos/README.md`); never retype or redraw them. Their line breaks, line spacing and proportions are fixed.
- Color is one hue. On light grounds the symbol is `crimson` and the wordmarks are `crimson-700`. On `crimson` or `ink` grounds, use the reversed files: a white symbol with `crimson-100` wordmarks.
- Use the horizontal lockup (symbol + English) by default. Use the bilingual lockup (English | symbol | Arabic) for anything public: calls, posters, certificates. Use the stacked lockup for square spaces, stickers and merchandise. Use the symbol alone for avatars, favicons, stamps and badges once the name appears elsewhere; `sal-avatar.svg` is the ready social avatar.
- In every lockup, the symbol stands as tall as the English wordmark, from the first cap line to the last baseline. The gap between symbol and text equals the depth of the notch. The stacked lockup puts the symbol over the first three lines' height.
- Clear space is the depth of the notch (about a quarter of the symbol's width) on every side. Minimum sizes: symbol 24 px tall on screen or 6 mm printed; horizontal lockup 45 mm wide in print. The four-line wordmark is not legible below about 9 px cap height; below that, use the symbol alone.
- Where the AUIB logo appears it leads, and the SAL lockup follows at equal or smaller height.
- Never stretch, recolor (no gold, no gradients, no ink wordmark), rotate, re-break the wordmark lines, add effects or shadows, or put the crimson symbol on `ink`.
- The round SAL Key from Brand & Identity v3 is retired. Do not use it on anything new.

## Screens (v5)

The v5 amendment (October 8, 2026) gives screens the character of set type and stamped cards. It adds platform tokens and changes nothing in print.

- **Grounds.** The public site is white, with ink and crimson sections; its footer is ink. The Nexus, the members' portal, is on ink. Forms and Waraq reading pages stay light: inside ink they are white sheets (`data-theme="light"`).
- **Shape.** Corners are square on screen (`radius-screen`, 0). The 8 px card radius stays for print.
- **Frame.** Controls, cards and the header carry a 2 px rule in the `frame` role: ink on light, white on ink. Row and section hairlines stay `rule`.
- **One elevation.** A solid offset block in the `offset` role (ink on light, crimson on ink), 4 px for controls and cards and 8 px for feature blocks. It never blurs, falls toward the end of the line (right in English, left in Arabic), and collapses when pressed. A feature block on a light page may use the crimson offset.
- **Capitals.** Tracked capitals are only for kickers, navigation and button labels: short words, never sentences. Arabic is never tracked or set in capitals; it has no case, and spacing breaks its joined letters.
- **Navigation.** At most five sections in a header; the rest live in the footer.
- **Contrast.** Every text pair reaches 4.5:1 in both themes (checked in `tokens.test.ts`). On ink, captions are `crimson-100` and placeholders are white at full strength. Crimson is never used for text or the symbol on ink; the crimson offset is a shape, not text.
- **Phones.** Nothing scrolls sideways at 360 px. Toolbars and boards wrap or stack instead.
- **Words.** Errors and statuses say what happened and what to do, in the Society's voice. No exclamation marks, and never a service's raw message.

## Documents

Every document is built from the same parts:

- **Cover:** horizontal lockup at top left; the document code in `code` at top right with the Arabic name. Title in `print-display` in `ink`, then a subtitle in `print-lede`, then "Prepared by", then a crimson footer `band` with the date and status.
- **Contents:** a full-width `band` with "Contents", then numbered rows ruled in `crimson`.
- **Section pages:** a one- or two-word title in `title`, then a one-sentence lede, then content.
- **Legal text:** two columns, articles numbered in `code` with a crimson rule, and clause numbers in the margin.
- **Forms:** a crimson header rule, the form code in `code`, the symbol at top right, labels in tracked capitals, ink write-on lines and a gray office-use strip.
- **Footers** (every page except the cover): document code and title at left, "n / total" at right, in `text-meta`.
- **Closing page:** "Thank You." in Display `crimson`, with a crimson footer band.
- Document code series: SAL-GOV (governance), SAL-POL (policies), SAL-OPS (operations), SAL-STR · MEM · BRD · PRT · PRP (strategy, members, brand, print, proposals).

## Components

- The components are plain HTML with `components/bundle.css` (classes prefixed `sal-`). Load `tokens.css` first, then `bundle.css`, and copy the markup from each component's preview.
- `DocumentCover`: the first page of every document.
- `DocumentFooter`: the running footer on every other page.
- `FormHeader`: the top of every form, with its field and office-use patterns.
- `SocialPost`: the 1080 × 1350 post in four grounds.
- Covers and forms are always light (`data-theme="light"` on their root).

## Social and print

- Posts (1080 × 1350): Society name at top left, symbol at top right, a two- or three-word headline with a full stop in `post-display`, and one line of Arabic at bottom right on every call. Every post has the date and @auibsal.
- Choose the ground by purpose: crimson for calls and moments, ink for recruiting, white for membership, `crimson-50` for regular programs.
- Posters: A3/A4, with the symbol and a QR code at bottom right. Term Card: A6, four to an A4 sheet. Membership cards: 85 × 55 mm. Certificates: A4 landscape with a double crimson rule.

## Imagery

- Use our own photos of our own people, taken with consent. Never use stock photos of books or typewriters in place of ours.
- Shoot hands on typewriter keys, pages, books being handed over, readers mid-sentence, full rooms. Use natural light and no heavy filters.
- Keep color natural and slightly warm. For posters and covers, use a duotone in `crimson` or `ink`. Crop with room for a headline.
- Never shoot anyone wearing a camera-shy sticker, identifiable children, or people praying, in distress or in private moments.

## Iconography

- The system has no icon set. Its only pictorial element is the symbol. Use words, not icons or emoji. Mark failures in examples with a plain "×".
