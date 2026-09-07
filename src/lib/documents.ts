/**
 * The document types a jobseeker can hold and a job can require. Single source
 * of truth shared by the CV document manager, the job post form, the job detail
 * "documents required" list, and the apply checklist. `key` maps into the `cv`
 * i18n namespace for a localized label.
 */
export const SEEKER_DOC_TYPES = [
  'CV',
  'COVER_LETTER',
  'CERTIFICATE',
  'ID_DOCUMENT',
  'DRIVING_LICENSE',
  'OTHER',
] as const;

export type SeekerDocType = (typeof SEEKER_DOC_TYPES)[number];

export const DOC_TYPE_KEY: Record<SeekerDocType, string> = {
  CV: 'typeCv',
  COVER_LETTER: 'typeCoverLetter',
  CERTIFICATE: 'typeCertificate',
  ID_DOCUMENT: 'typeId',
  DRIVING_LICENSE: 'typeDrivingLicense',
  OTHER: 'typeOther',
};

export function docTypeKey(type: string): string {
  return DOC_TYPE_KEY[type as SeekerDocType] ?? 'typeOther';
}
