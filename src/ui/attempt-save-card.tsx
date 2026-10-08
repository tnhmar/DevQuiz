import { useSyncExternalStore } from 'react';
import { Button, Text } from 'react-native';
import type { AttemptSaveController } from '../storage/attempt-save.ts';
import { Card, Copy, usePalette } from './shell.tsx';
export function AttemptSaveCard({ controller, label }: { controller: AttemptSaveController; label?: string }) {
  const colors = usePalette();
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  return <Card title={snapshot.fixture ? 'Local fixture-history save' : 'Local attempt-history save'}>
    {label && <Copy>{label}</Copy>}
    <Text accessibilityLiveRegion="polite" style={{ color: colors.text, fontSize: 17, lineHeight: 26 }}>{snapshot.message}</Text>
    <Copy>Method: {snapshot.objective ? 'objective choice scoring' : 'subjective open self-assessment'} / status: {snapshot.status}.</Copy>
    {snapshot.fixture && <Copy>Demo fixture / excluded from learning progress and readiness even when saved.</Copy>}
    {!snapshot.objective && <Copy>Self-ratings remain subjective; storing them does not make them objective evidence.</Copy>}
    <Copy>A storage receipt does not establish publication approval, evidence eligibility or mastery.</Copy>
    <Button title={snapshot.status === 'unconfirmed' ? 'Retry save of the same captured record' : snapshot.status === 'saving' ? 'Saving' : snapshot.status === 'saved' ? 'Save confirmed' : snapshot.status === 'conflict' ? 'Conflict / no overwrite' : 'Save captured record locally'} disabled={snapshot.status === 'saving' || snapshot.status === 'saved' || snapshot.status === 'conflict'} onPress={() => { void controller.save(); }} />
    {snapshot.status === 'conflict' && <Copy>Do not regenerate the record ID to bypass this conflict. History reconciliation requires a separate flow.</Copy>}
  </Card>;
}
