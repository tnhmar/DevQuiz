import fixture from '../content/demo.en.json';
import { demoData } from './catalogue.ts';
import type { ContentIdentity } from '../core/practice-session.ts';
import type { PracticeCandidate } from '../core/practice-selection.ts';
export function createDemoPracticePool() {
  const { packId, contentVersion, language } = fixture.data.pack;
  if (language !== 'en' && language !== 'fr') throw new Error('Unsupported demo language');
  const content: ContentIdentity = { packId, contentVersion, language };
  const pool: PracticeCandidate[] = demoData.questions.map(question => {
    const concept = fixture.data.concepts.find(item => item.id === question.primaryConceptId);
    if (!concept || !demoData.domains.some(domain => domain.id === concept.domainId)) throw new Error('Missing demo concept/domain context');
    if (concept.trackIds.some(id => !demoData.tracks.some(track => track.id === id && track.domainId === concept.domainId))) throw new Error('Missing demo track context');
    return { question, domainId: concept.domainId, trackIds: [...concept.trackIds] };
  });
  return {
    content, fixture: true as const, pool,
    domains: demoData.domains.map(domain => ({ id: domain.id, label: domain.title })),
    tracks: demoData.tracks.map(track => ({ id: track.id, label: track.title, domainId: track.domainId }))
  };
}
