import type { LessonBlock, NonEmpty } from './blocks.ts';
export type Level = 'beginner' | 'intermediate' | 'advanced' | 'expert';
export type Dimension = 'recall' | 'understanding' | 'application' | 'diagnosis' | 'design_judgement';
export type Explanation = string | NonEmpty<LessonBlock>;
export type Option<Id extends string = string> = { id: Id; text: Explanation };
export type EditorialApproval = {
  state: 'draft' | 'awaiting_review' | 'approved' | 'rejected';
  reviewer: string | null; approvedAt: string | null; approvedRevision: number | null;
};
export type QuestionBase = {
  id: string; revision: number; questionFamilyId: string; primaryConceptId: string;
  supportingConceptIds: readonly string[]; level: Level; dimension: Dimension;
  presentation: 'direct' | 'scenario' | 'code_reading'; prompt: NonEmpty<LessonBlock>;
  explanation: Explanation; sourceRefs: readonly string[]; claimRefs: readonly string[];
  status: 'draft' | 'published' | 'deprecated'; approval: EditorialApproval;
  technologyScopes: NonEmpty<{ technology: string; version: string }>; reviewBy: string | null;
};
export type ExactScoring<Ids extends readonly string[]> = {
  kind: 'exact_match'; correctOptionIds: Ids; maxPoints: 1; negativeMarking: false;
};
export type RubricCriterion = {
  id: string; criterion: string; critical: boolean;
  anchors: { '0': string; '1': string; '2': string };
};
export type ChoiceOptions = readonly [Option, Option, ...Option[]];
export type Question = QuestionBase & (
  | { type: 'single'; options: ChoiceOptions; scoring: ExactScoring<readonly [string]>; optionExplanations: Readonly<Record<string, Explanation>> }
  | { type: 'multi'; options: ChoiceOptions; scoring: ExactScoring<NonEmpty<string>>; optionExplanations: Readonly<Record<string, Explanation>> }
  | { type: 'true_false'; options: readonly [Option<'true'>, Option<'false'>]; scoring: ExactScoring<readonly ['true' | 'false']>; optionExplanations: { true: Explanation; false: Explanation } }
  | { type: 'open'; modelAnswer: NonEmpty<LessonBlock>; rubric: NonEmpty<RubricCriterion>; scoring: { kind: 'self_rubric'; objective: false; pointsPerCriterion: readonly [0, 1, 2] } }
);
export type ResponseBase = { questionId: string; questionRevision: number };
export type QuestionResponse = ResponseBase & (
  | { type: 'single'; selectedOptionIds: readonly [] | readonly [string] }
  | { type: 'multi'; selectedOptionIds: readonly string[] }
  | { type: 'true_false'; selectedOptionIds: readonly [] | readonly ['true' | 'false'] }
  | { type: 'open'; text: string; criterionRatings: Readonly<Record<string, 0 | 1 | 2>>; objective: false }
);
// Runtime schema checks are mandatory for imported JSON; these types do not prove publication.
// Referential consistency, unique option/criterion IDs and approved revisions are later gates.
