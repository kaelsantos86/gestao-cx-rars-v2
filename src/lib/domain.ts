export type ModuleType =
  | 'marco_zero'
  | 'ninety_days'
  | 'competencies'
  | 'pdi'
  | 'feedback'
  | 'talent';

export type RecordStatus =
  | 'draft'
  | 'awaiting_participant'
  | 'participant_submitted'
  | 'in_conversation'
  | 'active'
  | 'in_review'
  | 'completed'
  | 'archived'
  | 'cancelled';

export type FeedbackKind = 'orientation' | 'recognition' | 'promotion';
export type ProfessionalMoment = 'entry' | 'consolidation' | 'established' | 'transition';

export interface Employee {
  id: string;
  displayName: string;
  currentRole?: string;
  currentSquad?: string;
  photoPath?: string;
  professionalMoment: ProfessionalMoment;
  v2EntryModule: ModuleType;
  journeyNote?: string;
  active: boolean;
}

export interface ModuleRecord<TPayload = Record<string, unknown>> {
  id: string;
  employeeId: string;
  managerId: string;
  moduleType: ModuleType;
  status: RecordStatus;
  cycleLabel?: string;
  occurredOn?: string;
  participantLockedAt?: string;
  completedAt?: string;
  payload: TPayload;
  importedFromLegacy: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RecordDependency {
  sourceRecordId: string;
  targetRecordId: string;
  relationType:
    | 'source_for'
    | 'previous_cycle'
    | 'evidence_for'
    | 'derived_from';
}
