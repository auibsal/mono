Fonts and the symbol for the drawn share images (`app/[locale]/og`).

- `UbuntuArabic-*.ttf`: `brand/fonts/UbuntuArabic-*.ttf` with the GSUB/GPOS
  Extension lookups (types 7 and 9) rewritten as the lookups they wrap, so
  Satori can read them. Glyphs and shaping data are unchanged. Regenerate with
  fontTools: for each Extension lookup, set `LookupType` to the wrapped type
  and `SubTable` to the `ExtSubTable` list, then save.
- `sal-symbol.svg`: `brand/logos/sal-symbol.svg`, byte for byte.
