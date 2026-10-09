
// Add this exported restore function adjacent to createOpenPractice. It returns the same decoded phase; no submit/rate/finish actions are dispatched.
export function restoreOpenPractice(state: OpenPractice): OpenPractice {
  const restored = JSON.parse(JSON.stringify(state)) as OpenPractice;
  if (!restored.sessionId.trim() || !restored.content.packId.trim() || !restored.content.contentVersion.trim() || (restored.content.language !== 'en' && restored.content.language !== 'fr') || typeof restored.fixture !== 'boolean' || restored.question.type !== 'open') throw new Error('Invalid restored open session identity');
  const rubricIds = restored.question.rubric.map(item => item.id);
  if (!rubricIds.length || new Set(rubricIds).size !== rubricIds.length || Object.keys(restored.ratings).some(id => !rubricIds.includes(id)) || Object.values(restored.ratings).some(value => value !== 0 && value !== 1 && value !== 2)) throw new Error('Invalid restored open rubric map');
  const submitted = restored.phase !== 'writing';
  if (!submitted && (restored.answerCommittedAt !== null || restored.submittedConfidence !== null || Object.keys(restored.ratings).length !== 0 || restored.result !== null)) throw new Error('Writing state contains submitted open outcomes');
  if (submitted) {
    if (!restored.text.trim() || restored.answerCommittedAt === null || restored.submittedConfidence === null || restored.submittedConfidence.value !== restored.confidence || restored.submittedConfidence.capturedAt !== restored.confidenceCapturedAt || (restored.confidenceCapturedAt !== null && restored.confidenceCapturedAt > restored.answerCommittedAt)) throw new Error('Open submitted response/confidence mismatch');
  }
  if (restored.phase === 'rating' && restored.result !== null) throw new Error('Open rating phase already has a finalized result');
  if (restored.phase === 'finished') {
    const result = restored.result;
    if (!result || Object.keys(restored.ratings).length !== rubricIds.length || result.sessionId !== restored.sessionId || result.fixture !== restored.fixture || result.objective !== false || result.scoringPolicy !== 'self-rubric-v1' || result.response.questionId !== restored.question.id || result.response.questionRevision !== restored.question.revision || result.response.text !== restored.text || result.answerCommittedAt !== restored.answerCommittedAt || result.confidence !== restored.submittedConfidence?.value || result.confidenceCapturedAt !== restored.submittedConfidence?.capturedAt || result.subjectivePoints !== Object.values(restored.ratings).reduce<number>((sum, rating) => sum + rating, 0) || result.maxSubjectivePoints !== restored.question.rubric.length * 2) throw new Error('Open finalized result mismatch');
  } else if (restored.result !== null) throw new Error('Unfinished open state retained a finalized result');
  return restored;
}
