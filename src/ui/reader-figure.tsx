import { useState } from 'react';
import { Button, Image, Modal, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import type { LessonBlock } from '../content/blocks.ts';
import { Copy, usePalette } from './shell.tsx';
export type RegisteredFigure = { source: ImageSourcePropType; width: number; height: number };
export type FigureResolver = (id: string) => RegisteredFigure | undefined;
type ReaderFigureProps = { block: Extract<LessonBlock, { type: 'figure' }>; resolveFigure?: FigureResolver; interactive?: boolean };
function localImage(source: ImageSourcePropType): boolean {
  if (typeof source === 'number') return true;
  if (Array.isArray(source)) return source.length > 0 && source.every(localImage);
  return typeof source.uri === 'string' && /^(file:|content:|asset:|data:image\/(png|jpeg|webp);base64,)/i.test(source.uri);
}
export function ReaderFigure({ block, resolveFigure, interactive = true }: ReaderFigureProps) {
  const colors = usePalette();
  const { width } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  let asset: RegisteredFigure | undefined;
  try {
    const candidate = resolveFigure?.(block.assetId);
    if (candidate && localImage(candidate.source)) asset = candidate;
  } catch { asset = undefined; }
  if (!asset) return <View style={{ padding: 16, borderWidth: 1, borderColor: colors.border, borderRadius: 12, gap: 8 }}>
    <Copy>Figure not connected: {block.altText}</Copy>{block.caption && <Copy>{block.caption}</Copy>}
  </View>;
  const imageWidth = Math.max(1, Math.min(640, width - 48));
  const ratio = Number.isFinite(asset.width) && asset.width > 0 && Number.isFinite(asset.height) && asset.height > 0 ? asset.height / asset.width : 1;
  return <View style={{ gap: 8 }}>
    <Pressable disabled={!interactive} accessibilityRole={interactive ? 'button' : 'image'} accessibilityLabel={block.altText} onPress={() => { setZoom(1); setOpen(true); }}>
      <Image source={asset.source} accessibilityLabel={block.altText} resizeMode="contain" style={{ width: imageWidth, height: imageWidth * ratio, alignSelf: 'center' }} />
    </Pressable>
    {interactive && <Copy>Tap the figure to open the zoom controls.</Copy>}{block.caption && <Copy>{block.caption}</Copy>}
    <Modal visible={open && interactive} animationType="fade" onRequestClose={() => setOpen(false)}>
      <View accessibilityViewIsModal style={{ flex: 1, backgroundColor: colors.background, padding: 24, paddingTop: 48, gap: 16 }}>
        <Copy>{block.altText}</Copy>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Button title="Zoom out" disabled={zoom <= 1} onPress={() => setZoom(value => Math.max(1, value - 0.5))} />
          <Button title="Zoom in" disabled={zoom >= 4} onPress={() => setZoom(value => Math.min(4, value + 0.5))} />
        </View>
        <ScrollView style={{ flex: 1 }}><ScrollView horizontal>
          <Image source={asset.source} accessibilityLabel={block.altText} resizeMode="contain" style={{ width: imageWidth * zoom, height: imageWidth * zoom * ratio }} />
        </ScrollView></ScrollView>
        <Button title="Close figure" onPress={() => setOpen(false)} />
      </View>
    </Modal>
  </View>;
}
