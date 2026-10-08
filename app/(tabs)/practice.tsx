import { useRef, useState } from 'react';
import { Link } from 'expo-router';
import { Button, Pressable, Text, View } from 'react-native';
import { Card, Copy, EmptyState, Grid, Page, usePalette } from '../../src/ui/shell.tsx';
import { ContentRenderer } from '../../src/ui/content-renderer.tsx';
import { PracticeSetup } from '../../src/ui/practice-setup.tsx';
import { PracticeSignalsCard } from '../../src/ui/practice-signals.tsx';
import { AttemptSaveCard } from '../../src/ui/attempt-save-card.tsx';
import { DEMO_NOTICE, explanationText } from '../../src/demo/catalogue.ts';
import { createDemoPracticePool } from '../../src/demo/practice-pool.ts';
import { demoPracticeHints } from '../../src/demo/practice-hints.ts';
import { newPracticeSessionId, prepareChoiceSave } from '../../src/storage/attempt-save.ts';
import type { AttemptSaveController } from '../../src/storage/attempt-save.ts';
import type { Explanation } from '../../src/content/questions.ts';
import { createPracticeSession, currentPracticeQuestion, practiceSummary, reducePracticeSession } from '../../src/core/practice-session.ts';
import type { PracticeAction, PracticeSession } from '../../src/core/practice-session.ts';
import type { PracticeSelection, PracticeSelectionRequest } from '../../src/core/practice-selection.ts';
type SaveEntry = { key: string; sessionId: string; questionId: string; controller: AttemptSaveController | null; captureSession: PracticeSession | null };
type PracticeView = { session: PracticeSession; error: string | null; saves: readonly SaveEntry[] };
function loadPool() {
  try { return { data: createDemoPracticePool(), error: null }; }
  catch { return { data: null, error: 'The demo question pool could not be loaded. Learning progress is not recorded.' }; }
}
function capture(session: PracticeSession, questionId: string): SaveEntry {
  const identity = { key: JSON.stringify([session.sessionId, questionId]), sessionId: session.sessionId, questionId };
  try { return { ...identity, controller: prepareChoiceSave(session, questionId), captureSession: null }; }
  catch { return { ...identity, controller: null, captureSession: session }; }
}
function SaveEntries({ entries, currentSessionId, onRetryCapture }: { entries: readonly SaveEntry[]; currentSessionId: string; onRetryCapture: (key: string) => void }) {
  return <Grid>{entries.map(entry => entry.controller ? <AttemptSaveCard key={entry.key} controller={entry.controller} label={entry.questionId + (entry.sessionId === currentSessionId ? ' / current session' : ' / earlier local retry session')} /> : <Card key={entry.key} title="Storage record not prepared">
    <Copy>{entry.questionId} / {entry.sessionId === currentSessionId ? 'current session' : 'earlier local retry session'}</Copy>
    <Copy>The committed answer is retained in memory, but its storage record could not be prepared. No save was started for this entry.</Copy>
    <Button title="Retry capturing and saving this committed answer" onPress={() => onRetryCapture(entry.key)} />
  </Card>)}</Grid>;
}
function ExplanationView({ value }: { value: Explanation }) {
  return typeof value === 'string' ? <Copy>{value}</Copy> : <ContentRenderer blocks={value} interactive={false} />;
}
function OpenDemoLink() {
  const colors = usePalette();
  return <View style={{ gap: 8 }}>
    <Link href="/practice-open" asChild><Pressable accessibilityRole="link" accessibilityLabel="Try the open-response self-assessment demo" style={{ minHeight: 48, padding: 16, borderWidth: 1, borderColor: colors.accent, borderRadius: 12, justifyContent: 'center' }}>
      <Text style={{ color: colors.accent, fontSize: 17 }}>Try the open-response self-assessment demo</Text>
    </Pressable></Link>
    <Copy>Separate writing and rubric demo / subjective self-ratings / excluded from learning progress.</Copy>
  </View>;
}
export default function Practice() {
  const [bank, setBank] = useState(loadPool);
  const [active, setActive] = useState<{ session: PracticeSession; selection: PracticeSelection } | null>(null);
  const [lastRequest, setLastRequest] = useState<PracticeSelectionRequest | undefined>(undefined);
  const activeId = useRef<string | null>(null);
  function begin(selection: PracticeSelection) {
    if (activeId.current !== null || !bank.data || !selection.selected) throw new Error('Session cannot be started');
    const session = createPracticeSession({ sessionId: newPracticeSessionId(), content: bank.data.content, fixture: true, questions: selection.questions, hintsByQuestion: demoPracticeHints(selection.questions) });
    activeId.current = session.sessionId;
    setLastRequest({ filters: selection.filters, count: selection.requested, order: selection.order, seed: selection.seed ?? 0 });
    setActive({ session, selection });
  }
  function leave(expectedId: string) { if (activeId.current !== expectedId) return; activeId.current = null; setActive(null); }
  if (active) return <ChoicePractice key={active.session.sessionId} initialSession={active.session} selection={active.selection} onSetup={() => leave(active.session.sessionId)} />;
  return <Page title="Practice setup" subtitle="Choose filters and session size. Submitted choice answers attempt a local fixture-history save.">
    <Copy>{DEMO_NOTICE}</Copy>
    <Copy>Local fixture-history saves are separate from learning progress. Unsaved records and session recovery are not yet durable.</Copy>
    <OpenDemoLink />
    {!bank.data ? <><EmptyState title="Question pool unavailable" detail={bank.error ?? 'No demo pool is available.'} /><Button title="Reload demo pool" onPress={() => setBank(loadPool())} /></> : <PracticeSetup pool={bank.data.pool} domains={bank.data.domains} tracks={bank.data.tracks} initialRequest={lastRequest} onStart={begin} />}
  </Page>;
}
function ChoicePractice({ initialSession, selection, onSetup }: { initialSession: PracticeSession; selection: PracticeSelection; onSetup: () => void }) {
  const colors = usePalette();
  const [view, setView] = useState<PracticeView>(() => ({ session: initialSession, error: null, saves: [] }));
  const live = useRef(view);
  function show(next: PracticeView) { live.current = next; setView(next); }
  function transition(action: PracticeAction, expectedSessionId: string) {
    const previous = live.current;
    if (previous.session.sessionId !== expectedSessionId || (previous.error && action.type !== 'restart')) return;
    try {
      const session = reducePracticeSession(previous.session, action);
      if (session === previous.session) return;
      let saves = previous.saves;
      let newSave: AttemptSaveController | null = null;
      if (action.type === 'submit' && session.phase === 'feedback') {
        const entry = capture(session, action.questionId);
        saves = [...saves, entry]; newSave = entry.controller;
      }
      show({ session, error: null, saves });
      if (newSave) void newSave.save();
    } catch {
      show({ ...previous, error: 'The practice action could not continue. Existing save receipts remain available below; learning progress is not recorded.' });
    }
  }
  function retryCapture(key: string) {
    const previous = live.current;
    const entry = previous.saves.find(item => item.key === key);
    if (!entry || entry.controller || !entry.captureSession) return;
    const replacement = capture(entry.captureSession, entry.questionId);
    show({ ...previous, saves: previous.saves.map(item => item.key === key ? replacement : item) });
    if (replacement.controller) void replacement.controller.save();
  }
  function restart(expectedSessionId: string) {
    if (live.current.session.sessionId !== expectedSessionId) return;
    try { transition({ type: 'restart', sessionId: newPracticeSessionId() }, expectedSessionId); }
    catch { show({ ...live.current, error: 'A new session identity could not be created. Existing save receipts are unchanged.' }); }
  }
  const session = view.session;
  const navigation = <><OpenDemoLink /><Button title="Change setup (leave local session; saved history kept)" onPress={onSetup} /><Copy>Leaving can hide unsaved capture errors. Pending jobs are memory-only; recovery after restart is not implemented.</Copy></>;
  const saveHistory = <SaveEntries entries={view.saves} currentSessionId={session.sessionId} onRetryCapture={retryCapture} />;
  if (view.error) return <Page title="Demo practice unavailable" subtitle="Scoring and save receipts are separate; no learning progress is recorded.">
    <Copy>{DEMO_NOTICE}</Copy>{navigation}<EmptyState title="Practice unavailable" detail={view.error} />
    <Button title="Restart same selection" onPress={() => restart(session.sessionId)} />{saveHistory}
  </Page>;
  if (session.phase === 'finished') {
    const summary = practiceSummary(session);
    return <Page title="Demo complete" subtitle="Temporary sandbox performance; local fixture-history receipts appear separately.">
      <Copy>{DEMO_NOTICE}</Copy>{navigation}
      <Copy>{summary.correct} / {summary.answered} answers matched the requested options.</Copy>
      <Copy>{summary.answered} / {summary.totalQuestions} questions completed; {selection.requested} originally requested.</Copy>
      <Copy>{summary.assisted} assisted responses / {summary.repeatedCommits} repeated commits in this local restart history.</Copy>
      <Copy>The total includes assisted answers and is not mastery. Save cards show individual storage outcomes, including earlier local retries; no demo record contributes to learning progress or readiness.</Copy>
      <Button title="Retry same selection" onPress={() => restart(session.sessionId)} />{saveHistory}
    </Page>;
  }
  const question = currentPracticeQuestion(session);
  if (!question) return <Page title="Demo practice" subtitle="No supported demo question available.">
    <Copy>{DEMO_NOTICE}</Copy>{navigation}<EmptyState title="No questions" detail="Return to setup and choose an available selection." />{saveHistory}
  </Page>;
  const identity = { questionId: question.id, questionRevision: question.revision };
  const submitted = session.phase === 'feedback';
  const answer = submitted ? session.answers[session.index] : undefined;
  const repeated = session.previouslyCommittedIds.includes(question.id);
  const previouslyMissed = session.previouslyMissedIds.includes(question.id);
  return <Page title="Demo practice" subtitle="Submit scores the answer and attempts a local fixture-history save. Check the receipt separately.">
    <Copy>{DEMO_NOTICE}</Copy>{navigation}
    <Copy>{selection.selected} selected / {selection.requested} requested / {selection.order === 'shuffle' ? 'shuffled question order' : 'source question order'}.</Copy>
    <Copy>{repeated ? 'Repeated question in this local restart history.' : 'No previous committed answer in this local restart history.'}{previouslyMissed ? ' Previously missed in this history.' : ''}</Copy>
    <Grid>
      <Card title={'Question ' + (session.index + 1) + ' of ' + session.questions.length}>
        <Copy>{question.type === 'multi' ? 'Select all requested options' : 'Choose one option'} / {question.level}</Copy>
        <ContentRenderer key={session.sessionId + ':' + question.id + ':' + question.revision} blocks={question.prompt} interactive={false} />
        <View style={{ gap: 12 }}>{question.options.map(option => {
          const selected = session.selectedOptionIds.includes(option.id);
          return <Pressable key={option.id} accessibilityRole={question.type === 'multi' ? 'checkbox' : 'radio'} accessibilityLabel={explanationText(option.text)} accessibilityState={{ checked: selected, disabled: submitted }} disabled={submitted} onPress={() => transition({ type: 'select', ...identity, optionId: option.id }, session.sessionId)} style={{ minHeight: 48, padding: 16, borderRadius: 12, borderWidth: 2, borderColor: selected ? colors.accent : colors.border }}>
            <Text style={{ color: colors.text, fontSize: 18 }}>{selected ? 'Selected: ' : ''}{explanationText(option.text)}</Text>
          </Pressable>;
        })}</View>
        <Button title="Submit answer and save fixture history" disabled={!session.selectedOptionIds.length || submitted} onPress={() => transition({ type: 'submit', ...identity, at: Date.now() }, session.sessionId)} />
      </Card>
      <PracticeSignalsCard session={session} onAction={action => transition(action, session.sessionId)} />
      <Card title="Feedback">
        {!submitted ? <Copy>Submit to reveal scored feedback. Help marks the attempt assisted; storage does not make it learning evidence.</Copy> : !answer ? <><Copy>Feedback is unavailable. Existing save receipts remain below.</Copy><Button title="Restart same selection" onPress={() => restart(session.sessionId)} /></> : <>
          <Text accessibilityLiveRegion="polite" style={{ color: colors.text, fontSize: 20 }}>{answer.correct ? 'Correct' : 'Not the requested answer'}</Text>
          <Copy>Captured confidence: {answer.confidence ?? 'Not provided'} / hint used: {answer.hintUsed ? 'yes' : 'no'} / answer revealed before submission: {answer.answerRevealed ? 'yes' : 'no'}.</Copy>
          <Copy>{answer.firstCommitted ? 'First commit in this local selection history.' : 'Repeated commit in this local restart history.'}{answer.missedRetry ? ' Retry after an earlier miss in this history.' : ''}</Copy>
          <ExplanationView key={session.sessionId + ':' + question.id + ':feedback'} value={question.explanation} />
          <Button title={session.index + 1 === session.questions.length ? 'Finish demo' : 'Next question'} onPress={() => transition({ type: 'next', ...identity }, session.sessionId)} />
        </>}
      </Card>
    </Grid>
    {saveHistory}
  </Page>;
}
