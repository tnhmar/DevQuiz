import { useState } from 'react';
import { Button, Modal, Platform, ScrollView, Text, View } from 'react-native';
import type { LessonBlock } from '../content/blocks.ts';
import type { Explanation } from '../content/questions.ts';
import { Copy, usePalette } from './shell.tsx';
import { InlineRun, plainExplanation } from './reader-text.tsx';
import { ReaderFigure } from './reader-figure.tsx';
import type { FigureResolver } from './reader-figure.tsx';
type TermEntry = { term: string; definition: Explanation };
type ReaderProps = {
  blocks: readonly LessonBlock[]; interactive?: boolean;
  lookupTerm?: (id: string) => TermEntry | undefined;
  resolveFigure?: FigureResolver;
};
const mono = Platform.select({ ios: 'Menlo', default: 'monospace' });
export function ContentRenderer({ blocks, lookupTerm, resolveFigure, interactive = true }: ReaderProps) {
  const colors = usePalette();
  const [term, setTerm] = useState<{ title: string; definition: string | null } | null>(null);
  function showTerm(id: string) {
    try {
      const entry = lookupTerm?.(id);
      setTerm({ title: entry?.term ?? id, definition: entry ? plainExplanation(entry.definition) : null });
    } catch { setTerm({ title: id, definition: null }); }
  }
  const bodyStyle = { color: colors.text, fontSize: 17, lineHeight: 28 };
  return <View style={{ gap: 18 }}>
    {blocks.map((block, index) => {
      if (block.type === 'paragraph') return <Text key={index} style={bodyStyle}><InlineRun content={block.content} interactive={interactive} onTerm={showTerm} /></Text>;
      if (block.type === 'heading') return <Text key={index} accessibilityRole="header" style={{ ...bodyStyle, fontSize: 30 - block.level * 2, fontWeight: '700' }}><InlineRun content={block.content} interactive={interactive} onTerm={showTerm} /></Text>;
      if (block.type === 'list') return <View key={index} style={{ gap: 8 }}>{block.items.map((item, position) => <View key={position} style={{ flexDirection: 'row', gap: 10 }}>
        <Text style={bodyStyle}>{block.ordered ? (position + 1) + '.' : '•'}</Text>
        <Text style={{ ...bodyStyle, flex: 1 }}><InlineRun content={item} interactive={interactive} onTerm={showTerm} /></Text>
      </View>)}</View>;
      if (block.type === 'code') return <View key={index} style={{ backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 8 }}>
        <Copy>{block.language} / code is displayed, never executed</Copy>
        <ScrollView horizontal><Text selectable style={{ color: colors.text, fontFamily: mono, fontSize: 15, lineHeight: 24 }}>{block.text}</Text></ScrollView>
      </View>;
      if (block.type === 'table') return <View key={index} style={{ gap: 10 }}>
        {block.rows.some(row => row.length !== block.columns.length) ? <Copy>Table layout is inconsistent; the text alternative is shown below.</Copy> : <ScrollView horizontal>
          <View>
            <View style={{ flexDirection: 'row' }}>{block.columns.map((column, position) => <Text key={position} style={{ ...bodyStyle, width: 180, padding: 12, fontWeight: '700', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}>{column}</Text>)}</View>
            {block.rows.map((row, rowIndex) => <View key={rowIndex} style={{ flexDirection: 'row' }}>{row.map((cell, cellIndex) => <Text key={cellIndex} style={{ ...bodyStyle, width: 180, padding: 12, borderWidth: 1, borderColor: colors.border }}>{cell}</Text>)}</View>)}
          </View>
        </ScrollView>}
        <Copy>Text alternative: {block.alternativeText}</Copy>
      </View>;
      if (block.type === 'callout') return <View key={index} style={{ padding: 16, gap: 8, borderLeftWidth: 4, borderLeftColor: colors.accent, backgroundColor: colors.card, borderRadius: 12 }}>
        <Text style={{ ...bodyStyle, fontWeight: '700' }}>{block.tone.toUpperCase()}{block.title ? ': ' + block.title : ''}</Text>
        <Text style={bodyStyle}><InlineRun content={block.content} interactive={interactive} onTerm={showTerm} /></Text>
      </View>;
      if (block.type === 'formula') return <View key={index} accessible accessibilityLabel={block.alternativeText} style={{ gap: 8 }}>
        <Text selectable style={{ ...bodyStyle, fontFamily: mono }}>{block.text}</Text><Copy>{block.alternativeText}</Copy>
      </View>;
      if (block.type === 'figure') return <ReaderFigure key={'figure:' + index + ':' + block.assetId} block={block} resolveFigure={resolveFigure} interactive={interactive} />;
      return <Copy key={index}>Unsupported content block.</Copy>;
    })}
    <Modal visible={term !== null && interactive} transparent animationType="fade" onRequestClose={() => setTerm(null)}>
      <View accessibilityViewIsModal style={{ flex: 1, backgroundColor: colors.background, padding: 24, paddingTop: 48, gap: 16 }}>
        <Text accessibilityRole="header" style={{ ...bodyStyle, fontSize: 24, fontWeight: '700' }}>{term?.title ?? 'Term'}</Text>
        <ScrollView><Text selectable style={bodyStyle}>{term?.definition ?? 'This term is not in a connected glossary yet.'}</Text></ScrollView>
        <Button title="Close definition" onPress={() => setTerm(null)} />
      </View>
    </Modal>
  </View>;
}
