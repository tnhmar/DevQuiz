import { Button, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Action, Copy, EmptyState, Page, usePalette } from '../../src/ui/shell.tsx';
import { blockText, DEMO_NOTICE, findDemoLesson } from '../../src/demo/catalogue.ts';
export default function DemoLesson() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const router = useRouter();
  const colors = usePalette();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const lesson = findDemoLesson(id);
  return <Page title={lesson?.title ?? 'Lesson unavailable'} subtitle="Small JSON-backed lesson preview; the full block reader follows separately.">
    <Copy>{DEMO_NOTICE}</Copy>
    <Button title="Back to Learn" onPress={() => router.replace('/(tabs)/learn')} />
    {!lesson ? <EmptyState title="Unknown lesson" detail="This ID is not part of the bundled demo." /> : <>
      <Copy>Objective: {lesson.objective}</Copy>
      <View style={{ gap: 16 }}>{lesson.body.map((block, index) => <Text key={index} accessibilityRole={block.type === 'heading' ? 'header' : undefined} style={{ color: colors.text, fontSize: block.type === 'heading' ? 22 : 17, lineHeight: 28, fontWeight: block.type === 'heading' ? '600' : '400' }}>{blockText(block)}</Text>)}</View>
      <Action label="Try the two demo questions" href="/(tabs)/practice" />
    </>}
  </Page>;
}
