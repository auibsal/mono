# FormHeader

The top of every Society form, plus its field and office-use patterns: the form code, the form title and the symbol above a crimson rule, labeled write-on lines, and a gray strip for office use.

**Markup:** `<section class="sal-form" data-theme="light">`, containing:
- `header.sal-form__head`, holding `.sal-form__code` (in `code`, for example "SAL-OPS-02 · F-14"), `h2.sal-form__title` and `img.sal-form__symbol` (`sal-symbol.svg`, 52 px tall) at top right.
- `.sal-form__fields`: a two-column grid of `label.sal-form__field`. Each has a `.sal-label` (tracked capitals) and a `.sal-writeon` (the ink line). Add `--wide` to make a field span both columns.
- `.sal-form__office`: the office-use strip on `rule` gray, with "For office use" and two or three write-on fields.

**What you provide:** the form code and title, the field labels (in sentence case; CSS sets the capitals), and the office fields.

**Rules**
- Forms are always light and printed on white. Write-on lines are ink so they survive photocopying.
- Write labels as nouns ("Date", "Proposed by"), never as questions.
- Give money fields their unit: "Budget (IQD)".
- Number the form in the series of its parent document: `SAL-OPS-02` is Templates & Forms.
