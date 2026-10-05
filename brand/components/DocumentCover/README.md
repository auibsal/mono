# DocumentCover

The first page of every Society document: lockup and document code at the top, a large title, a one-sentence subtitle, "Prepared by", and a crimson footer band with the date and status.

**Markup:** `<article class="sal-page sal-cover" data-theme="light">`, containing:
- `.sal-cover__top`, which holds `img.sal-cover__lockup` (`sal-lockup-horizontal.svg`, 96 px tall) and `.sal-cover__code`. The code block has a `.sal-code` line and a `.sal-ar` Arabic-name line with `lang="ar"`.
- `h1.sal-cover__title`: one or two words a line, at most two lines.
- `p.sal-cover__subtitle`: one sentence, in the Lede style.
- `p.sal-cover__audience` (optional): who the document is for.
- `p.sal-cover__prepared`, with `-label`, `-name` and `-role` spans.
- `footer.sal-cover__band`: the date on the left and the status on the right ("Draft 1 · for ratification", "Ratified").

**What you provide:** the document code (for example `SAL-GOV-01`), the title, the subtitle, the author's name and role, the date as "September 28, 2026", and the status.

**Rules**
- A cover is always light (`data-theme="light"`); the light lockup never sits on ink.
- The page is A4 at 96 dpi (794 × 1123 px), with side margins of `page-margin`. Positions are measured from the guide's own cover. To print, render it at A4 with no browser margins.
- A cover has no document footer.
- The title is in `ink`, not crimson. Crimson Display is for section titles and the closing page.
