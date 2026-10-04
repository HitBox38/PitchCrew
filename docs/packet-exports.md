# Packet exports

When you request export approval, Pitchcrew can render the resume and cover letter as PDF and DOCX files. Approval freezes the exact bytes and their SHA-256 manifest. Export, upload and preview all use those frozen bytes.

## Layouts

**Formatted** is the default. It reads the Markdown and lays it out as a one-column document:

- The resume uses US Letter, 0.35 inch margins, 10 point body text and 12 point lines. Level 2 headings get a thin rule.
- The cover letter uses 1 inch margins and 11 point body text.
- Headings go from level 1 to 4. Levels 5 and 6 render as level 4.
- Bold, italic and bold italic text. Bullet lists, numbered lists and nested lists, all with hanging indents.
- Links print in blue. PDFs get clickable link annotations and DOCX files get Word hyperlinks.
- Horizontal rules, hard line breaks and pandoc-style `--` and `---` dashes.

**Plain text** prints the Markdown literally, syntax included, in Helvetica. It is the layout every export used before formatted layouts existed. For the same packet, plain PDF bytes match those earlier exports exactly.

## What the parser accepts

Pandoc resumes often carry settings for another renderer, so the parser removes them:

- YAML frontmatter at the top of the file is ignored. Its title and other values are not printed.
- Raw LaTeX layout commands such as `\vspace{-8pt}`, `\pagestyle{empty}` and `\raggedright` are removed with their arguments. A line made only of these commands disappears.
- `\textbf{}`, `\emph{}`, `\href{}{}` and `\url{}` become bold, italic and links. `\section{}` becomes a heading. `\hfill` pushes the rest of the line to the right margin, which suits dates. Other unknown commands disappear, but the words in their braces stay.
- `{=latex}` fenced blocks are read as the same raw LaTeX.

Pitchcrew never executes HTML and never fetches URLs. HTML tags stay visible as text, except `<br>`, which becomes a line break. Images print their alternative text. A link target can be an `http`, `https`, `mailto` or `tel` URL, a bare domain or an email address. Other targets print their text without a link. Bare web addresses and email addresses in text become links too.

## Fonts and characters

Formatted PDFs embed subsets of Liberation Sans, which has the same metrics as Arial. The font files come from `pdfjs-dist`, which the UI already bundles for previews. Liberation Sans uses the GPL v2 with a font exception, so documents can embed it without changing their own terms. It covers Latin, Greek, Cyrillic, curly quotes, dashes and common symbols. Text is normalized to composed Unicode before layout.

PDF export stops with an error that names the first character the font cannot show, such as `"日" (U+65E5)`. Right-to-left scripts such as Hebrew and Arabic are not supported in PDF. DOCX keeps every character and names Arial as its font.

## Page counts

Pitchcrew counts pages from the frozen bytes, so approvals made before this feature also show counts. PDF counts are exact. A formatted DOCX stores the page count of the matching formatted PDF layout in `docProps/app.xml`. Word may lay it out differently and rewrites that value when it saves. Plain text DOCX files have no count.

The resume target is one page. Inbox shows each document's page count and a warning when a resume runs longer. `pitchcrew_lint_packet` also reports formatted page counts and layout warnings so Writer and Reviewer can shorten the resume before review. The warning does not block approval, because some resumes are meant to be longer.

## Deterministic output

The same packet and layout always produce the same bytes. PDFs use fixed metadata dates and fixed font subset names, and they do not replace ligatures, so extracted text matches the source words. DOCX files get fixed document dates, ordered hyperlink IDs and a ZIP writer with fixed timestamps.
