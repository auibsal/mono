# Bringing this design system into Claude Design

This folder is the complete AUIB Society of Arts and Letters design system, version 3:

- `README.md`: usage rules for anyone, or any agent, building with the system.
- `tokens.json`: the source tokens. `tokens.css` is the same tokens compiled to CSS custom properties and type classes.
- `assets/Logos/`: the current identity as SVG: the symbol, the English and Arabic wordmarks, horizontal, bilingual and stacked lockups (each with a reversed version), and the social avatar.
- `assets/Retired/`: the round SAL Key and its lockups from Brand & Identity v3. Keep these for reference only.
- `assets/SAL-BRD-01 Brand and Identity v3.pdf`: the original brand guide.
- `fonts/`: Ubuntu Arabic Regular and Bold, as WOFF2 for the web and TTF to install. Ubuntu and Ubuntu Mono load from Google Fonts.
- `components/`: DocumentCover, FormHeader, DocumentFooter, SocialPost and the system Cover. Each has a `preview.html` (open it in a browser) and a `README.md`. All of them share `components/bundle.css`.

To import, create a new design system in Claude Design and give it this folder (or the zip of it) as its source, or attach the folder when you ask Claude Design to set the system up. Each `preview.html` starts with a `@dsCard` marker, so the Design System pane picks up the cards automatically.
