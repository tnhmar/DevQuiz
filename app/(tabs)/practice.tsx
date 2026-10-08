import { useRef, useState } from 'react';
import { Link } from 'expo-router';
import { Button, Pressable, Text, View } from 'react-native';
import { Card, Copy, EmptyState, Grid, Page, usePalette } from '../../src/ui/shell.tsx';
import { ContentRenderer } from '../../src/ui/content-renderer.tsx';
import { PracticeSetup } from '../../src/ui/practice-setup.tsx';
import { PracticeSignalsCard } from '../../src/ui/practice-signals.tsx';
import { DEMO_NOTICE, explanationText } from '../../src/demo/catalogue.ts';
import { createDemoPracticePool } from '../../src/demo/practice-pool.ts';
import { demoPracticeHints } from '../../src/demo/practice-hints.ts';
import type { Explanation } from '../../src/content/questions.ts';
import { createPracticeSession, currentPracticeQuestion, practiceSummary, reducePracticeSession } from '../../src/core/practice-session.ts';
import type { PracticeAction, PracticeSession } from '../../src/core/practice-session.ts';
import type { PracticeSelection, PracticeSelectionRequest } from '../../src/core/practice-selection.ts';
type PracticeView = { session: PracticeSession; error: string | null };
let sessionSerial = 0;
function nextSessionId() { sessionSerial += 1; return 'demo.ui:' + Date.now() + ':' + sessionSerial; }
function loadPool() {
  try { return { data: createDemoPracticePool(), error: null }; }
  catch { return { data: null, error: 'The demo question pool could not be loaded. No progress was saved.' }; }
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
    <Copy>Separate writing and rubric demo / subjective self-ratings / nothing saved to progress.</Copy>
  </View>;
}
export default function Practice() {
  const [bank, setBank] = useState(loadPool);
  const [active, setActive] = useState<{ session: PracticeSession; selection: PracticeSelection } | null>(null);
  const [lastRequest, setLastRequest] = useState<PracticeSelectionRequest | undefined>(undefined);
  const activeId = useRef<string | null>(null);
  function begin(selection: PracticeSelection) {
    if (activeId.current !== null || !bank.data || !selection.selected) throw new Error('Session cannot be started');
    const session = createPracticeSession({ sessionId: nextSessionId(), content: bank.data.content, fixture: true, questions: selection.questions, hintsByQuestion: demoPracticeHints(selection.questions) });
    activeId.current = session.sessionId;
    setLastRequest({ filters: selection.filters, count: selection.requested, order: selection.order, seed: selection.seed ?? 0 });
    setActive({ session, selection });
  }
  function leave(expectedId: string) {
    if (activeId.current !== expectedId) return;
    activeId.current = null; setActive(null);
  }
  if (active) return <ChoicePractice key={active.session.sessionId} initialSession={active.session} selection={active.selection} onSetup={() => leave(active.session.sessionId)} />;
  return <Page title="Practice setup" subtitle="Choose filters and session size before starting the demo.">
    <Copy>{DEMO_NOTICE}</Copy>
    <OpenDemoLink />
    {!bank.data ? <><EmptyState title="Question pool unavailable" detail={bank.error ?? 'No demo pool is available.'} /><Button title="Reload demo pool" onPress={() => setBank(loadPool())} /></> : <PracticeSetup pool={bank.data.pool} domains={bank.data.domains} tracks={bank.data.tracks} initialRequest={lastRequest} onStart={begin} />}
  </Page>;
}
function ChoicePractice({ initialSession, selection, onSetup }: { initialSession: PracticeSession; selection: PracticeSelection; onSetup: () => void }) {
  const colors = usePalette();
  const [view, setView] = useState<PracticeView>(() => ({ session: initialSession, error: null }));
  const live = useRef(view);
  function show(next: PracticeView) { live.current = next; setView(next); }
  function transition(action: PracticeAction, expectedSessionId: string) {
    const previous = live.current;
    if (previous.session.sessionId !== expectedSessionId || (previous.error && action.type !== 'restart')) return;
    try {
      const session = reducePracticeSession(previous.session, action);
      if (session !== previous.session) show({ session, error: null });
    } catch {
      show({ session: previous.session, error: 'The demo session could not continue. No progress was saved. Restart or change setup.' });
    }
  }
  function restart(expectedSessionId: string) {
    if (live.current.session.sessionId !== expectedSessionId) return;
    transition({ type: 'restart', sessionId: nextSessionId() }, expectedSessionId);
  }
  const session = view.session;
  const navigation = <><OpenDemoLink /><Button title="Change setup (discard this choice session)" onPress={onSetup} /></>;
  if (view.error) return <Page title="Demo practice unavailable" subtitle="Temporary sandbox only; no progress is recorded.">
    <Copy>{DEMO_NOTICE}</Copy>{navigation}
    <EmptyState title="Session unavailable" detail={view.error} />
    <Button title="Restart same selection" onPress={() => restart(session.sessionId)} />
  </Page>;
  if (session.phase === 'finished') {
    const summary = practiceSummary(session);
    return <Page title="Demo complete" subtitle="Temporary sandbox result, not learning evidence.">
      <Copy>{DEMO_NOTICE}</Copy>{navigation}
      <Copy>{summary.correct} / {summary.answered} answers matched the requested options.</Copy>
      <Copy>{summary.answered} / {summary.totalQuestions} questions completed; {selection.requested} originally requested.</Copy>
      <Copy>{summary.assisted} assisted responses / {summary.repeatedCommits} repeated commits in this local restart history.</Copy>
      <Copy>The total includes assisted answers and is not an unassisted mastery score. Nothing was saved to progress, review history or exam readiness.</Copy>
      <Button title="Retry same selection" onPress={() => restart(session.sessionId)} />
    </Page>;
  }
  const question = currentPracticeQuestion(session);
  if (!question) return <Page title="Demo practice" subtitle="No supported demo question available.">
    <Copy>{DEMO_NOTICE}</Copy>{navigation}
    <EmptyState title="No questions" detail="Return to setup and choose an available selection." />
  </Page>;
  const identity = { questionId: question.id, questionRevision: question.revision };
  const submitted = session.phase === 'feedback';
  const answer = submitted ? session.answers[session.index] : undefined;
  const repeated = session.previouslyCommittedIds.includes(question.id);
  const previouslyMissed = session.previouslyMissedIds.includes(question.id);
  return <Page title="Demo practice" subtitle="Choose optional confidence, use help if needed, submit and read feedback. No answers are persisted.">
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
        <Button title="Submit answer" disabled={!session.selectedOptionIds.length || submitted} onPress={() => transition({ type: 'submit', ...identity, at: Date.now() }, session.sessionId)} />
      </Card>
      <PracticeSignalsCard session={session} onAction={action => transition(action, session.sessionId)} />
      <Card title="Feedback">
        {!submitted ? <Copy>Submit an answer to reveal scored feedback. Revealing help first marks this attempt assisted.</Copy> : !answer ? <><Copy>Feedback is unavailable. Restart the demo to continue.</Copy><Button title="Restart same selection" onPress={() => restart(session.sessionId)} /></> : <>
          <Text accessibilityLiveRegion="polite" style={{ color: colors.text, fontSize: 20 }}>{answer.correct ? 'Correct' : 'Not the requested answer'}</Text>
          <Copy>Captured confidence: {answer.confidence ?? 'Not provided'} / hint used: {answer.hintUsed ? 'yes' : 'no'} / answer revealed before submission: {answer.answerRevealed ? 'yes' : 'no'}.</Copy>
          <Copy>{answer.firstCommitted ? 'First commit in this local selection history.' : 'Repeated commit in this local restart history.'}{answer.missedRetry ? ' Retry after an earlier miss in this history.' : ''}</Copy>
          <ExplanationView key={session.sessionId + ':' + question.id + ':feedback'} value={question.explanation} />
          <Button title={session.index + 1 === session.questions.length ? 'Finish demo' : 'Next question'} onPress={() => transition({ type: 'next', ...identity }, session.sessionId)} />
        </>}
      </Card>
    </Grid>
  </Page>;
}
