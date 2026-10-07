import { Copy, EmptyState, Page } from '../../src/ui/shell.tsx';
export default function Exams() {
  return <Page title="Exams" subtitle="Profile-based practice with transparent scoring, timing and question-bank requirements.">
    <EmptyState title="No verified exam bank connected" detail="Exam profiles and question banks will be connected after the practice loop. Unknown vendor rules will remain unknown rather than becoming invented pass marks." />
    <Copy>No official certificate or passing guarantee is issued by this app.</Copy>
  </Page>;
}
