import { Action, Card, Copy, Grid, Page } from '../../src/ui/shell.tsx';
import { DEMO_NOTICE, demoData } from '../../src/demo/catalogue.ts';
export default function Home() {
  return <Page title="Try the small demo" subtitle="The app UI and study logic come first. Real content authoring follows later.">
    <Copy>{DEMO_NOTICE}</Copy>
    <Grid>
      <Card title="Read the demo lesson"><Copy>One small chapter and lesson, loaded from JSON using the defined content shape.</Copy><Action label="Open demo lesson catalogue" href="/(tabs)/learn" /></Card>
      <Card title="Try demo practice"><Copy>{demoData.questions.length} original questions demonstrate single-choice and multi-select feedback. Results stay in this session only.</Copy><Action label="Start demo practice" href="/(tabs)/practice" /></Card>
      <Card title="Real learning later"><Copy>Architecture, DDD, cloud, Java/Spring and advanced AI materials will be authored after UI and logic are ready.</Copy></Card>
      <Card title="No fabricated progress"><Copy>This sandbox does not create mastery, streaks or exam-readiness evidence.</Copy><Action label="View progress placeholder" href="/(tabs)/progress" /></Card>
    </Grid>
  </Page>;
}
