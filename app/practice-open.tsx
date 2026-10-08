import { useRef, useState } from 'react';
import { Button, Keyboard, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Card, Copy, EmptyState, Page, usePalette } from '../src/ui/shell.tsx';
import { ContentRenderer } from '../src/ui/content-renderer.tsx';
import { DEMO_NOTICE } from '../src/demo/catalogue.ts';
import fixture from '../src/content/demo-open.en.json';
import { canFinishOpenPractice, createOpenPractice, reduceOpenPractice } from '../src/core/open-practice.ts';
import type { OpenPractice, OpenPracticeAction, OpenQuestion, RubricRating } from '../src/core/open-practice.ts';
import type { PracticeConfidence } from '../src/core/practice-session.ts';
type OpenView = { state: OpenPractice | null; error: string | null };
const ratings: readonly RubricRating[] = [0, 1, 2];
const confidenceOptions: readonly { value: PracticeConfidence | null; label: string }[] = [{ value: null, label: 'Not provided' }, { value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }];
let serial = 0;
function nextSessionId() { serial += 1; return 'demo.open:' + Date.now() + ':' + serial; }
function startDemo(): OpenView {
  try {
    const { packId, contentVersion, language } = fixture.content;
    if (fixture.fixture !== true || (language !== 'en' && language !== 'fr')) throw new Error('Unsupported local fixture');
    return { state: createOpenPractice({ sessionId: nextSessionId(), content: { packId, contentVersion, language }, fixture: true, question: fixture.question as unknown as OpenQuestion }), error: null };
  } catch { return { state: null, error: 'The open-response demo could not be started. No progress was saved.' }; }
}
export default function OpenPracticeDemo() {
  const colors = usePalette();
  const router = useRouter();
  const [view, setView] = useState<OpenView>(startDemo);
  const live = useRef(view);
  function show(next: OpenView) { live.current = next; setView(next); }
  function transition(action: OpenPracticeAction) {
    const previous = live.current;
    if (!previous.state || (previous.error && action.type !== 'restart')) return;
    try { const state = reduceOpenPractice(previous.state, action); if (state !== previous.state) show({ state, error: null }); }
    catch { show({ state: previous.state, error: 'The demo could not continue. No progress was saved. Restart to try again.' }); }
  }
  function restart(expectedSessionId: string | null) {
    const state = live.current.state;
    if ((state?.sessionId ?? null) !== expectedSessionId) return;
    Keyboard.dismiss();
    if (!state) show(startDemo());
    else transition({ type: 'restart', sessionId: state.sessionId, questionId: state.question.id, questionRevision: state.question.revision, nextSessionId: nextSessionId() });
  }
  const state = view.state;
  const identity = state ? { sessionId: state.sessionId, questionId: state.question.id, questionRevision: state.question.revision } : null;
  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <Page title="Open-response demo" subtitle="Write, choose optional confidence, then compare and rate yourself. Subjective practice only.">
      <Copy>{DEMO_NOTICE}</Copy>
      <Button title="Back to choice practice (discard this demo)" onPress={() => { Keyboard.dismiss(); router.replace('/(tabs)/practice'); }} />
      {view.error || !state || !identity ? <>
        <EmptyState title="Open demo unavailable" detail={view.error ?? 'No open-response session is available.'} />
        <Button title="Restart open demo" onPress={() => restart(state?.sessionId ?? null)} />
      </> : <>
        <Card title="Your response">
          <ContentRenderer key={state.sessionId + ':prompt'} blocks={state.question.prompt} interactive={false} />
          {state.phase === 'writing' ? <>
            <TextInput accessibilityLabel="Your open response" multiline maxLength={100000} value={state.text} onChangeText={text => transition({ type: 'edit', ...identity, text })} placeholder="Write your own answer before revealing the model answer" placeholderTextColor={colors.muted} style={{ minHeight: 160, padding: 16, borderWidth: 1, borderColor: colors.border, borderRadius: 12, color: colors.text, backgroundColor: colors.background, fontSize: 17, lineHeight: 26, textAlignVertical: 'top' }} />
            <Copy>{state.text.length} / 100000 characters. Blank answers cannot be submitted.</Copy>
          </> : <>
            <Copy>Submitted response / locked for this attempt</Copy>
            <Text selectable style={{ color: colors.text, fontSize: 17, lineHeight: 26 }}>{state.text}</Text>
          </>}
          <Copy>Optional confidence before submission / no effect on rubric points</Copy>
          <View style={{ gap: 8 }}>{confidenceOptions.map(option => {
            const selected = state.confidence === option.value;
            const locked = state.phase !== 'writing';
            return <Pressable key={option.value ?? 'none'} accessibilityRole="radio" accessibilityLabel={'Open-response confidence: ' + option.label} accessibilityState={{ checked: selected, disabled: locked }} disabled={locked} onPress={() => transition({ type: 'confidence', ...identity, value: option.value, at: Date.now() })} style={{ minHeight: 48, padding: 12, borderWidth: 2, borderColor: selected ? colors.accent : colors.border, borderRadius: 12 }}>
              <Text style={{ color: colors.text, fontSize: 17 }}>{selected ? 'Selected: ' : ''}{option.label}</Text>
            </Pressable>;
          })}</View>
          {state.phase === 'writing' ? <Button title="Submit and reveal model answer" disabled={!state.text.trim()} onPress={() => { Keyboard.dismiss(); transition({ type: 'submit', ...identity, at: Date.now() }); }} /> : <Copy>Captured confidence: {state.submittedConfidence?.value ?? 'Not provided'} / locked before model-answer comparison.</Copy>}
        </Card>
        {state.phase === 'writing' ? <Copy>The model answer and rubric will appear after submission. Nothing is graded automatically.</Copy> : <>
          <Card title="Model answer">
            <ContentRenderer key={state.sessionId + ':model'} blocks={state.question.modelAnswer} interactive={false} />
            {typeof state.question.explanation === 'string' ? <Copy>{state.question.explanation}</Copy> : <ContentRenderer blocks={state.question.explanation} interactive={false} />}
          </Card>
          <Card title="Self-assessment rubric">
            <Copy>Choose one anchor for every criterion. Zero is a valid rating. These ratings are your judgement, not an objective correctness score.</Copy>
            {state.question.rubric.map(criterion => <View key={criterion.id} style={{ gap: 10 }}>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>{criterion.criterion}{criterion.critical ? ' / critical criterion' : ''}</Text>
              {ratings.map(rating => {
                const selected = state.ratings[criterion.id] === rating;
                return <Pressable key={rating} accessibilityRole="radio" accessibilityLabel={criterion.criterion + ' / ' + rating + ': ' + criterion.anchors[String(rating) as '0' | '1' | '2']} accessibilityState={{ checked: selected, disabled: state.phase === 'finished' }} disabled={state.phase === 'finished'} onPress={() => transition({ type: 'rate', ...identity, criterionId: criterion.id, rating })} style={{ minHeight: 48, padding: 14, borderRadius: 12, borderWidth: 2, borderColor: selected ? colors.accent : colors.border }}>
                  <Text style={{ color: colors.text, fontSize: 17, lineHeight: 25 }}>{selected ? 'Selected: ' : ''}{rating}: {criterion.anchors[String(rating) as '0' | '1' | '2']}</Text>
                </Pressable>;
              })}
            </View>)}
            {state.phase === 'rating' && <Button title="Finish self-assessment" disabled={!canFinishOpenPractice(state)} onPress={() => transition({ type: 'finish', ...identity, at: Date.now() })} />}
          </Card>
        </>}
        {state.phase === 'finished' && state.result && <Card title="Temporary self-assessment result">
          <Text accessibilityLiveRegion="polite" style={{ color: colors.text, fontSize: 20 }}>Self-rated rubric: {state.result.subjectivePoints} / {state.result.maxSubjectivePoints}</Text>
          <Copy>Confidence captured with the written answer: {state.result.confidence ?? 'Not provided'}.</Copy>
          {state.result.criticalRatings.map(item => <Copy key={item.criterionId}>Critical criterion: {state.question.rubric.find(criterion => criterion.id === item.criterionId)?.criterion ?? item.criterionId} / self-rating {item.rating} of 2</Copy>)}
          <Copy>Confidence is self-reported, not proof of correctness. This remains objective: false. Not mastery, interview readiness or an exam pass. Nothing was saved.</Copy>
        </Card>}
        <Button title="Restart open demo (clear answer and confidence)" onPress={() => restart(state.sessionId)} />
      </>}
    </Page>
  </KeyboardAvoidingView>;
}
