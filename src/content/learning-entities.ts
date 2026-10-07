import type { LessonBlock, NonEmpty } from './blocks.ts';
import type { Dimension, EditorialApproval, Explanation, QuestionBase } from './questions.ts';
export type TechnologyScope = QuestionBase['technologyScopes'][number];
export type EditorialEntity = {
  id: string; revision: number; status: 'draft' | 'published' | 'deprecated';
  sourceRefs: readonly string[]; claimRefs: readonly string[]; approval: EditorialApproval;
};
export type LearningContext = { domainId: string; trackIds: NonEmpty<string> };
export type DomainEntity = EditorialEntity & { title: string; order: number; description: Explanation };
export type TrackEntity = EditorialEntity & { title: string; order: number; description: Explanation; domainId: string };
export type ConceptEntity = EditorialEntity & {
  title: string; objective: string; domainId: string; trackIds: NonEmpty<string>;
  prerequisites: readonly string[]; assessedDimensions: NonEmpty<Dimension>;
  technologyScopes: NonEmpty<TechnologyScope>;
};
export type ChapterEntity = EditorialEntity & {
  kind: 'chapter'; parentId: null; index: number; title: string; context: LearningContext;
};
export type LessonEntity = EditorialEntity & {
  kind: 'lesson'; parentId: string; index: number; title: string; objective: string;
  context: LearningContext; conceptRefs: readonly string[]; body: NonEmpty<LessonBlock>;
  questionRefs: readonly string[]; audio?: { assetId: string; revision: number };
};
export type GlossaryEntity = EditorialEntity & {
  term: string; definition: Explanation; example?: Explanation; domainId: string;
  conceptRefs: readonly string[]; synonyms: readonly string[];
};
export type LearningEntity = DomainEntity | TrackEntity | ConceptEntity | ChapterEntity | LessonEntity | GlossaryEntity;
export type LearningEntityKind = 'domain' | 'track' | 'concept' | 'chapter' | 'lesson' | 'glossary';
// Runtime schemas enforce shapes and bounds. Reference existence, graph cycles, factual
// verification and revision-bound publication are deliberately not asserted by these types.
