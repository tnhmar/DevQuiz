import { Alert, Linking, Text } from 'react-native';
import type { InlineContent } from '../content/blocks.ts';
import type { Explanation } from '../content/questions.ts';
import { usePalette } from './shell.tsx';
export function inlineText(content: readonly InlineContent[]): string {
  return content.map(item => item.type === 'text' || item.type === 'emphasis' ? item.text : item.label).join('');
}
export function plainExplanation(value: Explanation): string {
  if (typeof value === 'string') return value;
  return value.map(block => {
    if (block.type === 'paragraph' || block.type === 'heading' || block.type === 'callout') return inlineText(block.content);
    if (block.type === 'list') return block.items.map(inlineText).join('\n');
    if (block.type === 'table') return block.alternativeText;
    if (block.type === 'figure') return block.altText;
    if (block.type === 'formula') return block.alternativeText;
    return block.text;
  }).join('\n\n');
}
export function openReference(url: string): void {
  if (!/^https?:\/\/\S+$/i.test(url)) {
    Alert.alert('Reference unavailable', 'Only HTTP/HTTPS references can be opened.');
    return;
  }
  Alert.alert('Open external reference?', url, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Open', onPress: () => { void Linking.openURL(url).catch(() => Alert.alert('Could not open reference')); } }
  ]);
}
type InlineRunProps = {
  content: readonly InlineContent[];
  interactive?: boolean;
  onTerm?: (id: string) => void;
};
export function InlineRun({ content, interactive = true, onTerm }: InlineRunProps) {
  const colors = usePalette();
  return <>{content.map((item, index) => {
    if (item.type === 'text') return <Text key={index}>{item.text}</Text>;
    if (item.type === 'emphasis') return <Text key={index} style={{ fontWeight: item.style === 'bold' ? '700' : '400', fontStyle: item.style === 'italic' ? 'italic' : 'normal' }}>{item.text}</Text>;
    if (item.type === 'link') return <Text key={index} accessibilityRole={interactive ? 'link' : undefined} onPress={interactive ? () => openReference(item.url) : undefined} style={{ color: interactive ? colors.accent : colors.text, textDecorationLine: interactive ? 'underline' : 'none' }}>{item.label}</Text>;
    const active = interactive && onTerm !== undefined;
    return <Text key={index} accessibilityRole={active ? 'button' : undefined} onPress={active ? () => onTerm?.(item.termId) : undefined} style={{ color: active ? colors.accent : colors.text, textDecorationLine: active ? 'underline' : 'none' }}>{item.label}</Text>;
  })}</>;
}
