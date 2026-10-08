import type { Explanation, Question } from '../content/questions.ts';
import type { LessonBlock } from '../content/blocks.ts';
import { array, boolean, id, ids, integer, nullableText, object, oneOf, requireValue, text } from './recovery-guards.ts';
function inline(value: unknown) {
  const base = object(value, ['type'], ['text', 'style', 'label', 'url', 'termId']);
  const type = oneOf(base.type, ['text', 'emphasis', 'link', 'term_ref']);
  if (type === 'text') { const item = object(value, ['type', 'text']); text(item.text); }
  if (type === 'emphasis') { const item = object(value, ['type', 'text', 'style']); text(item.text); oneOf(item.style, ['bold', 'italic']); }
  if (type === 'link') { const item = object(value, ['type', 'label', 'url']); text(item.label); requireValue(/^https?:\/\/[^\s]+$/.test(text(item.url, 1, 2048)), 'Unsupported recovery link'); }
  if (type === 'term_ref') { const item = object(value, ['type', 'label', 'termId']); text(item.label); id(item.termId); }
}
function inlineRun(value: unknown) { array(value, 1, 1000).forEach(inline); }
export function decodeBlocks(value: unknown): readonly LessonBlock[] {
  const blocks = array(value, 1, 1000);
  for (const entry of blocks) {
    const base = object(entry, ['type'], ['content', 'level', 'ordered', 'items', 'language', 'text', 'columns', 'rows', 'alternativeText', 'tone', 'title', 'assetId', 'altText', 'caption']);
    const type = oneOf(base.type, ['paragraph', 'heading', 'list', 'code', 'table', 'callout', 'figure', 'formula']);
    if (type === 'paragraph') { const item = object(entry, ['type', 'content']); inlineRun(item.content); }
    if (type === 'heading') { const item = object(entry, ['type', 'level', 'content']); integer(item.level, 1, 6); inlineRun(item.content); }
    if (type === 'list') { const item = object(entry, ['type', 'ordered', 'items']); boolean(item.ordered); array(item.items, 1, 1000).forEach(inlineRun); }
    if (type === 'code') { const item = object(entry, ['type', 'language', 'text']); requireValue(/^[A-Za-z0-9_+.-]+$/.test(text(item.language, 1, 40)), 'Invalid recovery code language'); text(item.text); }
    if (type === 'table') {
      const item = object(entry, ['type', 'columns', 'rows', 'alternativeText']);
      array(item.columns, 1, 30).forEach(value => text(value));
      array(item.rows, 1, 1000).forEach(row => array(row, 1, 30).forEach(value => text(value, 0)));
      text(item.alternativeText);
    }
    if (type === 'callout') { const item = object(entry, ['type', 'tone', 'content'], ['title']); oneOf(item.tone, ['note', 'tip', 'warning', 'takeaway']); inlineRun(item.content); if ('title' in item) text(item.title); }
    if (type === 'figure') { const item = object(entry, ['type', 'assetId', 'altText'], ['caption']); id(item.assetId); text(item.altText); if ('caption' in item) text(item.caption); }
    if (type === 'formula') { const item = object(entry, ['type', 'text', 'alternativeText']); text(item.text); text(item.alternativeText); }
  }
  return blocks as unknown as readonly LessonBlock[];
}
export function decodeExplanation(value: unknown): Explanation {
  if (typeof value === 'string') return text(value);
  return decodeBlocks(value) as Explanation;
}
const baseKeys = ['id', 'revision', 'questionFamilyId', 'primaryConceptId', 'supportingConceptIds', 'level', 'dimension', 'presentation', 'prompt', 'explanation', 'sourceRefs', 'claimRefs', 'status', 'approval', 'technologyScopes', 'reviewBy', 'type'] as const;
export function decodeQuestion(value: unknown): Question {
  const base = object(value, baseKeys, ['options', 'scoring', 'optionExplanations', 'modelAnswer', 'rubric']);
  id(base.id); integer(base.revision, 1); id(base.questionFamilyId); id(base.primaryConceptId);
  ids(base.supportingConceptIds); ids(base.sourceRefs); ids(base.claimRefs);
  oneOf(base.level, ['beginner', 'intermediate', 'advanced', 'expert']);
  oneOf(base.dimension, ['recall', 'understanding', 'application', 'diagnosis', 'design_judgement']);
  oneOf(base.presentation, ['direct', 'scenario', 'code_reading']); oneOf(base.status, ['draft', 'published', 'deprecated']);
  decodeBlocks(base.prompt); decodeExplanation(base.explanation); nullableText(base.reviewBy);
  const approval = object(base.approval, ['state', 'reviewer', 'approvedAt', 'approvedRevision']);
  oneOf(approval.state, ['draft', 'awaiting_review', 'approved', 'rejected']); nullableText(approval.reviewer); nullableText(approval.approvedAt); if (approval.approvedRevision !== null) integer(approval.approvedRevision, 1);
  array(base.technologyScopes, 1, 100).forEach(value => { const scope = object(value, ['technology', 'version']); id(scope.technology); text(scope.version); });
  const type = oneOf(base.type, ['single', 'multi', 'true_false', 'open']);
  if (type === 'open') {
    const question = object(value, [...baseKeys, 'scoring', 'modelAnswer', 'rubric']);
    decodeBlocks(question.modelAnswer);
    const criteria = array(question.rubric, 1, 20).map(value => {
      const criterion = object(value, ['id', 'criterion', 'critical', 'anchors']);
      const criterionId = id(criterion.id); text(criterion.criterion); boolean(criterion.critical);
      const anchors = object(criterion.anchors, ['0', '1', '2']); text(anchors['0']); text(anchors['1']); text(anchors['2']); return criterionId;
    });
    requireValue(new Set(criteria).size === criteria.length, 'Duplicate recovery rubric criteria');
    const scoring = object(question.scoring, ['kind', 'objective', 'pointsPerCriterion']);
    requireValue(scoring.kind === 'self_rubric' && scoring.objective === false, 'Open recovery scoring must remain subjective');
    const points = array(scoring.pointsPerCriterion, 3, 3); requireValue(points[0] === 0 && points[1] === 1 && points[2] === 2, 'Unsupported recovery rubric anchors');
  } else {
    const question = object(value, [...baseKeys, 'options', 'scoring', 'optionExplanations']);
    const optionIds = array(question.options, 2, 12).map(value => { const option = object(value, ['id', 'text']); decodeExplanation(option.text); return id(option.id); });
    requireValue(new Set(optionIds).size === optionIds.length, 'Duplicate recovery options');
    const scoring = object(question.scoring, ['kind', 'correctOptionIds', 'maxPoints', 'negativeMarking']);
    const correct = ids(scoring.correctOptionIds, 1, type === 'multi' ? 12 : 1);
    requireValue(scoring.kind === 'exact_match' && scoring.maxPoints === 1 && scoring.negativeMarking === false && correct.every(value => optionIds.includes(value)), 'Unsupported recovery choice policy');
    const explanations = object(question.optionExplanations, type === 'true_false' ? ['true', 'false'] : [], type === 'true_false' ? [] : optionIds);
    Object.entries(explanations).forEach(([key, value]) => { id(key); decodeExplanation(value); });
    if (type === 'true_false') requireValue(optionIds.length === 2 && optionIds[0] === 'true' && optionIds[1] === 'false', 'Invalid canonical Boolean recovery options');
  }
  return value as Question;
}
