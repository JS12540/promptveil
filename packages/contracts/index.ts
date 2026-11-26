export type Action = 'mask' | 'block' | 'review';
export type Finding = { start: number; end: number; type: string; action: Action; evidenceCodes: string[] };
export type Result =
  | { status: 'ok'; findings: Finding[]; sanitizedText: string }
  | { status: 'blocked' | 'review' | 'error'; findings: Finding[] };
export type Review = Record<number, 'mask' | 'allow'>;
