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

Characters Liberation Sans lacks get a fallback font, one character at a time. Latin letters, digits, spaces and punctuation always stay in Liberation Sans, so a mixed line keeps one look.

| Script                            | Where the font comes from                                                                      |
| --------------------------------- | ---------------------------------------------------------------------------------------------- |
| Hebrew                            | Bundled Noto Sans Hebrew, regular and bold (SIL Open Font License, in `packages/packet/fonts`) |
| Japanese, Chinese, Korean         | An installed font, found when the export needs it                                              |
| Arabic, Indic and similar scripts | Not supported in PDF; use DOCX                                                                 |

### Installed fonts

Pitchcrew reads font files directly. It never downloads fonts and never runs another program to find them. It looks in this order:

1. Files or folders named in `PITCHCREW_FONTS`, separated like `PATH`. The daemon must be started with it, so the background service does not see a value set only in your shell.
2. The `fonts` folder in the Pitchcrew data folder, such as `~/.pitchcrew/fonts`. This works for every way of starting Pitchcrew, including the background service.
3. Common Japanese, Chinese and Korean fonts in the system font folders:
   - Windows `%WINDIR%\Fonts` and per-user fonts: Yu Gothic, Meiryo, MS Gothic, Microsoft YaHei, Microsoft JhengHei, Malgun Gothic.
   - macOS `/System/Library/Fonts`, `/Library/Fonts` and `~/Library/Fonts`: Hiragino Sans, Hiragino Sans GB, PingFang, Apple SD Gothic Neo, Arial Unicode.
   - Linux `~/.local/share/fonts`, `~/.fonts`, `/usr/local/share/fonts` and `/usr/share/fonts`: Noto Sans CJK, Noto Sans JP, Source Han Sans, IPA, Takao, VL Gothic, WenQuanYi, Nanum Gothic, Droid Sans Fallback.

Japanese fonts come first, so Han characters shared with Chinese take Japanese forms. The first font that has a character wins. Bold text uses the bold face of the same family when one exists, such as `YuGothB.ttc` or a bold face in the same collection. TrueType (`.ttf`), OpenType (`.otf`) and collections (`.ttc`, `.otc`) work. Variable fonts and bitmap-only color fonts are skipped.

To add a font, copy its file into the `fonts` folder of the data folder and request export approval again. On Linux you can also install a package such as `fonts-noto-cjk`. Use a font whose license allows embedding; the PDF carries a subset of it.

### Right-to-left text

Hebrew paragraphs run right to left. Pitchcrew applies the Unicode bidirectional algorithm to each paragraph, wraps lines in reading order and then reorders each line for display, so English words, numbers and punctuation inside Hebrew land where a browser or Word puts them. A paragraph, heading or list item takes its direction from its first letter. Right-to-left paragraphs are right-aligned, list markers sit on the right with mirrored indents, and a `\hfill` date moves to the left edge. Brackets are mirrored. Links and bold text keep working. Hebrew points are placed with the font's horizontal offsets; their height is the font's default. Hebrew has no italic face, so italic Hebrew prints upright.

Directional marks such as U+200E and U+200F are respected and not printed.

### Characters PDF cannot show

PDF export stops with an error that names the first character no available font has, such as `"日" (U+65E5)`. For Japanese, Chinese and Korean characters the error says to install a font. Arabic, Persian, Urdu, Hindi and other scripts whose letters join, combine or reorder also stop with an error that names the character. fontkit can shape them, but the PDF text map would not survive copying or resume parsers, because fonts such as Noto Sans Arabic share one glyph between several letters. DOCX keeps every character.

### DOCX

DOCX names Arial and leaves layout to Word. Right-to-left paragraphs get `w:bidi`, which also mirrors indents and list numbers in Word. Runs the bidirectional algorithm resolves right to left get `w:rtl` and a Hebrew or Arabic language tag; English words inside stay left to right. Japanese, Chinese and Korean runs get an East Asian font hint with Yu Gothic, Microsoft YaHei or Malgun Gothic, chosen from the kana or Hangul in the document, and a matching language tag.

## Page counts

Pitchcrew counts pages from the frozen bytes, so approvals made before this feature also show counts. PDF counts are exact. A formatted DOCX stores the page count of the matching formatted PDF layout in `docProps/app.xml`. Word may lay it out differently and rewrites that value when it saves. Plain text DOCX files have no count.

The resume target is one page. Inbox shows each document's page count and a warning when a resume runs longer. `pitchcrew_lint_packet` also reports formatted page counts and layout warnings so Writer and Reviewer can shorten the resume before review. The warning does not block approval, because some resumes are meant to be longer.

## Deterministic output

The same packet and layout always produce the same bytes, given the same available fonts. PDFs use fixed metadata dates and fixed font subset names, and they do not replace ligatures, so extracted text matches the source words. Bundled fonts have fixed subset tags. Installed fonts are tagged by order of first use and named by their PostScript name, such as `PCRXAA+YuGothic-Regular`, so the PDF records which font was used without recording a file path. Approvals freeze the bytes, so installing or removing a font later does not change an approved document. DOCX files get fixed document dates, ordered hyperlink IDs and a ZIP writer with fixed timestamps.
