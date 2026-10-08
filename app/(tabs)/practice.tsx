import { useRef, useState } from 'react';
import { Button, Pressable, Text, View } from 'react-native';
import { Card, Copy, EmptyState, Grid, Page, usePalette } from '../../src/ui/shell.tsx';
import { DEMO_NOTICE, demoQuestions, explanationText } from '../../src/demo/catalogue.ts';
import { scoreChoice } from '../../src/core/assessment.ts';
type DemoResult = { questionId: string; correct: boolean };
export default function Practice() {
  const colors = usePalette();
  const committed = useRef(false);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [outcome, setOutcome] = useState<boolean | null>(null);
  const [results, setResults] = useState<DemoResult[]>([]);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const questions = demoQuestions();
  function restart() {
    committed.current = false; setIndex(0); setSelected([]); setOutcome(null); setResults([]); setComplete(false); setError(null);
  }
  if (complete) return <Page title="Demo complete" subtitle="Temporary sandbox result, not learning evidence.">
    <Copy>{DEMO_NOTICE}</Copy>
    <Copy>{results.filter(result => result.correct).length} / {results.length} answers matched the requested options.</Copy>
    <Copy>Nothing was saved to progress, review history or exam readiness.</Copy>
    <Button title="Try demo again" onPress={restart} />
  </Page>;
  const question = questions[index];
  if (!question || question.type === 'open') return <Page title="Demo practice" subtitle="No supported demo question available.">
    <EmptyState title="Demo unavailable" detail="This small preview supports the bundled choice questions only." />
  </Page>;
  const questionId = question.id;
  const choiceType = question.type;
  const optionIds = question.options.map(option => option.id);
  const correctIds = question.scoring.correctOptionIds;
  function toggle(id: string) {
    if (committed.current || error) return;
    setSelected(previous => choiceType === 'multi' ? previous.includes(id) ? previous.filter(item => item !== id) : [...previous, id] : [id]);
  }
  function submit() {
    if (committed.current || selected.length === 0) return;
    try {
      const result = scoreChoice({ type: choiceType, options: optionIds, correctOptionIds: correctIds }, selected);
      committed.current = true;
      setOutcome(result.correct);
      setResults(previous => [...previous, { questionId, correct: result.correct }]);
    } catch {
      setError('The demo question configuration could not be scored. No result was saved.');
    }
  }
  function next() {
    if (!committed.current) return;
    committed.current = false;
    if (index + 1 >= questions.length) setComplete(true); else setIndex(previous => previous + 1);
    setSelected([]); setOutcome(null); setError(null);
  }
  return <Page title="Demo practice" subtitle="Select, submit, read feedback and continue. No answers are persisted.">
    <Copy>{DEMO_NOTICE}</Copy>
    <Grid>
      <Card title={'Question ' + (index + 1) + ' of ' + questions.length}>
        <Copy>{choiceType === 'multi' ? 'Select all requested options' : 'Choose one option'} / {question.level}</Copy>
        {question.prompt.map((block, position) => <Text key={position} style={{ color: colors.text, fontSize: 18 }}>{explanationText([block])}</Text>)}
        <View style={{ gap: 12 }}>{question.options.map(option => <Pressable key={option.id} accessibilityRole={choiceType === 'multi' ? 'checkbox' : 'radio'} accessibilityState={{ checked: selected.includes(option.id), disabled: outcome !== null || !!error }} disabled={outcome !== null || !!error} onPress={() => toggle(option.id)} style={{ minHeight: 48, padding: 16, borderRadius: 12, borderWidth: 2, borderColor: selected.includes(option.id) ? colors.accent : colors.border }}>
          <Text style={{ color: colors.text, fontSize: 18 }}>{selected.includes(option.id) ? 'Selected: ' : ''}{explanationText(option.text)}</Text>
        </Pressable>)}</View>
        <Button title="Submit answer" disabled={!selected.length || outcome !== null || !!error} onPress={submit} />
      </Card>
      <Card title="Feedback">
        {error ? <><Copy>{error}</Copy><Button title="Restart demo" onPress={restart} /></> : outcome === null ? <Copy>Submit an answer to reveal its explanation.</Copy> : <>
          <Text accessibilityLiveRegion="polite" style={{ color: colors.text, fontSize: 20 }}>{outcome ? 'Correct' : 'Not the requested answer'}</Text>
          <Copy>{explanationText(question.explanation)}</Copy>
          <Button title={index + 1 === questions.length ? 'Finish demo' : 'Next question'} onPress={next} />
        </>}
      </Card>
    </Grid>
  </Page>;
}
