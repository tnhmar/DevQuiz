import { useState } from 'react';
import { Alert, Button, Image, Linking, Modal, Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import type { InlineContent, LessonBlock } from '../content/blocks.ts';
import type { Explanation } from '../content/questions.ts';
import { Copy, usePalette } from './shell.tsx';
type FigureAsset = { source: ImageSourcePropType; width: number; height: number };
type TermEntry = { term: string; definition: Explanation };
type ReaderProps = {
  blocks: readonly LessonBlock[]; interactive?: boolean;
  lookupTerm?: (id: string) => TermEntry | undefined;
  resolveFigure?: (id: string) => FigureAsset | undefined;
};
const mono = Platform.select({ ios: 'Menlo', default: 'monospace' });
function inlineText(items: readonly InlineContent[]) {
  return items.map(item => item.type === 'text' || item.type === 'emphasis' ? item.text : item.label).join('');
}
function plainExplanation(value: Explanation): string {
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
function localImage(source: ImageSourcePropType): boolean {
  if (typeof source === 'number') return true;
  if (Array.isArray(source)) return source.length > 0 && source.every(localImage);
  return typeof source.uri === 'string' && /^(file:|content:|asset:|data:image\/(png|jpeg|webp);base64,)/i.test(source.uri);
}
function openReference(url: string) {
  if (!/^https?:\/\/\S+$/i.test(url)) {
    Alert.alert('Reference unavailable', 'Only HTTP/HTTPS references can be opened.');
    return;
  }
  Alert.alert('Open external reference?', url, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Open', onPress: () => { void Linking.openURL(url).catch(() => Alert.alert('Could not open reference')); } }
  ]);
}
export function ContentRenderer({ blocks, lookupTerm, resolveFigure, interactive = true }: ReaderProps) {
  const colors = usePalette();
  const { width } = useWindowDimensions();
  const [term, setTerm] = useState<{ title: string; definition: string | null } | null>(null);
  const [figure, setFigure] = useState<(FigureAsset & { altText: string }) | null>(null);
  const [zoom, setZoom] = useState(1);
  const imageWidth = Math.max(1, Math.min(640, width - 48));
  function showTerm(id: string) {
    try {
      const entry = lookupTerm?.(id);
      setTerm({ title: entry?.term ?? id, definition: entry ? plainExplanation(entry.definition) : null });
    } catch {
      setTerm({ title: id, definition: null });
    }
  }
  function inline(items: readonly InlineContent[]) {
    return items.map((item, index) => {
      if (item.type === 'text') return <Text key={index}>{item.text}</Text>;
      if (item.type === 'emphasis') return <Text key={index} style={{ fontWeight: item.style === 'bold' ? '700' : '400', fontStyle: item.style === 'italic' ? 'italic' : 'normal' }}>{item.text}</Text>;
      const active = interactive;
      return <Text key={index} accessibilityRole={active ? item.type === 'link' ? 'link' : 'button' : undefined} onPress={active ? () => item.type === 'link' ? openReference(item.url) : showTerm(item.termId) : undefined} style={{ color: active ? colors.accent : colors.text, textDecorationLine: active ? 'underline' : 'none' }}>{item.label}</Text>;
    });
  }
  const bodyStyle = { color: colors.text, fontSize: 17, lineHeight: 28 };
  return <View style={{ gap: 18 }}>
    {blocks.map((block, index) => {
      if (block.type === 'paragraph') return <Text key={index} style={bodyStyle}>{inline(block.content)}</Text>;
      if (block.type === 'heading') return <Text key={index} accessibilityRole="header" style={{ ...bodyStyle, fontSize: 30 - block.level * 2, fontWeight: '700' }}>{inline(block.content)}</Text>;
      if (block.type === 'list') return <View key={index} style={{ gap: 8 }}>{block.items.map((item, position) => <View key={position} style={{ flexDirection: 'row', gap: 10 }}>
        <Text style={bodyStyle}>{block.ordered ? (position + 1) + '.' : '•'}</Text>
        <Text style={{ ...bodyStyle, flex: 1 }}>{inline(item)}</Text>
      </View>)}</View>;
      if (block.type === 'code') return <View key={index} style={{ backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 8 }}>
        <Copy>{block.language} / code is displayed, never executed</Copy>
        <ScrollView horizontal><Text selectable style={{ color: colors.text, fontFamily: mono, fontSize: 15, lineHeight: 24 }}>{block.text}</Text></ScrollView>
      </View>;
      if (block.type === 'table') return <View key={index} style={{ gap: 10 }}>
        {block.rows.some(row => row.length !== block.columns.length) ? <Copy>Table layout is inconsistent. Text alternative: {block.alternativeText}</Copy> : <ScrollView horizontal>
          <View>
            <View style={{ flexDirection: 'row' }}>{block.columns.map((column, position) => <Text key={position} style={{ ...bodyStyle, width: 180, padding: 12, fontWeight: '700', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}>{column}</Text>)}</View>
            {block.rows.map((row, rowIndex) => <View key={rowIndex} style={{ flexDirection: 'row' }}>{row.map((cell, cellIndex) => <Text key={cellIndex} style={{ ...bodyStyle, width: 180, padding: 12, borderWidth: 1, borderColor: colors.border }}>{cell}</Text>)}</View>)}
          </View>
        </ScrollView>}
        <Copy>Text alternative: {block.alternativeText}</Copy>
      </View>;
      if (block.type === 'callout') return <View key={index} style={{ padding: 16, gap: 8, borderLeftWidth: 4, borderLeftColor: colors.accent, backgroundColor: colors.card, borderRadius: 12 }}>
        <Text style={{ ...bodyStyle, fontWeight: '700' }}>{block.tone.toUpperCase()}{block.title ? ': ' + block.title : ''}</Text>
        <Text style={bodyStyle}>{inline(block.content)}</Text>
      </View>;
      if (block.type === 'formula') return <View key={index} accessible accessibilityLabel={block.alternativeText} style={{ gap: 8 }}>
        <Text selectable style={{ ...bodyStyle, fontFamily: mono }}>{block.text}</Text>
        <Copy>{block.alternativeText}</Copy>
      </View>;
      if (block.type === 'figure') {
        let asset: FigureAsset | undefined;
        try { asset = resolveFigure?.(block.assetId); } catch { asset = undefined; }
        if (!asset || !localImage(asset.source)) return <View key={index} style={{ padding: 16, borderWidth: 1, borderColor: colors.border, borderRadius: 12, gap: 8 }}>
          <Copy>Figure not connected: {block.altText}</Copy>{block.caption && <Copy>{block.caption}</Copy>}
        </View>;
        const resolved = asset;
        const ratio = Number.isFinite(resolved.width) && resolved.width > 0 && Number.isFinite(resolved.height) && resolved.height > 0 ? resolved.height / resolved.width : 1;
        return <View key={index} style={{ gap: 8 }}>
          <Pressable disabled={!interactive} accessibilityRole={interactive ? 'button' : 'image'} accessibilityLabel={block.altText} onPress={() => { setZoom(1); setFigure({ ...resolved, altText: block.altText }); }}>
            <Image source={resolved.source} accessibilityLabel={block.altText} resizeMode="contain" style={{ width: imageWidth, height: imageWidth * ratio, alignSelf: 'center' }} />
          </Pressable>
          {interactive && <Copy>Tap the figure to open the zoom controls.</Copy>}{block.caption && <Copy>{block.caption}</Copy>}
        </View>;
      }
      return <Copy key={index}>Unsupported content block.</Copy>;
    })}
    <Modal visible={term !== null} transparent animationType="fade" onRequestClose={() => setTerm(null)}>
      <View accessibilityViewIsModal style={{ flex: 1, backgroundColor: colors.background, padding: 24, paddingTop: 48, gap: 16 }}>
        <Text accessibilityRole="header" style={{ ...bodyStyle, fontSize: 24, fontWeight: '700' }}>{term?.title ?? 'Term'}</Text>
        <ScrollView><Text selectable style={bodyStyle}>{term?.definition ?? 'This term is not in a connected glossary yet.'}</Text></ScrollView>
        <Button title="Close definition" onPress={() => setTerm(null)} />
      </View>
    </Modal>
    <Modal visible={figure !== null} animationType="fade" onRequestClose={() => setFigure(null)}>
      <View accessibilityViewIsModal style={{ flex: 1, backgroundColor: colors.background, padding: 24, paddingTop: 48, gap: 16 }}>
        <Copy>{figure?.altText ?? 'Figure'}</Copy>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Button title="Zoom out" disabled={zoom <= 1} onPress={() => setZoom(value => Math.max(1, value - 0.5))} />
          <Button title="Zoom in" disabled={zoom >= 4} onPress={() => setZoom(value => Math.min(4, value + 0.5))} />
        </View>
        <ScrollView style={{ flex: 1 }}><ScrollView horizontal>{figure && <Image source={figure.source} accessibilityLabel={figure.altText} resizeMode="contain" style={{ width: imageWidth * zoom, height: imageWidth * zoom * (Number.isFinite(figure.width) && figure.width > 0 && Number.isFinite(figure.height) && figure.height > 0 ? figure.height / figure.width : 1) }} />}</ScrollView></ScrollView>
        <Button title="Close figure" onPress={() => setFigure(null)} />
      </View>
    </Modal>
  </View>;
}
