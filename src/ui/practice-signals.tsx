import { Button, Pressable, Text, View } from 'react-native';
import type { Explanation } from '../content/questions.ts';
import { currentPracticeHints, currentPracticeQuestion } from '../core/practice-session.ts';
import type { PracticeAction, PracticeConfidence, PracticeSession } from '../core/practice-session.ts';
import { Card, Copy, usePalette } from './shell.tsx';
import { ContentRenderer } from './content-renderer.tsx';
const confidenceOptions: readonly { value: PracticeConfidence | null; label: string }[] = [
  { value: null, label: 'Not provided' }, { value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }
];
function ExplanationView({ value }: { value: Explanation }) {
  return typeof value === 'string' ? <Copy>{value}</Copy> : <ContentRenderer blocks={value} interactive={false} />;
}
export function PracticeSignalsCard({ session, onAction }: { session: PracticeSession; onAction: (action: PracticeAction) => void }) {
  const colors = usePalette();
  const question = currentPracticeQuestion(session);
  if (!question) return null;
  const identity = { questionId: question.id, questionRevision: question.revision };
  const submitted = session.phase !== 'answering';
  const revealed = session.signals.answerRevealedAt !== null;
  const assisted = session.signals.hints.length > 0 || revealed;
  const confidenceLocked = submitted || assisted;
  const hints = currentPracticeHints(session);
  return <Card title="Confidence and help">
    <Copy>Optional confidence before help. It does not change your score.</Copy>
    <View style={{ gap: 8 }}>{confidenceOptions.map(option => {
      const selected = session.signals.confidence === option.value;
      return <Pressable key={option.value ?? 'none'} accessibilityRole="radio" accessibilityLabel={'Confidence: ' + option.label} accessibilityState={{ checked: selected, disabled: confidenceLocked }} disabled={confidenceLocked} onPress={() => onAction({ type: 'confidence', ...identity, value: option.value, at: Date.now() })} style={{ minHeight: 48, padding: 12, borderWidth: 2, borderColor: selected ? colors.accent : colors.border, borderRadius: 12 }}>
        <Text style={{ color: colors.text, fontSize: 17 }}>{selected ? 'Selected: ' : ''}{option.label}</Text>
      </Pressable>;
    })}</View>
    {confidenceLocked && <Copy>Confidence is locked after help or submission.</Copy>}
    <Copy>Hints / using one marks this attempt assisted.</Copy>
    {!hints.length && <Copy>No hints supplied for this question.</Copy>}
    {hints.map(hint => {
      const used = session.signals.hints.some(exposure => exposure.hintId === hint.id);
      return <View key={hint.id} style={{ gap: 8 }}>
        <Button title={used ? hint.label + ' / revealed' : hint.label} disabled={submitted || used} onPress={() => onAction({ type: 'hint', ...identity, hintId: hint.id, at: Date.now() })} />
        {used && <ExplanationView value={hint.content} />}
      </View>;
    })}
    <Button title={revealed ? 'Answer revealed / assisted attempt' : 'Reveal answer (marks this attempt assisted)'} disabled={submitted || revealed} onPress={() => onAction({ type: 'reveal_answer', ...identity, at: Date.now() })} />
    {revealed && <View style={{ gap: 8 }}>
      <Copy>Requested options / revealed before submission</Copy>
      {question.options.filter(option => question.scoring.correctOptionIds.some(id => id === option.id)).map(option => <View key={option.id}><ExplanationView value={option.text} /></View>)}
      <ExplanationView value={question.explanation} />
    </View>}
    <Copy>{assisted ? 'Assistance recorded for this attempt; hiding or navigating away does not make this captured attempt unassisted.' : 'No help has been recorded for this attempt.'}</Copy>
    <Copy>Demo results are excluded from learning evidence regardless of confidence or assistance.</Copy>
  </Card>;
}
