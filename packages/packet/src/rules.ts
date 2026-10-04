import {
  defaultPacketRules,
  packetDocumentLabels,
  type Packet,
  type PacketDocument,
  type PacketRule,
  type PacketRules,
  type PacketRuleSeverity,
  type ProfileFile,
} from '@pitchcrew/core';

export interface PacketFinding {
  ruleId: string;
  severity: PacketRuleSeverity;
  document: PacketDocument | 'claims' | 'rules';
  message: string;
}
export interface PacketCheck {
  findings: PacketFinding[];
  /** Blocking messages. Any error stops a draft, fails a review and blocks export. */
  errors: string[];
  /** Advisory messages that never block. */
  warnings: string[];
}

/** Characters of each document that house rules read. Packet schemas already stay below this. */
export const ruleInputLimit = 20_000;
const matchLimit = 1000;
const findingsPerRule = 20;

/**
 * Removes formatting that is not read as prose: YAML frontmatter, HTML tags and comments,
 * Markdown link targets and raw LaTeX commands such as `\vspace{-4pt}`.
 */
export function bodyText(text: string): string {
  return text
    .replace(/^﻿?---[ \t]*\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/, '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/?[A-Za-z][^<>]*>/g, ' ')
    .replace(/^[ \t]{0,3}\[[^\]\n]+\]:[ \t]*\S+.*$/gm, ' ')
    .replace(/(!?)\[([^\]\n]*)\]\([^)\n]*\)/g, ' $2 ')
    .replace(/<(?:https?:|mailto:)[^>\s]*>/g, ' ')
    .replace(/\\(?:href|url)(?:\[[^\]\n]*\])?\{[^{}\n]*\}/g, ' ')
    .replace(/\\\\/g, ' ')
    .replace(/\\[A-Za-z@]+\*?(?:\[[^\]\n]*\])?(?:\{\s*-?[\d.]+\s*[a-z]{0,2}\s*\})*/g, ' ')
    .replace(/[{}]/g, ' ');
}

/** `all` keeps the original whitespace split; `body` counts readable words only. */
export function countWords(text: string, count: 'all' | 'body' = 'body'): number {
  if (count === 'all') return text.split(/\s+/).length;
  return bodyText(text)
    .split(/\s+/)
    .filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}

const quote = (value: string) =>
  JSON.stringify(value.length > 80 ? `${value.slice(0, 80)}…` : value);
const located = (rule: PacketRule, fallback: string, location: string) =>
  rule.message ? `${rule.message} (${location})` : fallback;

function* matches(text: string, source: string, flags: string) {
  const expression = new RegExp(source, `${flags}g`);
  let count = 0;
  for (const match of text.matchAll(expression)) {
    yield match;
    if (++count > matchLimit) return;
  }
}

const bulletLine = /^ ?(?:[-*+]|\d{1,9}[.)])[ \t]+\S|^\s*\\item\b/;
const markdownHeading = /^[ \t]{0,3}#{1,6}[ \t]+\S/;

/** Markdown headings and lines matching the rule's heading pattern both start a section. */
function sections(text: string, rule: Extract<PacketRule, { kind: 'max_bullets' }>) {
  const heading = rule.heading ? new RegExp(rule.heading, rule.flags) : null;
  const result = [{ heading: 'the start of the document', bullets: 0, checked: !heading }];
  for (const line of text.split(/\r?\n/)) {
    const selected = heading?.test(line) ?? false;
    if (selected || markdownHeading.test(line))
      result.push({ heading: line.trim(), bullets: 0, checked: !heading || selected });
    else if (bulletLine.test(line)) result[result.length - 1].bullets++;
  }
  return result.filter((section) => section.checked);
}

