import fixture from '../content/demo.en.json';
import type { ChapterEntity, DomainEntity, LessonEntity, TrackEntity } from '../content/learning-entities.ts';
import type { Explanation, Question } from '../content/questions.ts';
import type { LessonBlock } from '../content/blocks.ts';
type DemoData = {
  domains: readonly DomainEntity[]; tracks: readonly TrackEntity[];
  content: readonly (ChapterEntity | LessonEntity)[]; questions: readonly Question[];
};
// This is a bundled original UI fixture, not a runtime importer or publication validator.
// Assertions describe this authored fixture; they never approve an external JSON file.
export const demoData = fixture.data as unknown as DemoData;
export const DEMO_NOTICE = 'DEMO ONLY / DRAFT FIXTURE / PROGRESS NOT RECORDED';
export function blockText(block: LessonBlock): string {
  if (block.type === 'paragraph' || block.type === 'heading') return block.content.map(item => item.type === 'text' || item.type === 'emphasis' ? item.text : item.label).join('');
  if (block.type === 'code' || block.type === 'formula') return block.text;
  return '[' + block.type + ' block: full reader follows]';
}
export function explanationText(value: Explanation): string {
  return typeof value === 'string' ? value : value.map(blockText).join('\n\n');
}
export function findDemoLesson(id: string | undefined) {
  return demoData.content.find((item): item is LessonEntity => item.kind === 'lesson' && item.id === id);
}
export function demoGroups() {
  return demoData.content.filter((item): item is ChapterEntity => item.kind === 'chapter').map(chapter => ({
    chapter,
    domain: demoData.domains.find(item => item.id === chapter.context.domainId),
    tracks: demoData.tracks.filter(item => chapter.context.trackIds.includes(item.id)),
    lessons: demoData.content.filter((item): item is LessonEntity => item.kind === 'lesson' && item.parentId === chapter.id)
  }));
}
export function demoQuestions() {
  const lesson = findDemoLesson('demo.lesson');
  return (lesson?.questionRefs ?? []).map(id => demoData.questions.find(item => item.id === id)).filter((item): item is Question => item !== undefined);
}
