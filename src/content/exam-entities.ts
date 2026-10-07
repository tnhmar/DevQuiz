import type { NonEmpty } from './blocks.ts';
import type { Dimension, Level } from './questions.ts';
import type { EditorialEntity, TechnologyScope } from './learning-entities.ts';
import type { VerificationRecord } from './provenance-entities.ts';
export type OfficialScoring =
  | { kind: 'percentage'; passingPercent: number | null }
  | { kind: 'points'; maxPoints: number | null; passingPoints: number | null }
  | { kind: 'scaled'; minimum: number | null; maximum: number | null; passingScore: number | null }
  | { kind: 'unknown' };
export type PracticeBenchmark = { kind: 'percentage'; thresholdPercent: number; label: 'app_practice_benchmark' };
export type ExamObjective = { id: string; title: string; weightPercent: number | null; conceptRefs: readonly string[] };
export type ExamProfile = EditorialEntity & {
  kind: 'exam_profile'; provider: string; credentialTitle: string; examCode: string | null;
  examVariant: 'standard' | 'renewal' | 'unknown'; lifecycle: 'active' | 'beta' | 'retired' | 'unknown';
  profileStage: 'catalogued' | 'metadata_verified' | 'blueprint_verified' | 'simulation_ready' | 'stale';
  verification: VerificationRecord; officialSourceRefs: readonly string[];
  prerequisites: readonly { kind: 'certification' | 'exam' | 'experience'; description: string; required: boolean }[];
  languages: NonEmpty<string> | null; objectives: readonly ExamObjective[];
  objectiveWeighting: 'official' | 'app_estimate' | 'unknown';
  questionCount: { min: number; max: number } | null; durationSeconds: number | null;
  questionTypes: NonEmpty<'single' | 'multi' | 'true_false'> | null;
  requiredCapabilities: readonly string[];
  navigation: { canRevisit: boolean | null; canChangeAnswers: boolean | null; canPause: boolean | null };
  officialScoring: OfficialScoring; practiceBenchmark: PracticeBenchmark;
  reviewBy: string | null; retiresOn: string | null;
};
export type SelectionRule = {
  count: number; domainRefs: readonly string[]; trackRefs: readonly string[]; conceptRefs: readonly string[];
  levels: NonEmpty<Level>; dimensions: NonEmpty<Dimension>; technologyScopes: NonEmpty<TechnologyScope>;
  objectiveWeights: readonly { objectiveId: string; weightPercent: number }[];
};
export type TestScoringPolicy = {
  choicePolicy: 'exact_match'; openPolicy: 'self_rubric'; negativeMarking: false;
  practiceBenchmark: PracticeBenchmark;
};
export type TestBase = EditorialEntity & { kind: 'test'; title: string; scoringPolicy: TestScoringPolicy };
export type TestContext =
  | { mode: 'practice'; examProfileId: string | null; examProfileRevision: number | null; timing: { kind: 'untimed' } | { kind: 'timed'; durationSeconds: number; pauseAllowed: boolean } }
  | { mode: 'simulation'; examProfileId: string; examProfileRevision: number; timing: { kind: 'timed'; durationSeconds: number; pauseAllowed: false } };
export type TestSelection =
  | { questionRefs: NonEmpty<string>; selectionRule?: never }
  | { selectionRule: SelectionRule; questionRefs?: never };
export type TestEntity = TestBase & TestContext & TestSelection;
// Shapes do not establish real vendor rules, bank sufficiency or readiness. CP-03/04
// and the exam engine own relation checks, published metadata and attempt execution.
