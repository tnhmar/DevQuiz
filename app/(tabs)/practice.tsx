import { Copy, EmptyState, Page } from '../../src/ui/shell.tsx';
export default function Practice() {
  return <Page title="Practice" subtitle="Focus on a domain, level and skill: recall, understanding, application, diagnosis or design judgement.">
    <EmptyState title="No question bank connected" detail="Single-choice, multi-select, true/false and open-response contracts are defined. Question selection and session controls are the next implementation steps; no quiz starts from placeholder data." />
    <Copy>Hints, retries and subjective rubrics will not inflate objective evidence.</Copy>
  </Page>;
}