function evaluate(rule: PacketRule, document: PacketDocument, text: string): string[] {
  const label = packetDocumentLabels[document];
  if (rule.kind === 'word_limit') {
    const words = countWords(text, rule.count);
    if (words <= rule.max) return [];
    return [located(rule, `${label} exceeds ${rule.max} words.`, `${label}: ${words} words`)];
  }
  if (rule.kind === 'max_bullets')
    return sections(text, rule)
      .filter((section) => section.bullets > rule.max)
      .map((section) =>
        located(
          rule,
          `${label} has ${section.bullets} bullets under ${quote(section.heading)}; the limit is ${rule.max}.`,
          `${label}, ${quote(section.heading)}: ${section.bullets} bullets`,
        ),
      );
  if (rule.kind === 'canonical_lines') {
    const selector = new RegExp(rule.selector, rule.flags);
    const allowed = new Set(rule.values);
    return text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && selector.test(line) && !allowed.has(line))
      .map((line) =>
        located(
          rule,
          `${label} line ${quote(line)} does not match any listed entry.`,
          `${label}: ${quote(line)}`,
        ),
      );
  }
  const found = [...matches(text, rule.pattern, rule.flags)];
  if (found.length > matchLimit)
    return [
      located(
        rule,
        `${label} exceeds ${matchLimit} matches; this rule cannot check every match.`,
        `${label}: more than ${matchLimit} matches`,
      ),
    ];
  if (rule.equals !== undefined)
    return found
      .filter((match) => (match[1] ?? match[0]) !== rule.equals)
      .map((match) =>
        located(
          rule,
          `${label} has ${quote(match[0])}; it must capture ${quote(rule.equals!)}, not ${quote(match[1] ?? match[0])}.`,
          `${label}: ${quote(match[0])}`,
        ),
      );
  const limit = rule.maxCount ?? 0;
  if (found.length <= limit) return [];
  const sample = found
    .slice(0, 3)
    .map((match) => quote(match[0]))
    .join(', ');
  return [
    located(
      rule,
      limit === 0
        ? `${label} contains ${sample}, which this rule does not allow.`
        : `${label} has ${found.length} matches (${sample}); the limit is ${limit}.`,
      `${label}: ${found.length} ${found.length === 1 ? 'match' : 'matches'}, ${sample}`,
    ),
  ];
}

function claimFindings(packet: Packet, profile: ProfileFile[]): PacketFinding[] {
  const messages: string[] = [];
  for (const claim of packet.claims) {
    const source = profile.find((file) => file.name === claim.source);
    if (!source || !source.content.includes(claim.quote))
      messages.push(`Source does not support: ${claim.claim}`);
    if (claim.claim !== claim.quote)
      messages.push(`Use an exact source quotation for the claim: ${claim.claim}`);
    if (
      ![packet.resume, packet.coverLetter, packet.formAnswers, packet.note].some((text) =>
        text.includes(claim.claim),
      )
    )
      messages.push(`Claim is not included in the packet: ${claim.claim}`);
  }
  return messages.map((message) => ({
    ruleId: 'claims',
    severity: 'error',
    document: 'claims',
    message,
  }));
}

/** Checks claims against profile quotations, then applies the user's mechanical house rules. */
export function checkPacket(
  packet: Packet,
  profile: ProfileFile[],
  rules: PacketRules = defaultPacketRules,
): PacketCheck {
  const findings = claimFindings(packet, profile);
  for (const rule of rules.rules)
    for (const document of rule.documents) {
      const text = packet[document];
      if (text.length > ruleInputLimit)
        findings.push({
          ruleId: rule.id,
          severity: 'error',
          document,
          message: `${packetDocumentLabels[document]} is too long for rule checks (${ruleInputLimit} characters maximum).`,
        });
      findings.push(
        ...evaluate(rule, document, text.slice(0, ruleInputLimit))
          .slice(0, findingsPerRule)
          .map((message) => ({ ruleId: rule.id, severity: rule.severity, document, message })),
      );
    }
  const messages = (severity: PacketRuleSeverity) => [
    ...new Set(findings.filter((item) => item.severity === severity).map((item) => item.message)),
  ];
  return { findings, errors: messages('error'), warnings: messages('warn') };
}

/** Blocking problems only. Prefer checkPacket when warnings are shown. */
export function lintPacket(
  packet: Packet,
  profile: ProfileFile[],
  rules: PacketRules = defaultPacketRules,
): string[] {
  return checkPacket(packet, profile, rules).errors;
}

/** Card feedback keeps plain strings; warnings are labeled so they read as advice. */
export function warningFeedback(warnings: string[]): string[] {
  return warnings.map((warning) => `Warning: ${warning}`);
}
