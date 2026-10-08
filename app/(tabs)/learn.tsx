import { Button } from 'react-native';
import { useRouter } from 'expo-router';
import { Card, Copy, EmptyState, Grid, Page } from '../../src/ui/shell.tsx';
import { DEMO_NOTICE, demoGroups } from '../../src/demo/catalogue.ts';
export default function Learn() {
  const router = useRouter();
  const groups = demoGroups();
  return <Page title="Learn" subtitle="Schema-backed domain, track, chapter and lesson browsing.">
    <Copy>{DEMO_NOTICE}</Copy>
    {!groups.length && <EmptyState title="No demo lessons" detail="No chapter/lesson groups are available in the bundled fixture." />}
    <Grid>{groups.map(({ chapter, domain, tracks, lessons }) => <Card key={chapter.id} title={chapter.title}>
      <Copy>{domain?.title ?? 'Unknown domain'} / {tracks.map(track => track.title).join(', ')}</Copy>
      {lessons.map(lesson => <Button key={lesson.id} title={lesson.title} onPress={() => router.push({ pathname: '/lesson/[id]', params: { id: lesson.id } })} />)}
    </Card>)}</Grid>
    <Copy>Draft fixtures are shown only in this explicit demo preview, not as approved study material.</Copy>
  </Page>;
}
