# Packet rules

Packet rules are your own mechanical house rules for application packets. Pitchcrew applies them after the exact-quotation checks on every draft, review and export.

- **Errors** block the packet. A Writer draft with an error is rejected, a review fails, and an approved export stops until the packet is revised and reviewed again.
- **Warnings** never block. They appear in the card's review notes as `Warning: ...` and in the agent check results.

Rules are mechanical. They check words, lines and patterns. They do not prove that a sentence is true, so still review the whole packet.

## Where rules live

Rules are stored in `packet-rules.json` in the data folder, next to `pitchcrew.db`. Edit them in **Settings > Packet rules**. The page lists each rule, shows problems next to the rule they belong to, and lets you import or export the file.

Without a file, Pitchcrew uses the built-in defaults:

| Rule                  | Check                              | Severity |
| --------------------- | ---------------------------------- | -------- |
| `resume-length`       | Resume has at most 650 words       | Error    |
| `cover-letter-length` | Cover letter has at most 500 words | Error    |

The defaults count words the way earlier versions did: every whitespace-separated piece of text, including Markdown symbols. Restore defaults removes the file.

Pattern checks use a snapshot of the current rules. If the effective rules change during a check, the result blocks and asks you to check the packet again. Cancelled runs cannot apply delayed checks, and exports also recheck the managed profile revision and any agent run capability before entering the approval gate.

The file is not part of the board event log. Changing it does not create events and does not change past reviews. New checks use the current rules. A run that is already in progress is checked against the rules in place when it finishes.

If the file is edited by hand and becomes invalid, Pitchcrew fails closed: every check reports a blocking error until you save valid rules or restore the defaults.

## Who can change rules

Only you can change rules, through the local UI session. Agents can read them:

- Writer and Reviewer workflow runs get a short summary of the rules in their prompt.
- `pitchcrew_get_packet_rules` returns the rules and the summary.
- `pitchcrew_lint_packet` checks a draft and returns `problems` (errors), `warnings` and `findings`. Each finding has a rule id, severity, document and message. Claim problems use the rule id `claims`.

No agent tool writes rules.

## File format

```json
{
  "version": 1,
  "rules": []
}
```

Every rule has these fields:

| Field       | Meaning                                                                 |
| ----------- | ----------------------------------------------------------------------- |
| `id`        | Unique name, 1 to 64 lowercase letters, numbers and dashes              |
| `kind`      | `word_limit`, `max_bullets`, `canonical_lines` or `pattern`             |
| `severity`  | `error` or `warn`                                                       |
| `documents` | Any of `resume`, `coverLetter`, `formAnswers`, `note`                   |
| `message`   | Optional text shown instead of the default message (300 characters max) |

Each document in `documents` is checked separately.

### Word limit

`max` is the most words allowed. `count` is `body` (the default) or `all`.

`body` counts readable words only. It skips YAML frontmatter, HTML tags and comments, Markdown link targets and reference links, raw LaTeX commands such as `\vspace{-4pt}`, and pieces with no letters or digits, such as `-` or `#`. `all` counts every whitespace-separated piece, like the defaults.

### Bullets per section

`max` is the most bullets allowed in one section. Markdown headings start sections. Bullets are `-`, `*`, `+` or numbered items with at most one leading space, plus LaTeX `\item` lines. Indented sub-bullets are not counted.

Add `heading` (a pattern) to check only the sections headed by matching lines. Matching lines also start new sections, so a bold job header such as `**Northwind Labs** | Engineer` works without a Markdown heading.

### Canonical lines

Every trimmed line that matches `selector` must equal one of `values` exactly. Use it for employer headers, so a header is never edited in one packet only.

### Pattern

`pattern` is a JavaScript regular expression, with optional `flags` (`i`, `m`, `s`, `u`). Pick one behavior:

- No `maxCount` or `equals`: any match is a finding.
- `maxCount`: allow up to that many matches per document.
- `equals`: every match must capture this value in its first group, or in the whole match when there is no group.

## Pattern safety

User patterns run on your packets, so Pitchcrew limits them:

- At most 300 characters per pattern and 50 patterns across all rules.
- At most 100 rules and a 256 KB file.
- A pattern must compile and must not match empty text.
- Backreferences such as `\1` are rejected.
- Nested repeats such as `(a+)+` or `(\w+\s?)*` are rejected, because they can take a very long time on near-miss text. Repeat the inner part only, for example `\w+(?:\s\w+)*`.
- Rules read at most 20,000 characters of each document and report at most 20 findings per rule and document. More than 1,000 pattern matches reports an incomplete check instead of accepting unchecked matches.
- Pattern checks run in an isolated worker with a two-second deadline. A timeout or worker failure blocks the packet, even for warning rules, because the check did not complete. The daemon stays responsive and the worker is terminated.

Validation catches common slow shapes; the worker deadline bounds patterns the heuristics miss. Keep patterns simple and specific.

## Example

This example uses fictional employers and numbers.

```json
{
  "version": 1,
  "rules": [
    {
      "id": "resume-body",
      "kind": "word_limit",
      "severity": "error",
      "documents": ["resume"],
      "max": 600,
      "count": "body"
    },
    {
      "id": "cover-letter-length",
      "kind": "word_limit",
      "severity": "warn",
      "documents": ["coverLetter"],
      "max": 500,
      "count": "body"
    },
    {
      "id": "bullets-per-job",
      "kind": "max_bullets",
      "severity": "warn",
      "documents": ["resume"],
      "max": 5,
      "heading": "^\\*\\*[^*]+\\*\\* \\|"
    },
    {
      "id": "employer-headers",
      "kind": "canonical_lines",
      "severity": "error",
      "documents": ["resume"],
      "selector": "^\\*\\*[^*]+\\*\\* \\|",
      "values": [
        "**Northwind Labs** | Senior Engineer | 2021 to 2024",
        "**Contoso Studio** | Engineer | 2018 to 2021"
      ]
    },
    {
      "id": "team-size",
      "kind": "pattern",
      "severity": "error",
      "documents": ["resume", "coverLetter", "formAnswers", "note"],
      "pattern": "Led (\\d+) developers",
      "equals": "3"
    },
    {
      "id": "gap-sentences",
      "kind": "pattern",
      "severity": "error",
      "documents": ["coverLetter", "formAnswers", "note"],
      "pattern": "\\bI (?:have not|haven't|don't have|do not have)\\b",
      "flags": "i",
      "maxCount": 1,
      "message": "Mention at most one gap per document."
    },
    {
      "id": "no-process-mentions",
      "kind": "pattern",
      "severity": "error",
      "documents": ["resume", "coverLetter", "formAnswers", "note"],
      "pattern": "\\b(?:drafted|generated|written|checked|reviewed) (?:by|with) (?:AI|an? (?:agent|writer|reviewer)|the (?:agent|writer|reviewer))\\b",
      "flags": "i",
      "message": "Sent text must not describe how the packet was prepared."
    },
    {
      "id": "approximate-years",
      "kind": "pattern",
      "severity": "warn",
      "documents": ["resume", "coverLetter"],
      "pattern": "~\\s?\\d+\\s+years",
      "message": "State an exact number of years."
    }
  ]
}
```
