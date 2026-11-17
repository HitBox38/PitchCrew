import type { BrowserAccessMode, BrowserAction, BrowserSnapshot } from '@pitchcrew/core';
import { automaticNavigation, explorationNavigation } from './form-policy.ts';

/**
 * What activating an action's target would do, read from the live page when the action is
 * requested and again before it runs. It only decides whether the user's browser mode may approve
 * the action without asking; it is never stored, shown or used as approval evidence.
 */
export interface ActionTarget {
  /**
   * The kind of element the action activates (the button around a clicked icon, a label's control):
   * a form's submit or reset control (or a link the page sends as a POST), a navigating link,
   * another button-like control, a single-line field or picker, a multi-line field or editable
   * region, a form choice (checkbox, radio, switch, listbox option), a page toggle (tab,
   * disclosure, menu checkbox), or anything else.
   */
  control:
    | 'submit'
    | 'reset'
    | 'link'
    | 'button'
    | 'field'
    | 'multiline'
    | 'choice'
    | 'toggle'
    | 'other';
  /** Its first visible name: label, text, value or title, whitespace-collapsed. */
  name: string;
  /** Every name it shows or announces (label, text, value, title...), so none hides another. */
  names: string[];
  /** A choice's own value, compared with reviewed answers; empty for anything else. */
  value: string;
  /** The absolute address a navigating link opens; empty for anything else. */
  href: string;
  /**
   * The form it belongs to: a site `search` form, an explicit `get` form, an explicit `post` form,
   * a `dialog` form, a form with no method (`script`: usually sent by the page's own code) or none.
   */
  form: 'search' | 'get' | 'post' | 'dialog' | 'script' | '';
  /** Its form is small: a few short entries and no files, long answers or contact details. */
  small: boolean;
  /** A recognized password or one-time-code field. */
  credential: boolean;
  /** For a field or choice: the button Enter activates, its form's first submit control. */
  defaultButton?: ActionTarget;
  /** Elements around it with the browser's own activation behaviour, which a click activates. */
  enclosing?: ActionTarget[];
  /**
   * Controls inside it: a click lands at its center, on whichever of them is there. `null` when
   * they cannot be judged: too many, as for a whole page section, or an embedded frame.
   */
  nested?: ActionTarget[] | null;
}

/**
 * How far an action can reach, from least to most: reading the page, editing form fields, routine
 * interaction, risky interaction that could change an account, delete, buy or publish, and
 * submission, which sends an application, message or form the page may post.
 */
export type ActionClass = 'read' | 'edit' | 'interaction' | 'risky' | 'submission';
const order: readonly ActionClass[] = ['read', 'edit', 'interaction', 'risky', 'submission'];
const highest = (classes: readonly ActionClass[]) =>
  order[Math.max(...classes.map((kind) => order.indexOf(kind)))];

const allowed: Record<BrowserAccessMode, readonly ActionClass[]> = {
  edits: ['read', 'edit'],
  auto: ['read', 'edit', 'interaction'],
  full: ['read', 'edit', 'interaction', 'risky'],
};

/** Whether a mode lets the server approve this class of action on its own. Submission never. */
export const accessModeAllows = (mode: BrowserAccessMode, kind: ActionClass) =>
  allowed[mode].includes(kind);

/**
 * An element the server could not read might be the one that sends, so activating it asks in
 * every mode, Full access included.
 */
const unreadable: ActionClass = 'submission';

/**
 * Words on a control that send or post something to other people (an application, message, post,
 * reply, invitation or connection request): these ask in every mode. English, with the common
 * words of the languages job sites most often use (best effort, not a guarantee).
 */
const sending = [
  /\b(?:submit|send|post|publish|repost|reply|comment|invite|connect|endorse)\b|\bapply\b(?!\s+(?:all\s+)?(?:filters?|changes?|settings?|sort|coupon|promo|discount|code)\b)/i,
  /\b(?:enviar|env[ií]e|postular(?:me|se)?|postule|solicitar|candidatar(?:-se)?|envoyer|soumettre|postuler|senden|absenden|einreichen|bewerben|invia(?:re)?|candidati|verzenden|versturen|solliciteren|indsend|skicka|ans[öo]k|wy[sś]lij|aplikuj|odeslat)\b/iu,
  // Word boundaries in JavaScript patterns only see ASCII letters, so Hebrew (send, sending,
  // submit, submission) and Russian (send, submit) match anywhere in the name.
  /שלי?ח|הגי?ש|отправ|подать/iu,
];
const sends = (name: string) => sending.some((pattern) => pattern.test(name));

/**
 * The same words in a dialog's sentence, in any form: "will be submitted", "Confirm submission?",
 * "Your message was sent". A confirmation is often the last step before a page sends.
 */
