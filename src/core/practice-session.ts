
// Add the following exported restore function adjacent to the engine's session constructors. Existing reducer/scoring paths remain unchanged.
export function restorePracticeSession(session: PracticeSession, selection: PracticeSelection): PracticeSession {
  const restored = JSON.parse(JSON.stringify(session)) as PracticeSession;
  if (!restored.sessionId.trim() || !restored.content.packId.trim() || !restored.content.contentVersion.trim() || (restored.content.language !== 'en' && restored.content.language !== 'fr') || typeof restored.fixture !== 'boolean') throw new Error('Invalid restored choice identity');
  const questionIds = new Set(restored.questions.map(question => question.id));
  if (questionIds.size !== restored.questions.length || restored.questions.some(question => question.type === 'open' || !Number.isInteger(question.revision) || question.revision < 1 || question.scoring.kind !== 'exact_match' || question.scoring.maxPoints !== 1 || question.scoring.negativeMarking !== false)) throw new Error('Invalid restored choice questions');
  if (!Number.isSafeInteger(restored.index) || restored.index < 0 || restored.index > restored.questions.length) throw new Error('Invalid restored choice index');
  const answerCount = restored.answers.length;
  if ((restored.phase === 'empty' && (restored.questions.length !== 0 || restored.index !== 0 || answerCount !== 0)) || (restored.phase !== 'empty' && restored.questions.length === 0) || (restored.phase === 'answering' && restored.index !== answerCount) || (restored.phase === 'feedback' && restored.index + 1 !== answerCount) || (restored.phase === 'finished' && (restored.index !== restored.questions.length || answerCount !== restored.questions.length))) throw new Error('Restored choice phase/index/answers disagree');
  let priorTime = 0;
  for (let i = 0; i < answerCount; i += 1) {
    const answer = restored.answers[i]; const question = restored.questions[i];
    if (answer.sessionId !== restored.sessionId || answer.questionId !== question.id || answer.questionRevision !== question.revision || answer.questionFamilyId !== question.questionFamilyId || answer.fixture !== restored.fixture || answer.objective !== true || answer.scoringPolicy !== 'choice-exact-v1' || !Number.isFinite(answer.committedAt) || answer.committedAt < priorTime) throw new Error('Restored choice answer identity/time mismatch');
    priorTime = answer.committedAt;
    const score = grade(question, answer.selectedOptionIds);
    if (!answer.selectedOptionIds.length || new Set(answer.selectedOptionIds).size !== answer.selectedOptionIds.length || answer.selectedOptionIds.some(id => !question.options.some(option => option.id === id)) || score.correct !== answer.correct || score.points !== answer.points || score.maxPoints !== answer.maxPoints) throw new Error('Restored choice outcome mismatch');
    if (answer.hintUsed !== (answer.hintExposures.length > 0) || answer.answerRevealed !== (answer.answerRevealedAt !== null) || ((answer.confidence === null) !== (answer.confidenceCapturedAt === null)) || answer.hintExposures.some(exposure => !restored.hintsByQuestion[question.id]?.some(hint => hint.id === exposure.hintId) || exposure.revealedAt > answer.committedAt) || (answer.answerRevealedAt !== null && answer.answerRevealedAt > answer.committedAt) || (answer.confidenceCapturedAt !== null && answer.confidenceCapturedAt > answer.committedAt)) throw new Error('Restored choice signal mismatch');
  }
  const current = restored.phase === 'answering' || restored.phase === 'feedback' ? restored.questions[restored.index] : null;
  if (current) {
    if (restored.selectedOptionIds.some(id => !current.options.some(option => option.id === id)) || new Set(restored.selectedOptionIds).size !== restored.selectedOptionIds.length) throw new Error('Restored selection contains an unknown/duplicate option');
    if ((restored.signals.confidence === null) !== (restored.signals.confidenceCapturedAt === null) || restored.signals.hints.some(exposure => !restored.hintsByQuestion[current.id]?.some(hint => hint.id === exposure.hintId)) || new Set(restored.signals.hints.map(exposure => exposure.hintId)).size !== restored.signals.hints.length) throw new Error('Restored current signals mismatch');
    if (restored.phase === 'feedback') {
      const answer = restored.answers[restored.index];
      if (!answer || JSON.stringify(restored.selectedOptionIds) !== JSON.stringify(answer.selectedOptionIds) || JSON.stringify(restored.signals) !== JSON.stringify({ confidence: answer.confidence, confidenceCapturedAt: answer.confidenceCapturedAt, hints: answer.hintExposures, answerRevealedAt: answer.answerRevealedAt })) throw new Error('Restored feedback differs from the locked answer');
    }
  } else if (restored.selectedOptionIds.length || restored.signals.confidence !== null || restored.signals.confidenceCapturedAt !== null || restored.signals.hints.length || restored.signals.answerRevealedAt !== null) throw new Error('Inactive restored choice state retained current signals');
  if (new Set(restored.previouslyCommittedIds).size !== restored.previouslyCommittedIds.length || new Set(restored.previouslyMissedIds).size !== restored.previouslyMissedIds.length || restored.previouslyMissedIds.some(id => !restored.previouslyCommittedIds.includes(id)) || (restored.retryOfSessionId !== null && restored.retryOfSessionId === restored.sessionId)) throw new Error('Restored retry lineage mismatch');
  if (selection.questions.length !== restored.questions.length || selection.selected !== restored.questions.length || selection.shortfall !== selection.requested - selection.selected || selection.questions.some((question, index) => question.id !== restored.questions[index].id || question.revision !== restored.questions[index].revision) || new Set(restored.questions.map(question => question.questionFamilyId)).size !== restored.questions.length) throw new Error('Restored selection differs from pinned questions');
  return restored;
}
