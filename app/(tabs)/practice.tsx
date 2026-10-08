import { useRef, useState } from 'react';
import { Link } from 'expo-router';
import { Button, Pressable, Text, View } from 'react-native';
import { Card, Copy, EmptyState, Grid, Page, usePalette } from '../../src/ui/shell.tsx';
import { ContentRenderer } from '../../src/ui/content-renderer.tsx';
import { DEMO_NOTICE, demoQuestions, explanationText } from '../../src/demo/catalogue.ts';
import fixture from '../../src/content/demo.en.json';
import type { Explanation } from '../../src/content/questions.ts';
import { createPracticeSession, currentPracticeQuestion, practiceSummary, reducePracticeSession } from '../../src/core/practice-session.ts';
import type { PracticeAction, PracticeSession } from '../../src/core/practice-session.ts';
type PracticeView = { session: PracticeSession | null; error: string | null };
let sessionSerial = 0;
function nextSessionId() {
  sessionSerial += 1;
  return 'demo.ui:' + Date.now() + ':' + sessionSerial;
}
function startDemo(): PracticeView {
  try {
    const { packId, contentVersion, language } = fixture.data.pack;
    if (language !== 'en' && language !== 'fr') throw new Error('Unsupported demo language');
    return {
      session: createPracticeSession({ sessionId: nextSessionId(), content: { packId, contentVersion, language }, fixture: true, questions: demoQuestions() }),
      error: null
    };
  } catch {
    return { session: null, error: 'The demo session could not be started. No progress was saved.' };
  }
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
  const colors = usePalette();
  const [view, setView] = useState<PracticeView>(startDemo);
  const live = useRef(view);
  function show(next: PracticeView) {
    live.current = next;
    setView(next);
  }
  function transition(action: PracticeAction, expectedSessionId: string) {
    const previous = live.current;
    if (!previous.session || previous.session.sessionId !== expectedSessionId) return;
    try {
      const session = reducePracticeSession(previous.session, action);
      if (session !== previous.session) show({ session, error: null });
    } catch {
      show({ session: previous.session, error: 'The demo session could not continue. No progress was saved. Restart to try again.' });
    }
  }
  function restart(expectedSessionId: string | null) {
    if ((live.current.session?.sessionId ?? null) !== expectedSessionId) return;
    if (expectedSessionId === null) show(startDemo());
    else transition({ type: 'restart', sessionId: nextSessionId() }, expectedSessionId);
  }
  const session = view.session;
  if (view.error || !session) return <Page title="Demo practice unavailable" subtitle="Temporary sandbox only; no progress is recorded.">
    <Copy>{DEMO_NOTICE}</Copy>
    <OpenDemoLink />
    <EmptyState title="Session unavailable" detail={view.error ?? 'No demo session is available.'} />
    <Button title="Restart demo" onPress={() => restart(session?.sessionId ?? null)} />
  </Page>;
  if (session.phase === 'finished') {
    const summary = practiceSummary(session);
    return <Page title="Demo complete" subtitle="Temporary sandbox result, not learning evidence.">
      <Copy>{DEMO_NOTICE}</Copy>
      <OpenDemoLink />
      <Copy>{summary.correct} / {summary.answered} answers matched the requested options.</Copy>
      <Copy>{summary.answered} / {summary.totalQuestions} questions completed.</Copy>
      <Copy>Nothing was saved to progress, review history or exam readiness.</Copy>
      <Button title="Try demo again" onPress={() => restart(session.sessionId)} />
    </Page>;
  }
  const question = currentPracticeQuestion(session);
  if (!question) return <Page title="Demo practice" subtitle="No supported demo question available.">
    <Copy>{DEMO_NOTICE}</Copy>
    <OpenDemoLink />
    <EmptyState title="No demo questions" detail="This small preview uses the bundled choice questions only." />
    <Button title="Restart demo" onPress={() => restart(session.sessionId)} />
  </Page>;
  const identity = { questionId: question.id, questionRevision: question.revision };
  const submitted = session.phase === 'feedback';
  const answer = submitted ? session.answers[session.index] : undefined;
  return <Page title="Demo practice" subtitle="Select, submit, read feedback and continue. No answers are persisted.">
    <Copy>{DEMO_NOTICE}</Copy>
    <OpenDemoLink />
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
      <Card title="Feedback">
        {!submitted ? <Copy>Submit an answer to reveal its explanation.</Copy> : !answer ? <>
          <Copy>Feedback is unavailable. Restart the demo to continue.</Copy>
          <Button title="Restart demo" onPress={() => restart(session.sessionId)} />
        </> : <>
          <Text accessibilityLiveRegion="polite" style={{ color: colors.text, fontSize: 20 }}>{answer.correct ? 'Correct' : 'Not the requested answer'}</Text>
          <ExplanationView key={session.sessionId + ':' + question.id + ':feedback'} value={question.explanation} />
          <Button title={session.index + 1 === session.questions.length ? 'Finish demo' : 'Next question'} onPress={() => transition({ type: 'next', ...identity }, session.sessionId)} />
        </>}
      </Card>
    </Grid>
  </Page>;
}