const messageSending = [
  /\b(?:submi(?:t(?:s|ted|ting)?|ssions?)|sen(?:d(?:s|ing)?|t)|post(?:s|ed|ing)?|publish(?:es|ed|ing)?|repost(?:s|ed|ing)?|repl(?:y|ies|ied|ying)|appl(?:y|ies|ied|ying)|invit(?:e|es|ed|ing)|connect(?:s|ed|ing)?)\b/i,
  /\b(?:envi(?:ar|ad[oa]s?|ando|é)|envoy(?:er|ée?s?)|soumi(?:s|se|ssion)|gesendet|eingereicht|abgeschickt|absenden|invia(?:t[oa]|re)?|verzonden|verstuurd|postul\w*|candidat\w*)\b/iu,
  /שלי?ח|הגי?ש|הוגש|отправ|подать|подан/iu,
];
const messageSends = (message: string) => messageSending.some((pattern) => pattern.test(message));

/** Words that could change an account, delete, buy or share: Auto asks, Full access does not. */
const risks = [
  /\b(?:delete|remove|discard|erase|destroy|withdraw|unsubscribe|subscribe|sign\s*(?:out|off)|log\s*(?:out|off)|logout|deactivate|close\s+(?:my\s+|your\s+)?account|purchase|buy|pay|payment|place\s+(?:an?\s+)?order|order\s+now|check\s*out|donate|book|reserve|confirm|share|follow|transfer|allow|authori[sz]e|grant|continue\s+as|(?:sign|log)\s*in\s+with|cancel\s+\w+|(?:accept|decline|reject)\s+(?:the\s+|this\s+)?(?:offer|invitation|invite))\b/i,
  /\b(?:eliminar|borrar|comprar|pagar|supprimer|effacer|acheter|payer|l[öo]schen|entfernen|kaufen|bezahlen|excluir|apagar|elimina|cancella|acquista|paga|verwijderen|kopen|betalen)\b/iu,
  /מחי?ק|הסר|קנה|רכיש|תשלום/u,
];
const risky = (name: string) => risks.some((pattern) => pattern.test(name));

/**
 * A name with a letter in a script these word lists cannot read (anything but Latin and Hebrew).
 * Auto asks before such controls; names without letters, like page numbers, are judged as they are.
 */
const foreign = (name: string) => /(?=\p{L})[^\p{Script=Latin}\p{Script=Hebrew}]/u.test(name);

/** Every name a target shows: one that sends or looks risky decides, whatever the others say. */
const allNames = (target: ActionTarget) => [target.name, ...(target.names ?? [])].filter(Boolean);
const anySends = (target: ActionTarget) => allNames(target).some(sends);
const anyRisky = (target: ActionTarget) => allNames(target).some(risky);
const anyForeign = (target: ActionTarget) => allNames(target).some(foreign);
/** No letters or digits at all: unnamed, or only a symbol, as an icon-only send arrow may be. */
const symbolsOnly = (target: ActionTarget) =>
  !allNames(target).some((name) => /[\p{L}\p{N}]/u.test(name));

/** Read-only page addresses: HTTPS reads, plus recognized hosted job boards and application pages. */
export const readOnlyNavigation = (url: string) => {
  try {
    return explorationNavigation(url) || automaticNavigation(url);
  } catch {
    return false;
  }
};

/**
 * A button-like control decides by its names. An unnamed one, or one named only by a symbol, like
 * an icon-only send arrow in a chat box, cannot be judged, so it asks in every mode.
 */
const named = (target: ActionTarget): ActionClass => {
  if (symbolsOnly(target)) return unreadable;
  if (anySends(target)) return 'submission';
  return anyRisky(target) || anyForeign(target) ? 'risky' : 'interaction';
};

/**
 * Submit controls that move a multi-step form to its next step rather than finish it: Next,
 * Continue, Review, Save and continue (and the same words in common job-site languages).
 */
const stepping =
  /^(?:next|continue|proceed|review|save)\b|^(?:siguiente|continuar|suivant|continuer|weiter|avanti|pr[oó]ximo|volgende)\b|^(?:הבא|המשך)/iu;

/** Submit controls of a search or filter form. */
const searching =
  /^(?:search|find|filter|show results|update results|see results|buscar|rechercher|suchen|cerca|zoeken)\b|^(?:חיפוש|חפש)/iu;

/**
 * Submitting a form by its submit control. One that says it sends is a submission. In a POST form,
 * or one with no method that the page's own code usually sends, so is every other submit control
 * except one that only moves to the next step, or searches a small form: those are risky, since
 * the page receives the answers but nothing is finished. A site search reads unless its control's
 * name is risky or unfamiliar; closing a dialog form is judged by its control's name; an explicit
 * GET form only navigates, with fields the agent filled in its address.
 */
const submitControl = (target: ActionTarget): ActionClass => {
  if (anySends(target)) return 'submission';
  if (target.form === 'post' || target.form === 'script')
    return stepping.test(target.name) || (target.small && searching.test(target.name))
      ? 'risky'
      : 'submission';
  if (target.form === 'search') {
    if (anyRisky(target)) return 'risky';
    return !target.name || searching.test(target.name) ? 'interaction' : 'risky';
  }
  if (target.form === 'dialog') return named(target);
  return target.form ? 'risky' : named(target);
};

