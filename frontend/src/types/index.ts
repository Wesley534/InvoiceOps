export type TaskStatus = 
  | 'queued' 
  | 'running' 
  | 'needs_review' 
  | 'completed' 
  | 'failed' 
  | 'partial_success';

export type ConfidenceLevel = 'high' | 'medium' | 'needs_review';

export interface WorkflowStep {
  id: string;
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'warning' | 'failed';
  statusMessage: string;
  timestamp?: string;
  durationMs?: number;
  details?: string;
}

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadDate: string;
  summary?: string;
}

export interface SourceDocument {
  id: string;
  title: string;
  type: 'pdf' | 'docx' | 'csv' | 'txt' | 'image';
  relevanceScore: number;
  relevantExcerpt: string;
  pageOrSection?: string;
}

export interface ExplainabilityDetails {
  question: string;
  summary: string;
  informationConsidered: string[];
  rulesAndChecksApplied: string[];
  assumptionsMade: string[];
  uncertaintyOrCaveats?: string[];
}

export interface SystemActionLog {
  title: string;
  description: string;
  iconName?: string;
}

export interface TaskRun {
  id: string;
  title: string;
  description: string;
  category: string;
  createdAt: string;
  completedAt?: string;
  status: TaskStatus;
  estimatedDuration: string;
  actualDuration?: string;
  confidence: ConfidenceLevel;
  confidenceReason?: string;
  files: UploadedFile[];
  steps: WorkflowStep[];
  currentStepIndex: number;
  
  // Human approval
  requiresApproval: boolean;
  approvalStatus?: 'pending' | 'approved' | 'changes_requested' | 'rejected';
  approvalDecisionNote?: string;
  approvalWarning?: string;
  externalActionWarning?: string;
  
  // Results
  resultTitle?: string;
  resultSummary?: string;
  resultContent?: string;
  resultItems?: { label: string; value: string; badge?: string }[];
  
  // System reflection
  systemActions: SystemActionLog[];
  humanInvolvementText: string;
  sources: SourceDocument[];
  explainability: ExplainabilityDetails;
  
  // Error handling
  errorReason?: string;
  errorRecoveryAdvice?: string;
  failedStepName?: string;
  canRetryVerification?: boolean;
}

export interface TestCase {
  id: string;
  code: string;
  title: string;
  category: string;
  inputDescription: string;
  expectedBehavior: string;
  actualResult: string;
  status: 'PASS' | 'FAIL';
  executionTime: string;
  failureCategory?: 'Validation' | 'Extraction' | 'Policy Constraint' | 'Parsing' | 'Ambiguity';
  failureReason?: string;
  rootCause?: string;
  resolution?: string;
}

export interface EvaluationMetrics {
  overallPassRate: number;
  outputQuality: number;
  failuresDetected: number;
  manualWorkReduction: number;
  averageProcessingTime: string;
  humanInterventionRate: number;
  totalEvaluatedCases: number;
}
