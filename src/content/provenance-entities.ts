import type { TechnologyScope } from './learning-entities.ts';
export type ProvenanceIdentity = { id: string; revision: number; status: 'draft' | 'published' | 'deprecated' };
export type RightsRecord = { distribution: 'private' | 'redistributable' | 'unknown'; licence: string; evidenceRefs: readonly string[] };
export type SourceEntity = ProvenanceIdentity & {
  type: 'book' | 'official_doc' | 'specification' | 'paper' | 'own';
  title: string; locator: string; url: string | null; retrievedAt: string | null;
  version: string | null; rights: RightsRecord;
};
export type VerificationRecord = {
  state: 'not_checked' | 'verified' | 'verified_with_qualifiers' | 'conflicting' | 'obsolete';
  verifiedAt: string | null; reviewer: string | null;
};
export type ClaimEntity = ProvenanceIdentity & {
  sourceRef: string; locator: string; claim: string; scope: TechnologyScope;
  evidenceRefs: readonly string[]; verification: VerificationRecord; qualifiers: readonly string[];
  approvedDependentRevisions: readonly { entityId: string; revision: number }[]; reviewBy: string | null;
};
export type AssetBase = ProvenanceIdentity & {
  path: string; byteLength: number; hash: { algorithm: 'sha256'; value: string };
  rights: RightsRecord; sourceRefs: readonly string[];
};
export type ImageAsset = AssetBase & {
  kind: 'image'; mediaType: 'image/png' | 'image/jpeg' | 'image/webp';
  altText: string; caption?: string; width: number; height: number;
};
export type AudioAsset = AssetBase & {
  kind: 'audio'; mediaType: 'audio/mpeg' | 'audio/mp4' | 'audio/wav'; language: 'en' | 'fr';
  transcriptAssetId: string | null; timingAssetId: string | null; durationSeconds: number | null;
};
export type TextAsset = AssetBase & {
  kind: 'text'; mediaType: 'text/plain' | 'application/json';
  role: 'transcript' | 'timings' | 'reference'; language: 'en' | 'fr';
};
export type AssetEntity = ImageAsset | AudioAsset | TextAsset;
export type ProvenanceEntity = SourceEntity | ClaimEntity | AssetEntity;
// These are declared records. Neither types nor structural validation establish truth,
// licence authenticity, actual bytes, source authority, hash integrity or publication permission.
