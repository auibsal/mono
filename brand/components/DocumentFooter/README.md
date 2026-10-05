# DocumentFooter

The running footer on every document page except the cover: document code and title at left, "n / total" at right, in `text-meta`.

**Markup:** `<footer class="sal-footer">` with `span.sal-footer__doc` ("SAL-BRD-01 · Brand & Identity v3", set in Ubuntu Mono) and `span.sal-footer__page` ("3 / 14"). Inside a `.sal-page`, it pins itself to the bottom margin.

**What you provide:** the document code, the short title and the page numbers.

**Rules**
- Spaced slash, no "Page": "3 / 14".
- Leave it off the cover. Ink pages keep it; `text-meta` turns Crimson 100 there.
- Size is 10 px (7.5 pt), measured from the guide's footer.
