import { Button } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Action, Copy, EmptyState, Page } from '../../src/ui/shell.tsx';
import { ContentRenderer } from '../../src/ui/content-renderer.tsx';
import { DEMO_NOTICE, findDemoLesson } from '../../src/demo/catalogue.ts';
export default function DemoLesson() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const router = useRouter();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const lesson = findDemoLesson(id);
  return <Page title={lesson?.title ?? 'Lesson unavailable'} subtitle="Typed lesson blocks rendered from the content JSON.">
    <Copy>{DEMO_NOTICE}</Copy>
    <Button title="Back to Learn" onPress={() => router.replace('/(tabs)/learn')} />
    {!lesson ? <EmptyState title="Unknown lesson" detail="This ID is not part of the bundled demo." /> : <>
      <Copy>Objective: {lesson.objective}</Copy>
      <ContentRenderer blocks={lesson.body} />
      <Action label="Try the two demo questions" href="/(tabs)/practice" />
    </>}
  </Page>;
}
