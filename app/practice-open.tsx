import { useRef, useState } from 'react';
import { Button, Keyboard, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Card, Copy, EmptyState, Grid, Page, usePalette } from '../src/ui/shell.tsx';
import { ContentRenderer } from '../src/ui/content-renderer.tsx';
import { AttemptSaveCard } from '../src/ui/attempt-save-card.tsx';
import { DEMO_NOTICE } from '../src/demo/catalogue.ts';
import fixture from '../src/content/demo-open.en.json';
import { newPracticeSessionId, prepareOpenSave } from '../src/storage/attempt-save.ts';
import type { AttemptSaveController } from '../src/storage/attempt-save.ts';
import { canFinishOpenPractice, createOpenPractice, reduceOpenPractice } from '../src/core/open-practice.ts';
import type { OpenPractice, OpenPracticeAction, OpenQuestion, RubricRating } from '../src/core/open-practice.ts';
import type { PracticeConfidence } from '../src/core/practice-session.ts';
type OpenSaveEntry = { key: string; sessionId: string; questionId: string; controller: AttemptSaveController | null; captureState: OpenPractice | null };
type OpenView = { state: OpenPractice | null; error: string | null; saves: readonly OpenSaveEntry[] };
const ratings: readonly RubricRating[] = [0, 1, 2];
const confidenceOptions: readonly { value: PracticeConfidence | null; label: string }[] = [{ value: null, label: 'Not provided' }, { value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }];
function startDemo(): OpenView {
  try {
    const { packId, contentVersion, language } = fixture.content;
    if (fixture.fixture !== true || (language !== 'en' && language !== 'fr')) throw new Error('Unsupported local fixture');
    return { state: createOpenPractice({ sessionId: newPracticeSessionId(), content: { packId, contentVersion, language }, fixture: true, question: fixture.question as unknown as OpenQuestion }), error: null, saves: [] };
  } catch { return { state: null, error: 'The open-response demo could not be started. Learning progress is not recorded.', saves: [] }; }
}
function capture(state: OpenPractice): OpenSaveEntry {
  const identity = { key: JSON.stringify([state.sessionId, state.question.id]), sessionId: state.sessionId, questionId: state.question.id };
  try { return { ...identity, controller: prepareOpenSave(state), captureState: null }; }
  catch { return { ...identity, controller: null, captureState: state }; }
}
function OpenSaveEntries({ entries, currentSessionId, onRetryCapture }: { entries: readonly OpenSaveEntry[]; currentSessionId: string | null; onRetryCapture: (key: string) => void }) {
  return <Grid>{entries.map(entry => entry.controller ? <AttemptSaveCard key={entry.key} controller={entry.controller} label={entry.questionId + (entry.sessionId === currentSessionId ? ' / current self-assessment' : ' / earlier local self-assessment')} /> : <Card key={entry.key} title="Open storage record not prepared">
    <Copy>{entry.questionId} / finalized subjective self-assessment</Copy>
    <Copy>The finalized answer, confidence and ratings remain in memory, but a storage record could not be prepared. No save was started for this entry.</Copy>
    <Button title="Retry capturing and saving this self-assessment" onPress={() => onRetryCapture(entry.key)} />
  </Card>)}</Grid>;
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
    try {
      const state = reduceOpenPractice(previous.state, action);
      if (state === previous.state) return;
      let saves = previous.saves;
      let newSave: AttemptSaveController | null = null;
      if (action.type === 'finish' && state.phase === 'finished') {
        const entry = capture(state); saves = [...saves, entry]; newSave = entry.controller;
      }
      show({ state, error: null, saves });
      if (newSave) void newSave.save();
    } catch { show({ ...previous, error: 'The open practice action could not continue. Existing save receipts remain available; learning progress is not recorded.' }); }
  }
  function retryCapture(key: string) {
    const previous = live.current;
    const entry = previous.saves.find(item => item.key === key);
    if (!entry || entry.controller || !entry.captureState) return;
    const replacement = capture(entry.captureState);
    show({ ...previous, saves: previous.saves.map(item => item.key === key ? replacement : item) });
    if (replacement.controller) void replacement.controller.save();
  }
  function restart(expectedSessionId: string | null) {
    const previous = live.current;
    const state = previous.state;
    if ((state?.sessionId ?? null) !== expectedSessionId) return;
    Keyboard.dismiss();
    if (!state) { show({ ...startDemo(), saves: previous.saves }); return; }
    try { transition({ type: 'restart', sessionId: state.sessionId, questionId: state.question.id, questionRevision: state.question.revision, nextSessionId: newPracticeSessionId() }); }
    catch { show({ ...previous, error: 'A new open session identity could not be created. Existing save receipts are unchanged.' }); }
  }
  const state = view.state;
  const identity = state ? { sessionId: state.sessionId, questionId: state.question.id, questionRevision: state.question.revision } : null;
  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <Page title="Open-response demo" subtitle="Write and choose confidence, then rate yourself. Finish attempts a local subjective fixture-history save.">
      <Copy>{DEMO_NOTICE}</Copy>
      <Button title="Back to choice practice (leave open session; saved history kept)" onPress={() => { Keyboard.dismiss(); router.replace('/(tabs)/practice'); }} />
      <Copy>Leaving discards unsaved writing/rating state and can hide capture errors. Pending jobs are memory-only; restart recovery is not implemented.</Copy>
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
          {state.phase === 'writing' ? <Button title="Submit and reveal model answer (not saved yet)" disabled={!state.text.trim()} onPress={() => { Keyboard.dismiss(); transition({ type: 'submit', ...identity, at: Date.now() }); }} /> : <Copy>Captured confidence: {state.submittedConfidence?.value ?? 'Not provided'} / locked before model-answer comparison. The finalized rubric save has a separate receipt.</Copy>}
        </Card>
        {state.phase === 'writing' ? <Copy>The model answer and rubric appear after submission. The written submission alone is not persisted by this flow.</Copy> : <>
          <Card title="Model answer">
            <ContentRenderer key={state.sessionId + ':model'} blocks={state.question.modelAnswer} interactive={false} />
            {typeof state.question.explanation === 'string' ? <Copy>{state.question.explanation}</Copy> : <ContentRenderer blocks={state.question.explanation} interactive={false} />}
          </Card>
          <Card title="Self-assessment rubric">
            <Copy>Choose one anchor for every criterion. Zero is valid. Your ratings are subjective, not an objective correctness score.</Copy>
            {state.question.rubric.map(criterion => <View key={criterion.id} style={{ gap: 10 }}>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>{criterion.criterion}{criterion.critical ? ' / critical criterion' : ''}</Text>
              {ratings.map(rating => {
                const selected = state.ratings[criterion.id] === rating;
                return <Pressable key={rating} accessibilityRole="radio" accessibilityLabel={criterion.criterion + ' / ' + rating + ': ' + criterion.anchors[String(rating) as '0' | '1' | '2']} accessibilityState={{ checked: selected, disabled: state.phase === 'finished' }} disabled={state.phase === 'finished'} onPress={() => transition({ type: 'rate', ...identity, criterionId: criterion.id, rating })} style={{ minHeight: 48, padding: 14, borderRadius: 12, borderWidth: 2, borderColor: selected ? colors.accent : colors.border }}>
                  <Text style={{ color: colors.text, fontSize: 17, lineHeight: 25 }}>{selected ? 'Selected: ' : ''}{rating}: {criterion.anchors[String(rating) as '0' | '1' | '2']}</Text>
                </Pressable>;
              })}
            </View>)}
            {state.phase === 'rating' && <Button title="Finish self-assessment and save fixture history" disabled={!canFinishOpenPractice(state)} onPress={() => transition({ type: 'finish', ...identity, at: Date.now() })} />}
          </Card>
        </>}
        {state.phase === 'finished' && state.result && <Card title="Self-assessment result / storage receipt separate">
          <Text accessibilityLiveRegion="polite" style={{ color: colors.text, fontSize: 20 }}>Self-rated rubric: {state.result.subjectivePoints} / {state.result.maxSubjectivePoints}</Text>
          <Copy>Confidence captured with the written answer: {state.result.confidence ?? 'Not provided'}.</Copy>
          {state.result.criticalRatings.map(item => <Copy key={item.criterionId}>Critical criterion: {state.question.rubric.find(criterion => criterion.id === item.criterionId)?.criterion ?? item.criterionId} / self-rating {item.rating} of 2</Copy>)}
          <Copy>Confidence is self-reported. This remains objective: false. Saved fixture history does not establish correctness, mastery, interview readiness or an exam pass.</Copy>
        </Card>}
        <Button title="Restart open demo (clear active answer; saved history kept)" onPress={() => restart(state.sessionId)} />
      </>}
      <OpenSaveEntries entries={view.saves} currentSessionId={state?.sessionId ?? null} onRetryCapture={retryCapture} />
    </Page>
  </KeyboardAvoidingView>;
}
