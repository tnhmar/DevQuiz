export type NonEmpty<T> = readonly [T, ...T[]];
export type InlineContent =
  | { type: 'text'; text: string }
  | { type: 'emphasis'; text: string; style: 'bold' | 'italic' }
  | { type: 'link'; label: string; url: string }
  | { type: 'term_ref'; label: string; termId: string };
export type LessonBlock =
  | { type: 'paragraph'; content: NonEmpty<InlineContent> }
  | { type: 'heading'; level: 1 | 2 | 3 | 4 | 5 | 6; content: NonEmpty<InlineContent> }
  | { type: 'list'; ordered: boolean; items: NonEmpty<NonEmpty<InlineContent>> }
  | { type: 'code'; language: string; text: string }
  | { type: 'table'; columns: NonEmpty<string>; rows: NonEmpty<NonEmpty<string>>; alternativeText: string }
  | { type: 'callout'; tone: 'note' | 'tip' | 'warning' | 'takeaway'; title?: string; content: NonEmpty<InlineContent> }
  | { type: 'figure'; assetId: string; altText: string; caption?: string }
  | { type: 'formula'; text: string; alternativeText: string };
// Types describe trusted, parsed content; untrusted JSON requires runtime validation.
// Text length, IDs, links, row widths, references and publication need their own gates.