/** Activating one control, by a click, or by Enter or Space on a control that responds to them. */
const control = (target: ActionTarget): ActionClass => {
  if (target.credential) return 'risky';
  switch (target.control) {
    case 'submit':
      return submitControl(target);
    case 'reset':
      return 'risky';
    case 'link':
      // A link that says it sends asks; "Apply" to a read-only posting or application page is
      // a navigation like any other link.
      if (
        anySends(target) &&
        !(
          allNames(target).every((name) => /^(?:easy\s+)?apply\b/i.test(name)) &&
          readOnlyNavigation(target.href)
        )
      )
        return 'submission';
      if (anyRisky(target)) return 'risky';
      return readOnlyNavigation(target.href) ? 'interaction' : 'risky';
    // Focusing a field, opening a picker or ticking a choice is part of filling in the form.
    case 'field':
    case 'multiline':
      return 'edit';
    case 'choice':
      return anyRisky(target) ? 'risky' : 'edit';
    case 'toggle':
      return anyRisky(target) || anyForeign(target) ? 'risky' : 'interaction';
    default:
      return named(target);
  }
};

/**
 * A click: the element, the native control around it that the browser activates, and every
 * control inside it that the click could land on.
 */
const click = (target: ActionTarget): ActionClass => {
  if (target.nested === null) return unreadable;
  return highest([
    control(target),
    ...(target.enclosing ?? []).map(control),
    ...(target.nested ?? []).map(control),
  ]);
};

/**
 * Enter in a field activates its form's default button: the field's own form rule and that
 * button's class, whichever reaches further. Enter in a POST or script form always asks; in an
 * editable region it may send a message; outside a form the page's code decides.
 */
const enter = (target: ActionTarget): ActionClass => {
  if (target.control === 'multiline') return 'submission';
  if (target.control !== 'field' && target.control !== 'choice') return click(target);
  if (!target.form) return 'risky';
  const implicit =
    target.form === 'post' || target.form === 'script'
      ? 'submission'
      : target.form === 'get'
        ? 'risky'
        : 'interaction';
  return highest([implicit, ...(target.defaultButton ? [control(target.defaultButton)] : [])]);
};

const press = (
  action: Extract<BrowserAction, { kind: 'press' }>,
  target?: ActionTarget,
): ActionClass => {
  if (action.key === 'Enter') return target ? enter(target) : unreadable;
  if (action.key === 'Space') {
    if (!target) return unreadable;
    // Space types into fields and scrolls past links; it activates buttons and choices.
    if (target.control === 'field' || target.control === 'multiline') return 'edit';
    return target.control === 'link' ? 'interaction' : click(target);
  }
  // Focus, arrow, paging and Escape keys move around the page or within a control.
  return 'interaction';
};

const dialog = (
  action: Extract<BrowserAction, { kind: 'dialog' }>,
  open: BrowserSnapshot['dialog'],
): ActionClass => {
  if (action.decision === 'dismiss') return 'interaction';
  if (!open) return 'risky';
  // An alert has only OK, so accepting one changes nothing that dismissing would not.
  if (open.type === 'alert') return risky(open.message) ? 'risky' : 'interaction';
  return messageSends(open.message) ? 'submission' : 'risky';
};

/**
 * The class of an exact action on the page it was inspected on. A marked submission, a dialog
 * continuing one, anything that looks like sending an application, message or form, and any
 * activated element the server cannot read is a submission, which asks in every mode.
 */
export const classifyAction = (
  action: BrowserAction,
  target: ActionTarget | undefined,
  open?: BrowserSnapshot['dialog'],
): ActionClass => {
  if ('purpose' in action && action.purpose === 'submission') return 'submission';
  if (action.kind === 'dialog')
    return action.submissionAttemptId ? 'submission' : dialog(action, open);
  if (action.kind === 'navigate') return readOnlyNavigation(action.url) ? 'read' : 'risky';
  if (action.kind === 'scroll' || action.kind === 'hover') return 'read';
  if (action.kind === 'fill' || action.kind === 'select' || action.kind === 'upload')
    return target?.credential ? 'risky' : 'edit';
  if (action.kind === 'press') return press(action, target);
  if (action.kind === 'drag') return 'risky';
  return target ? click(target) : unreadable;
};

/**
 * The choices an action would set (a ticked box, a picked radio or listbox option, including one
 * inside or around the clicked element). On a job's application these are answers: like a typed
 * answer, the server gives one on its own only when it is a reviewed answer.
 */
export const choiceAnswers = (action: BrowserAction, target: ActionTarget | undefined) => {
  if (!target) return [];
  if (action.kind === 'press' && action.key !== 'Space' && action.key !== 'Enter') return [];
  if (action.kind !== 'click' && action.kind !== 'press') return [];
  return [target, ...(target.enclosing ?? []), ...(target.nested ?? [])].filter(
    (item) => item.control === 'choice',
  );
};

/** Actions whose class depends on the element they target. */
export const needsTarget = (action: BrowserAction) =>
  action.kind === 'click' ||
  action.kind === 'press' ||
  action.kind === 'fill' ||
  action.kind === 'select' ||
  action.kind === 'upload';
