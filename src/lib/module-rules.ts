import type { ModuleRecord, ModuleType } from './domain';

export function canBeFormalSource(record: ModuleRecord): boolean {
  if (record.moduleType === 'pdi') {
    return ['active', 'in_review', 'completed', 'archived'].includes(record.status);
  }
  return record.status === 'completed' || record.status === 'archived';
}

export function canCreateFrom(source: ModuleRecord, target: ModuleType): boolean {
  if (source.moduleType === 'marco_zero' && target === 'ninety_days') {
    return source.status === 'completed';
  }
  if (source.moduleType === 'ninety_days' && target === 'pdi') {
    return source.status === 'completed';
  }
  if (source.moduleType === 'competencies' && target === 'pdi') {
    return source.status === 'completed';
  }
  if (source.moduleType === 'pdi' && target === 'pdi') {
    return ['in_review', 'completed', 'archived'].includes(source.status);
  }
  return false;
}

export function eligibleForTalent(record: ModuleRecord): boolean {
  if (!canBeFormalSource(record)) return false;

  if (record.moduleType === 'feedback') {
    return record.payload.feedbackFlow === 'recognition'
      && record.payload.talentEligible === true
      && record.payload.recognitionEvidenceReady === true;
  }

  return ['marco_zero', 'ninety_days', 'competencies', 'pdi'].includes(record.moduleType);
}
