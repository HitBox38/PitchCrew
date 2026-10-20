import {
  $applyNodeReplacement,
  TextNode,
  type EditorConfig,
  type LexicalEditor,
  type NodeKey,
  type SerializedTextNode,
} from 'lexical';
import type { ReferenceValue } from '@/ChatReferences/types.ts';
export const $createReferenceNode = (reference: ReferenceValue): ReferenceNode => {
  return $applyNodeReplacement(new ReferenceNode(reference));
};

export type SerializedReferenceNode = SerializedTextNode & { reference: ReferenceValue };

/** Token mode makes each chip atomic while its real text remains portable Markdown. */
export class ReferenceNode extends TextNode {
  __reference: ReferenceValue;
  static getType(): string {
    return 'pitchcrew-reference';
  }
  static clone(node: ReferenceNode): ReferenceNode {
    return new ReferenceNode(node.__reference, node.__key);
  }
  constructor(reference: ReferenceValue, key?: NodeKey) {
    super(reference.token, key);
    this.__reference = reference;
    this.__mode = 1;
  }
  static importJSON(serialized: SerializedReferenceNode): ReferenceNode {
    return $createReferenceNode(serialized.reference);
  }
  exportJSON(): SerializedReferenceNode {
    return { ...super.exportJSON(), type: ReferenceNode.getType(), reference: this.getReference() };
  }
  getReference(): ReferenceValue {
    return this.getLatest().__reference;
  }
  createDOM(config: EditorConfig): HTMLElement {
    const element = super.createDOM(config);
    const ref = this.getReference();
    element.className = `chat-reference-token chat-reference-${ref.kind}`;
    element.dataset.label = `${ref.kind === 'agent' ? '@' : ref.kind === 'skill' ? '◇' : '/'} ${ref.label}`;
    element.dataset.referenceKey = this.getKey();
    element.setAttribute('aria-label', `${ref.kind}: ${ref.label}`);
    element.title = `${ref.kind}: ${ref.label}. Select or delete as one item.`;
    return element;
  }
  updateDOM(previous: this, element: HTMLElement, config: EditorConfig): boolean {
    return super.updateDOM(previous, element, config);
  }
  exportDOM(_editor: LexicalEditor) {
    const element = document.createElement('span');
    element.textContent = this.getTextContent();
    return { element };
  }
  canInsertTextBefore(): boolean {
    return false;
  }
  canInsertTextAfter(): boolean {
    return false;
  }
}
