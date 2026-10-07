import { Copy, EmptyState, Page } from '../../src/ui/shell.tsx';
export default function Progress() {
  return <Page title="Progress" subtitle="Track completion, coverage, recent performance, delayed recall and interview rehearsal separately.">
    <EmptyState title="Assessment history is not connected yet" detail="This is an honest empty UI state, not a computed score. The upcoming persistence and evidence tasks will connect objective events and subjective rubrics to these views." />
    <Copy>The old demo's stored events are not promoted into learning evidence.</Copy>
  </Page>;
}
