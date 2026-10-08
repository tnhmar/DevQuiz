import { useMemo, useRef, useState } from 'react';
import { Button, Pressable, Text, View } from 'react-native';
import type { Dimension, Level } from '../content/questions.ts';
import { DEFAULT_PRACTICE_FILTERS, selectPracticeQuestions } from '../core/practice-selection.ts';
import type { ChoiceType, PracticeCandidate, PracticeFilters, PracticeSelection, PracticeSelectionRequest } from '../core/practice-selection.ts';
import { Card, Copy, EmptyState, Grid, usePalette } from './shell.tsx';
type NamedOption = { id: string; label: string };
type SetupProps = {
  pool: readonly PracticeCandidate[]; domains: readonly NamedOption[];
  tracks: readonly (NamedOption & { domainId: string })[];
  initialRequest?: PracticeSelectionRequest; onStart: (selection: PracticeSelection) => void;
};
const levels: readonly Level[] = ['beginner', 'intermediate', 'advanced', 'expert'];
const dimensions: readonly Dimension[] = ['recall', 'understanding', 'application', 'diagnosis', 'design_judgement'];
const types: readonly { value: ChoiceType; label: string }[] = [{ value: 'single', label: 'Single choice' }, { value: 'multi', label: 'Multiple choice' }, { value: 'true_false', label: 'True / false' }];
function title(value: string) { return value.charAt(0).toUpperCase() + value.slice(1).replace('_', ' '); }
function OptionButton({ label, selected, onPress, multiple = false }: { label: string; selected: boolean; onPress: () => void; multiple?: boolean }) {
  const colors = usePalette();
  return <Pressable accessibilityRole={multiple ? 'checkbox' : 'radio'} accessibilityLabel={label} accessibilityState={{ checked: selected }} onPress={onPress} style={{ minHeight: 48, padding: 12, borderWidth: 2, borderColor: selected ? colors.accent : colors.border, borderRadius: 12 }}>
    <Text style={{ color: colors.text, fontSize: 16, lineHeight: 24 }}>{selected ? 'Selected: ' : ''}{label}</Text>
  </Pressable>;
}
function SingleFilter<T extends string | null>({ label, options, value, onChange }: { label: string; options: readonly { value: T; label: string }[]; value: T; onChange: (value: T) => void }) {
  return <View style={{ gap: 8 }}><Copy>{label}</Copy>{options.map(option => <OptionButton key={option.value ?? 'all'} label={option.label} selected={option.value === value} onPress={() => onChange(option.value)} />)}</View>;
}
export function PracticeSetup({ pool, domains, tracks, initialRequest, onStart }: SetupProps) {
  const [request, setRequest] = useState<PracticeSelectionRequest>(() => {
    const value = initialRequest ?? { filters: DEFAULT_PRACTICE_FILTERS, count: 2, order: 'source' as const, seed: 0 };
    return { ...value, filters: { ...value.filters, types: [...value.filters.types] } };
  });
  const [startError, setStartError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const startLock = useRef(false);
  const preview = useMemo(() => {
    try { return { selection: selectPracticeQuestions(pool, request), error: null }; }
    catch { return { selection: null, error: 'The question pool or setup could not be selected. No session was started.' }; }
  }, [pool, request]);
  function changeFilters(patch: Partial<PracticeFilters>) {
    setStartError(null);
    setRequest(previous => ({ ...previous, filters: { ...previous.filters, ...patch } }));
  }
  function start() {
    if (startLock.current || !preview.selection?.selected) return;
    startLock.current = true; setStarting(true); setStartError(null);
    try { onStart(preview.selection); }
    catch { startLock.current = false; setStarting(false); setStartError('The selected session could not be started. No progress was saved.'); }
  }
  const selection = preview.selection;
  const visibleTracks = tracks.filter(track => request.filters.domainId === null || track.domainId === request.filters.domainId);
  return <View style={{ gap: 16 }}>
    <Copy>Configure choice practice before starting. Open responses remain in the separate self-assessment demo.</Copy>
    <Grid>
      <Card title="Domain and track">
        <SingleFilter label="Domain" options={[{ value: null, label: 'Any domain' }, ...domains.map(item => ({ value: item.id, label: item.label }))]} value={request.filters.domainId} onChange={domainId => changeFilters({ domainId, trackId: null })} />
        <SingleFilter label="Track" options={[{ value: null, label: 'Any track' }, ...visibleTracks.map(item => ({ value: item.id, label: item.label }))]} value={request.filters.trackId} onChange={trackId => changeFilters({ trackId })} />
      </Card>
      <Card title="Level and skill">
        <SingleFilter label="Level" options={[{ value: null, label: 'Any level' }, ...levels.map(value => ({ value, label: title(value) }))]} value={request.filters.level} onChange={level => changeFilters({ level })} />
        <SingleFilter label="Skill dimension" options={[{ value: null, label: 'Any skill dimension' }, ...dimensions.map(value => ({ value, label: title(value) }))]} value={request.filters.dimension} onChange={dimension => changeFilters({ dimension })} />
      </Card>
      <Card title="Format, size and order">
        <Copy>Question types / select one or more</Copy>
        {types.map(item => <OptionButton key={item.value} label={item.label} multiple selected={request.filters.types.includes(item.value)} onPress={() => {
          setStartError(null);
          setRequest(previous => ({ ...previous, filters: { ...previous.filters, types: previous.filters.types.includes(item.value) ? previous.filters.types.filter(value => value !== item.value) : [...previous.filters.types, item.value] } }));
        }} />)}
        <Copy>Requested question count</Copy>
        {[1, 2, 5, 10, 20, 50, 100].map(count => <OptionButton key={count} label={String(count)} selected={request.count === count} onPress={() => { setStartError(null); setRequest(previous => ({ ...previous, count })); }} />)}
        <SingleFilter label="Question order" options={[{ value: 'source', label: 'Source order' }, { value: 'shuffle', label: 'Seeded shuffle' }]} value={request.order} onChange={order => { setStartError(null); setRequest(previous => ({ ...previous, order })); }} />
        {request.order === 'shuffle' && <><Copy>Shuffle seed: {request.seed}</Copy><Button title="Use a new shuffle seed" onPress={() => setRequest(previous => ({ ...previous, seed: (previous.seed + 1) >>> 0 }))} /></>}
      </Card>
      <Card title="Availability">
        {preview.error ? <EmptyState title="Selection unavailable" detail={preview.error} /> : selection && <>
          <Copy>{selection.matchingQuestions} matching questions / {selection.availableFamilies} distinct question families.</Copy>
          <Copy>Requested: {selection.requested}. This session will contain: {selection.selected}.</Copy>
          {selection.excludedFamilyVariants > 0 && <Copy>{selection.excludedFamilyVariants} additional family variants excluded to avoid repeating a family.</Copy>}
          {selection.shortfall > 0 && <Copy>Shortage: {selection.shortfall}. Start uses only the available selection; no repeats or replacement filters are added.</Copy>}
          {!selection.selected && <EmptyState title="No matching questions" detail="Change the filters or select a question type. The demo bank does not cover every level, skill or type." />}
        </>}
        {startError && <Copy>{startError}</Copy>}
        <Button title={starting ? 'Starting session' : 'Start ' + (selection?.selected ?? 0) + ' available questions'} disabled={starting || !selection?.selected || !!preview.error} onPress={start} />
        <Button title="Reset setup filters" disabled={starting} onPress={() => { setStartError(null); setRequest({ filters: { ...DEFAULT_PRACTICE_FILTERS, types: [...DEFAULT_PRACTICE_FILTERS.types] }, count: 2, order: 'source', seed: 0 }); }} />
      </Card>
    </Grid>
  </View>;
}
