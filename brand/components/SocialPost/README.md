# SocialPost

The 1080 × 1350 Instagram post. It scales to any container width: every size is in units of 1/1080 of the post's width, so a 300 px preview and a 1080 px export look identical.

**Markup:** `<div class="sal-post sal-post--crimson|ink|white|tint">` wrapping `.sal-post__frame`, which contains:
- `p.sal-post__name`: "Society of / Arts and Letters", at top left.
- `img.sal-post__symbol`: at top right, as tall as the name block. Use `sal-symbol-white.svg` on crimson and ink, and `sal-symbol.svg` on white and tint. The name is set in the wordmark colour: Crimson 700 on light grounds, Crimson 100 on dark ones.
- `h2.sal-post__headline`: in `post-display` (132 px at full size), two or three words with a full stop.
- `p.sal-post__meta`: the date line and `@auibsal`, at bottom left.
- `p.sal-post__ar.sal-ar` with `lang="ar"`: one line of Arabic, at bottom right.

**What you provide:** the ground, the headline, the date (and time) and the Arabic line. Write the Arabic for Arabic readers and have a native speaker check it; the sample Arabic in the preview is a placeholder.

**Rules**
- Choose the ground by purpose: `--crimson` for calls and moments, `--ink` for recruiting, `--white` for membership, `--tint` for regular programmes.
- One idea per post; the headline does the work.
- Every post carries the date and @auibsal.
- To export, render `.sal-post` at exactly 1080 px wide.
