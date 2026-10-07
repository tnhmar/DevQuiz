import { Copy, EmptyState, Page } from '../../src/ui/shell.tsx';
export default function Learn() {
  return <Page title="Learn" subtitle="Domain → track → chapter → lesson. Concepts connect what you read to what you practise.">
    <EmptyState title="No lessons connected" detail="The next UI task connects typed domains, tracks, chapters and lessons. Code, tables, figures and callouts will use the defined lesson-block contract." />
    <Copy>Reading completion and assessment evidence will remain separate.</Copy>
  </Page>;
}
