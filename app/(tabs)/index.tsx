import { Action, Card, Copy, EmptyState, Grid, Page } from '../../src/ui/shell.tsx';
export default function Home() {
  return <Page title="Keep your knowledge ready" subtitle="Build lasting understanding for developer and architect interviews and certification practice.">
    <EmptyState title="Your learning space is ready" detail="No learning catalogue is connected yet. Content will be authored later against the app's schema; draft or unverified material will not be presented as approved learning content." />
    <Grid>
      <Card title="Learn by domain"><Copy>Architecture and DDD, cloud, Java and Spring, and advanced AI.</Copy><Action label="Explore Learn" href="/(tabs)/learn" /></Card>
      <Card title="Practice with purpose"><Copy>Beginner, intermediate, advanced and expert sessions will use the same content contracts.</Copy><Action label="Open Practice" href="/(tabs)/practice" /></Card>
      <Card title="Prepare for exams"><Copy>Practice benchmarks remain separate from official certification scores.</Copy><Action label="Open Exams" href="/(tabs)/exams" /></Card>
      <Card title="See honest progress"><Copy>No fabricated streak, mastery percentage or probability of passing.</Copy><Action label="Open Progress" href="/(tabs)/progress" /></Card>
    </Grid>
  </Page>;
}
