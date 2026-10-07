import { useRef, useState } from 'react';
import { Button, ScrollView, Text } from 'react-native';
import * as Crypto from 'expo-crypto';
import { openDatabaseAsync } from 'expo-sqlite';
import { scoreChoice } from '../src/core/assessment.ts';
const demo = { type: 'single' as const, options: ['a', 'b'], correctOptionIds: ['b'] };
export default function Home() {
  const lock = useRef(false);
  const [message, setMessage] = useState('Foundation preview. Demo responses are not learning evidence.');
  const [saving, setSaving] = useState(false);
  async function answer(id: string) {
    if (lock.current) return;
    lock.current = true;
    setSaving(true);
    let db: Awaited<ReturnType<typeof openDatabaseAsync>> | undefined;
    try {
      const result = scoreChoice(demo, [id]);
      db = await openDatabaseAsync('devquiz.db');
      await db.execAsync('CREATE TABLE IF NOT EXISTS demo_events (id TEXT PRIMARY KEY, payload TEXT NOT NULL)');
      await db.runAsync('INSERT INTO demo_events (id,payload) VALUES (?,?)', Crypto.randomUUID(), JSON.stringify({ fixture: true, at: Date.now(), selected: [id], result }));
      setMessage(result.correct ? 'Correct demo answer. Saved locally; excluded from mastery.' : 'Incorrect demo answer. Saved locally; excluded from mastery.');
    } catch (error) {
      setMessage('Not saved: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      if (db) await db.closeAsync().catch(() => undefined);
      lock.current = false;
      setSaving(false);
    }
  }
  return <ScrollView contentContainerStyle={{ padding: 24, gap: 16, maxWidth: 900, width: '100%', alignSelf: 'center' }}>
    <Text accessibilityRole="header" style={{ fontSize: 28 }}>DevQuiz</Text>
    <Text>Architecture / DDD / Cloud / Java / Spring / Advanced AI</Text>
    <Text>English-first, offline-first phone and tablet foundation.</Text>
    <Text accessibilityRole="header" style={{ fontSize: 20 }}>Demo: select the option labelled B</Text>
    <Button title="A" disabled={saving} onPress={() => void answer('a')} />
    <Button title="B" disabled={saving} onPress={() => void answer('b')} />
    <Text accessibilityLiveRegion="polite">{message}</Text>
  </ScrollView>;
}
