import { TaskRun, TestCase, EvaluationMetrics } from '../types';

export const INITIAL_RUNS: TaskRun[] = [
  {
    id: 'tsk-001',
    title: 'Review and approve vendor invoice from Pacific Hardware',
    description: 'Verify invoice #MT-2026-0847 against purchase order PO-1001 and delivery receipts before payment authorization.',
    category: 'Finance & Invoicing',
    createdAt: 'Today, 09:15 AM',
    status: 'needs_review',
    estimatedDuration: 'About 1–2 minutes',
    actualDuration: '1m 12s',
    confidence: 'needs_review',
    confidenceReason: 'The invoice unit price ($3,520) exceeds the authorized purchase order price ($3,200) by 10%.',
    files: [
      { id: 'f-1', name: 'Invoice_MT-2026-0847.pdf', size: 184000, type: 'application/pdf', uploadDate: 'Today' },
      { id: 'f-2', name: 'PO-1001_Authorized_Purchase_Order.pdf', size: 142000, type: 'application/pdf', uploadDate: 'Today' },
      { id: 'f-3', name: 'Goods_Receipt_GRN-2026-0451.csv', size: 48000, type: 'text/csv', uploadDate: 'Today' }
    ],
    steps: [
      { id: 's1', name: 'Understanding your request', status: 'completed', statusMessage: 'Checked invoice parameters and matched purchase order numbers.' },
      { id: 's2', name: 'Reviewing information', status: 'completed', statusMessage: 'Read 3 documents and extracted line items, tax numbers, and dates.' },
      { id: 's3', name: 'Cross-checking against master records', status: 'completed', statusMessage: 'Vendor is approved in directory. Delivery receipt confirms 10 items received.' },
      { id: 's4', name: 'Checking the result', status: 'warning', statusMessage: 'Flagged 1 price discrepancy for your review.' },
      { id: 's5', name: 'Ready for review', status: 'in_progress', statusMessage: 'Waiting for your approval before continuing.' }
    ],
    currentStepIndex: 4,
    requiresApproval: true,
    approvalStatus: 'pending',
    approvalWarning: 'Authorizing this invoice will commit $35,200.00 to Pacific Hardware Supplies.',
    externalActionWarning: 'If approved, this will automatically forward payment instructions to Accounts Payable.',
    resultTitle: 'Vendor Invoice Pre-Payment Review',
    resultSummary: 'Invoice matched approved vendor and confirmed delivery receipt. However, the total invoice amount of $35,200 is $3,200 higher than Purchase Order PO-1001 ($32,000).',
    resultContent: `### Summary of Findings
- **Vendor Name**: Pacific Trading & Hardware Supplies Inc. (Active & Approved)
- **Invoice Number**: MT-2026-0847 | Date: August 15, 2026
- **Matched PO**: PO-1001 (Original authorization: $32,000.00)
- **Invoice Total**: $35,200.00 USD (Includes $3,200.00 freight & expedited delivery charge)
- **Delivery Confirmation**: All 10 units of Dell PowerEdge R750 received on August 12, 2026 (GRN-2026-0451).

### Discrepancy Flag
The vendor added an unexpected line item: **Expedited Freight Surcharge of $3,200.00** which was not present in the original purchase order agreement.

### Suggested Action
Verify whether your logistics department authorized expedited freight before approving this invoice.`,
    resultItems: [
      { label: 'Vendor Status', value: 'Approved (V-002)', badge: 'Verified' },
      { label: 'Units Delivered', value: '10 of 10 confirmed', badge: 'Matched' },
      { label: 'Variance', value: '+$3,200 (+10.0%)', badge: 'Review Required' }
    ],
    systemActions: [
      { title: 'Read 3 documents', description: 'Extracted line items, terms, and shipping addresses.' },
      { title: 'Cross-checked 4 master databases', description: 'Validated vendor registration, PO status, warehouse receipts, and duplicate invoice logs.' },
      { title: 'Applied 11 operational safety rules', description: 'Checked vendor status, currency, arithmetic, tax calculation, and price variance.' },
      { title: 'Paused for human judgment', description: 'Halted automatic payment route due to price mismatch.' }
    ],
    humanInvolvementText: '1 human approval required before payment dispatch',
    sources: [
      {
        id: 'src-1',
        title: 'Invoice_MT-2026-0847.pdf',
        type: 'pdf',
        relevanceScore: 98,
        relevantExcerpt: 'Line 1: 10x Server Rack R750 @ $3,200 = $32,000. Line 2: Expedited Priority Freight: $3,200. Total: $35,200.00.',
        pageOrSection: 'Page 1, Pricing Table'
      },
      {
        id: 'src-2',
        title: 'PO-1001_Authorized_Purchase_Order.pdf',
        type: 'pdf',
        relevanceScore: 94,
        relevantExcerpt: 'Total Authorized Amount: $32,000.00 USD. Terms: Net 30. Freight: Standard Included.',
        pageOrSection: 'Section 4: Financial Terms'
      },
      {
        id: 'src-3',
        title: 'Goods_Receipt_GRN-2026-0451.csv',
        type: 'csv',
        relevanceScore: 89,
        relevantExcerpt: 'Item: Dell PowerEdge R750. Quantity Received: 10. Condition: Inspected & Accepted.',
        pageOrSection: 'Row 14'
      }
    ],
    explainability: {
      question: 'Why did the system flag this invoice for review?',
      summary: 'The vendor and goods delivery are legitimate, but the total invoice exceeds the purchase order limit by 10%.',
      informationConsidered: [
        'Line item totals from Invoice MT-2026-0847',
        'Authorized spending ceiling from Purchase Order PO-1001',
        'Warehouse receiving docket GRN-2026-0451 signed on August 12',
        'Historical vendor profile for Pacific Trading Company'
      ],
      rulesAndChecksApplied: [
        'Rule 1: Vendor active & approved in procurement master register (PASSED)',
        'Rule 2: Currency matches purchase order currency USD (PASSED)',
        'Rule 3: Delivered quantity matches invoiced quantity (PASSED: 10 / 10)',
        'Rule 4: Total invoice within 1.0% variance of approved purchase order (FAILED: +10.0% variance)',
        'Rule 5: No duplicate invoice number in past 12 months (PASSED)'
      ],
      assumptionsMade: [
        'The delivered hardware meets technical specifications based on warehouse sign-off.',
        'No oral agreement for expedited freight has been recorded in the central procurement database yet.'
      ],
      uncertaintyOrCaveats: [
        'A team member may have verbally authorized emergency freight without updating the purchase order.'
      ]
    }
  },
  {
    id: 'tsk-002',
    title: 'Create campaign brief from latest market research',
    description: 'Synthesize Q3 consumer survey findings, competitor moves, and product specs into an executive campaign launch brief.',
    category: 'Marketing Operations',
    createdAt: 'Today, 08:30 AM',
    completedAt: 'Today, 08:32 AM',
    status: 'completed',
    estimatedDuration: 'About 1–2 minutes',
    actualDuration: '1m 45s',
    confidence: 'high',
    confidenceReason: 'All 4 input documents corroborated market figures and key user demographics without conflict.',
    files: [
      { id: 'f-4', name: 'Q3_Market_Research_Report.pdf', size: 520000, type: 'application/pdf', uploadDate: 'Today' },
      { id: 'f-5', name: 'Customer_Feedback_Survey.csv', size: 198000, type: 'text/csv', uploadDate: 'Today' },
      { id: 'f-6', name: 'Product_Specification_V2.docx', size: 310000, type: 'docx', uploadDate: 'Today' }
    ],
    steps: [
      { id: 's1', name: 'Understanding your request', status: 'completed', statusMessage: 'Identified objective: Q3 product launch campaign brief.' },
      { id: 's2', name: 'Reviewing information', status: 'completed', statusMessage: 'Analyzed 52 survey points, 3 competitor benchmarks, and 6 core features.' },
      { id: 's3', name: 'Creating the draft', status: 'completed', statusMessage: 'Generated executive summary, positioning pillars, and target audience persona.' },
      { id: 's4', name: 'Checking the result', status: 'completed', statusMessage: 'Verified demographic claims against raw survey tables.' },
      { id: 's5', name: 'Ready for review', status: 'completed', statusMessage: 'Brief finalized and saved to your project.' }
    ],
    currentStepIndex: 5,
    requiresApproval: false,
    approvalStatus: 'approved',
    resultTitle: 'Q3 Product Launch Campaign Brief',
    resultSummary: 'A ready-to-publish campaign brief outlining target audiences, key message pillars, competitive differentiation, and 30-day rollout milestones.',
    resultContent: `### Campaign Overview
- **Campaign Name**: "Clarity in Motion"
- **Target Audience**: Mid-market operations leads and business team managers seeking automated workflows without technical complexity.
- **Primary Value Proposition**: "Run complex operational processes in plain language—with full human oversight and zero code."

### Strategic Message Pillars
1. **Confidence Without Complexity**: You do not need to understand APIs or infrastructure to automate your team's weekly work.
2. **Always in Control**: Clear human review gates before anything is sent or committed.
3. **Instant Transparency**: Every number and recommendation points directly back to its source document.

### Recommended 30-Day Channel Strategy
- **Direct Operational Outreach**: Share 2-minute workflow case studies with existing account managers.
- **Product Walkthroughs**: Visual walkthroughs demonstrating the 3-step task flow (Describe -> Review -> Deliver).
- **Customer Benchmark Report**: Highlight 42% average time reduction across routine verification tasks.`,
    resultItems: [
      { label: 'Audience Focus', value: 'Operations & Business Teams', badge: 'High Intent' },
      { label: 'Primary Angle', value: 'Human-Governed Automation', badge: 'Differentiated' },
      { label: 'Sources Cited', value: '3 verified documents', badge: '100% Corroborated' }
    ],
    systemActions: [
      { title: 'Reviewed 3 documents', description: 'Read market research report, customer survey rows, and product specs.' },
      { title: 'Compared 42 customer sentiment trends', description: 'Extracted top recurring user friction points.' },
      { title: 'Created 1 complete campaign brief', description: 'Organized into executive summary, audience profiles, and 30-day plan.' },
      { title: 'Completed without intervention', description: 'High confidence on all extracted facts.' }
    ],
    humanInvolvementText: 'No manual intervention required',
    sources: [
      {
        id: 'src-4',
        title: 'Q3_Market_Research_Report.pdf',
        type: 'pdf',
        relevanceScore: 96,
        relevantExcerpt: '72% of mid-market operations leads cite fear of unmonitored AI errors as their top reason for hesitating on workflow tools.',
        pageOrSection: 'Executive Summary, Page 3'
      },
      {
        id: 'src-5',
        title: 'Customer_Feedback_Survey.csv',
        type: 'csv',
        relevanceScore: 92,
        relevantExcerpt: 'Top requested capability: "I need to see exactly where the number came from and approve it before anything goes to my manager."',
        pageOrSection: 'Response #384'
      }
    ],
    explainability: {
      question: 'Why did the system structure the brief around human control?',
      summary: 'Customer survey data revealed that trust and review controls are the single biggest adoption factor for operations teams.',
      informationConsidered: [
        'Survey responses from 420 operations professionals',
        'Competitor analysis showing over-technical developer tools',
        'Company product capability roadmap for Q3'
      ],
      rulesAndChecksApplied: [
        'Marketing tone guidelines applied (no technical jargon, no hype words)',
        'Audience demographic data cross-verified with Q2 pipeline report',
        'All performance claims checked against product documentation'
      ],
      assumptionsMade: [
        'Target launch timeframe remains scheduled for late September.',
        'Initial focus is North American and European business operations departments.'
      ]
    }
  },
  {
    id: 'tsk-003',
    title: 'Customer survey sentiment report (Partial completion demo)',
    description: 'Analyze 1,200 customer support transcripts and compile weekly customer satisfaction drivers.',
    category: 'Customer Experience',
    createdAt: 'Yesterday, 04:10 PM',
    status: 'partial_success',
    estimatedDuration: 'About 2 minutes',
    actualDuration: '1m 20s',
    confidence: 'medium',
    confidenceReason: '4 out of 5 data batches were processed cleanly. Batch 5 could not be retrieved from the archive service.',
    files: [
      { id: 'f-7', name: 'Survey_Responses_Batches_1-4.csv', size: 450000, type: 'text/csv', uploadDate: 'Yesterday' },
      { id: 'f-8', name: 'Support_Tags_Catalog.txt', size: 32000, type: 'text/plain', uploadDate: 'Yesterday' }
    ],
    steps: [
      { id: 's1', name: 'Understanding your request', status: 'completed', statusMessage: 'Identified satisfaction trends across support channels.' },
      { id: 's2', name: 'Reviewing information', status: 'completed', statusMessage: 'Parsed 960 responses from Batches 1 through 4.' },
      { id: 's3', name: 'Creating the draft', status: 'completed', statusMessage: 'Summarized top 3 satisfaction drivers and 2 pain points.' },
      { id: 's4', name: 'Checking the result', status: 'warning', statusMessage: 'Verification could not reach the secondary archive service.' },
      { id: 's5', name: 'Ready for review', status: 'pending', statusMessage: 'Partial results ready for your inspection.' }
    ],
    currentStepIndex: 3,
    requiresApproval: true,
    approvalStatus: 'pending',
    errorReason: 'The secondary archive service did not respond within the expected time window. Your uploaded survey files are safe.',
    errorRecoveryAdvice: 'You can review the 960 responses already analyzed, or click "Retry verification" to attempt reconnecting to the archive.',
    canRetryVerification: true,
    failedStepName: 'Checking the result',
    resultTitle: 'Customer Satisfaction Analysis (80% Sample)',
    resultSummary: 'Analysis of 960 customer responses across North America. Shows 88% positive sentiment on product reliability, with recurring requests for faster email replies.',
    resultContent: `### Analyzed Findings (Batches 1–4)
- **Sample Size**: 960 verified customer responses (80% of total intended cohort)
- **Overall Satisfaction**: 4.3 / 5.0 (Up from 4.1 in previous month)
- **Top Compliments**: Product clarity, reliable outputs, easy onboarding for team members.
- **Primary Improvement Area**: 24% of users requested faster email notification when a task requires their approval.

### Note on Missing Data
Batch 5 (approximately 240 responses from APAC regions) is temporarily unavailable from the archive server. The current insights represent US and European feedback.`,
    resultItems: [
      { label: 'Sample Processed', value: '960 / 1,200 (80%)', badge: 'Partial Cohort' },
      { label: 'Satisfaction Score', value: '4.3 / 5.0', badge: 'Positive' },
      { label: 'Status', value: 'Safe to review partials', badge: 'Recoverable' }
    ],
    systemActions: [
      { title: 'Analyzed 960 records', description: 'Batches 1 through 4 processed without error.' },
      { title: 'Protected user inputs', description: 'Safely cached input files during external service timeout.' },
      { title: 'Isolated the partial failure', description: 'Kept completed work intact instead of discarding the entire run.' }
    ],
    humanInvolvementText: 'User review needed to decide whether to proceed with 80% sample',
    sources: [
      {
        id: 'src-7',
        title: 'Survey_Responses_Batches_1-4.csv',
        type: 'csv',
        relevanceScore: 95,
        relevantExcerpt: 'Column [Satisfaction]: Average rating 4.34 across 960 validated records.',
        pageOrSection: 'Overall Summary Table'
      }
    ],
    explainability: {
      question: 'Why is this result marked partial?',
      summary: 'The main findings are sound for North America and Europe, but the APAC archive server was temporarily unreachable.',
      informationConsidered: [
        '960 customer support survey entries',
        'Tag taxonomy from Support_Tags_Catalog.txt'
      ],
      rulesAndChecksApplied: [
        'Minimum sample threshold check (PASSED: >500 required)',
        'External archive sync check (FAILED: Connection timed out)',
        'Data integrity scan on processed rows (PASSED)'
      ],
      assumptionsMade: [
        'Sentiment patterns in Western regions are representative for immediate internal planning.'
      ]
    }
  },
  {
    id: 'tsk-004',
    title: 'Weekly compliance check for supplier onboarding files',
    description: 'Check 14 new supplier registrations for required insurance certificates, tax IDs, and anti-bribery declarations.',
    category: 'Legal & Compliance',
    createdAt: 'Yesterday, 11:00 AM',
    completedAt: 'Yesterday, 11:02 AM',
    status: 'completed',
    estimatedDuration: 'About 1–2 minutes',
    actualDuration: '1m 15s',
    confidence: 'high',
    confidenceReason: 'All 14 suppliers provided valid documentation matching regional registry criteria.',
    files: [
      { id: 'f-9', name: 'Supplier_Registrations_Week35.csv', size: 120000, type: 'text/csv', uploadDate: 'Yesterday' }
    ],
    steps: [
      { id: 's1', name: 'Understanding your request', status: 'completed', statusMessage: '14 supplier records received.' },
      { id: 's2', name: 'Reviewing information', status: 'completed', statusMessage: 'Checked company registration numbers and certificates.' },
      { id: 's3', name: 'Creating the draft', status: 'completed', statusMessage: 'Compiled compliance report.' },
      { id: 's4', name: 'Checking the result', status: 'completed', statusMessage: 'All mandatory tax IDs validated.' },
      { id: 's5', name: 'Ready for review', status: 'completed', statusMessage: 'All suppliers cleared for onboarding.' }
    ],
    currentStepIndex: 5,
    requiresApproval: false,
    approvalStatus: 'approved',
    resultTitle: 'Supplier Onboarding Compliance Roster',
    resultSummary: '14 of 14 prospective vendors meet all mandatory documentation requirements. All 14 are eligible to receive purchase orders.',
    resultContent: `### Compliance Audit Summary
- **Total Vendors Checked**: 14
- **Cleared Immediately**: 14 (100%)
- **Tax Certificates Verified**: 14
- **Active Liability Insurance Verified**: 14

All compliance certificates have been archived with 12-month validity flags.`,
    resultItems: [
      { label: 'Suppliers Audited', value: '14 of 14', badge: '100% Cleared' },
      { label: 'Tax ID Match', value: '14 Validated', badge: 'Verified' }
    ],
    systemActions: [
      { title: 'Verified 14 tax records', description: 'Cross-checked against state business registries.' },
      { title: 'Checked insurance validity', description: 'Ensured coverage expiration dates are past December 2026.' }
    ],
    humanInvolvementText: 'No manual intervention required',
    sources: [
      {
        id: 'src-9',
        title: 'Supplier_Registrations_Week35.csv',
        type: 'csv',
        relevanceScore: 99,
        relevantExcerpt: '14 records verified against National Registry API mock endpoints.',
        pageOrSection: 'All records'
      }
    ],
    explainability: {
      question: 'Why were all suppliers cleared?',
      summary: 'Every submitted company had complete tax certificates, insurance coverage over $1M, and signed compliance agreements.',
      informationConsidered: ['14 registration submissions and insurance policy PDF attachments.'],
      rulesAndChecksApplied: ['Mandatory Tax ID format check', 'Insurance expiration >= 6 months', 'Authorized signatory check'],
      assumptionsMade: ['Tax documents provided are genuine as cross-referenced with public registry.']
    }
  }
];

export const DEMO_TEMPLATES = [
  {
    id: 'demo-campaign',
    title: 'Create a campaign brief from market research',
    tagline: 'Standard successful workflow',
    description: 'Summarize consumer research and competitor data into a clean, ready-to-share campaign launch brief.',
    category: 'Marketing Operations',
    prompt: 'Create a comprehensive marketing campaign brief based on our latest Q3 market research and customer survey. Highlight our target audience, value pillars, and 30-day rollout plan.',
    sampleFiles: [
      { id: 'f-demo-1', name: 'Q3_Market_Research_Report.pdf', size: 340000, type: 'application/pdf', uploadDate: 'Just now' },
      { id: 'f-demo-2', name: 'Customer_Feedback_Survey.csv', size: 145000, type: 'text/csv', uploadDate: 'Just now' },
      { id: 'f-demo-3', name: 'Product_Specification_V2.docx', size: 220000, type: 'docx', uploadDate: 'Just now' }
    ],
    fields: {
      targetAudience: 'Operations and business managers seeking simple automation',
      campaignObjective: 'Drive adoption of non-technical workflow system',
      deadline: 'September 28, 2026'
    },
    flowType: 'success'
  },
  {
    id: 'demo-invoice',
    title: 'Vendor invoice & PO cross-check',
    tagline: 'Workflow requiring human approval',
    description: 'Cross-check a vendor invoice against purchase orders and delivery dockets. Pauses for review when price discrepancies occur.',
    category: 'Finance & Invoicing',
    prompt: 'Cross-check vendor invoice #MT-2026-0847 from Pacific Hardware against purchase order PO-1001 and delivery receipts. Flag any discrepancies before authorizing payment.',
    sampleFiles: [
      { id: 'f-demo-4', name: 'Invoice_MT-2026-0847.pdf', size: 184000, type: 'application/pdf', uploadDate: 'Just now' },
      { id: 'f-demo-5', name: 'PO-1001_Authorized_Purchase_Order.pdf', size: 142000, type: 'application/pdf', uploadDate: 'Just now' },
      { id: 'f-demo-6', name: 'Goods_Receipt_GRN-2026-0451.csv', size: 48000, type: 'text/csv', uploadDate: 'Just now' }
    ],
    fields: {
      targetAudience: 'Finance & Accounts Payable department',
      campaignObjective: 'Ensure accurate spend authorization without duplicate or inflated payments',
      deadline: 'Immediate'
    },
    flowType: 'approval'
  },
  {
    id: 'demo-error',
    title: 'Customer survey sentiment report',
    tagline: 'Workflow containing recoverable issue',
    description: 'Process multi-batch survey logs. Simulates an unreachable archive service with graceful recovery and partial completion.',
    category: 'Customer Experience',
    prompt: 'Analyze weekly customer satisfaction survey batches and extract key loyalty drivers. Keep all completed batches safe even if remote archives time out.',
    sampleFiles: [
      { id: 'f-demo-7', name: 'Survey_Batches_1-4.csv', size: 420000, type: 'text/csv', uploadDate: 'Just now' },
      { id: 'f-demo-8', name: 'Tag_Catalog.txt', size: 28000, type: 'text/plain', uploadDate: 'Just now' }
    ],
    fields: {
      targetAudience: 'Customer Experience leadership',
      campaignObjective: 'Identify primary customer friction points and response ratings',
      deadline: 'End of week'
    },
    flowType: 'partial_error'
  }
];

export const EVALUATION_METRICS: EvaluationMetrics = {
  overallPassRate: 87.5,
  outputQuality: 92.4,
  failuresDetected: 3,
  manualWorkReduction: 42.0,
  averageProcessingTime: '54 seconds',
  humanInterventionRate: 18.2,
  totalEvaluatedCases: 16
};

export const TEST_CASES: TestCase[] = [
  {
    id: 'tc-01',
    code: 'TEST #01',
    title: 'Standard vendor invoice matching clean purchase order',
    category: 'Finance Rules',
    inputDescription: 'Clean 1-page PDF invoice from Pacific Hardware matching PO-1001 exactly in items and price ($32,000).',
    expectedBehavior: 'System should extract all fields, match approved vendor list, verify goods receipt, and recommend PASS.',
    actualResult: 'All 11 checks passed. Decision: PASS with high confidence. Human review not required for payment preparation.',
    status: 'PASS',
    executionTime: '48s'
  },
  {
    id: 'tc-02',
    code: 'TEST #02',
    title: 'Vendor invoice with unexpected 10% freight surcharge',
    category: 'Policy Constraint',
    inputDescription: 'Invoice MT-2026-0847 includes unauthorized expedited freight line ($3,200) not listed on original PO.',
    expectedBehavior: 'System must halt before payment, calculate price variance (+10%), and mandate human approval.',
    actualResult: 'Flagged variance correctly. Paused at human approval gate with explicit discrepancy banner. Did not auto-commit.',
    status: 'PASS',
    executionTime: '52s'
  },
  {
    id: 'tc-03',
    code: 'TEST #03',
    title: 'Duplicate invoice number submitted within 30 days',
    category: 'Fraud Prevention',
    inputDescription: 'Submission of invoice number MT-2026-0847 already logged as paid in previous cycle.',
    expectedBehavior: 'System should flag identical invoice number against history register and BLOCK automated processing.',
    actualResult: 'Identified duplicate hash and invoice number in processed register. Paused with high-severity warning.',
    status: 'PASS',
    executionTime: '39s'
  },
  {
    id: 'tc-04',
    code: 'TEST #04',
    title: 'Missing mandatory invoice date in vendor document',
    category: 'Validation',
    inputDescription: 'Scanned vendor document missing the required invoice date header.',
    expectedBehavior: 'System should not guess dates; must inform user in plain language that date is missing.',
    actualResult: 'Flagged missing required field: "Invoice date absent". Marked confidence as Needs Review rather than guessing.',
    status: 'PASS',
    executionTime: '44s'
  },
  {
    id: 'tc-05',
    code: 'TEST #05',
    title: 'Multi-document research synthesis with conflicting dates',
    category: 'Extraction',
    inputDescription: 'Two research reports with conflicting product launch dates (September 15 vs October 01).',
    expectedBehavior: 'System should identify the conflict in the "Why this result?" section and lower confidence.',
    actualResult: 'Detected conflicting dates. Generated advisory warning: "Needs review because two documents contain different dates."',
    status: 'PASS',
    executionTime: '1m 02s'
  },
  {
    id: 'tc-06',
    code: 'TEST #06',
    title: 'Low-contrast degraded scanned PDF receipt',
    category: 'Parsing',
    inputDescription: '300-DPI faded receipt scan with slanted text and coffee stain over vendor tax code.',
    expectedBehavior: 'System should extract readable numbers but explicitly flag low optical certainty on the tax code.',
    actualResult: 'Extracted amounts correctly, but flagged tax code as uncertain. Paused for human confirmation of tax ID.',
    status: 'PASS',
    executionTime: '1m 18s'
  },
  {
    id: 'tc-07',
    code: 'TEST #07',
    title: 'Unregistered third-party vendor name variation',
    category: 'Validation',
    inputDescription: 'Vendor listed as "Pac Hardware Inc" instead of official entity "Pacific Hardware Supplies LLC".',
    expectedBehavior: 'System must match fuzzy alias or halt for human confirmation instead of rejecting blindly.',
    actualResult: 'Fuzzy match failed on initial regex; initially failed test until alias dictionary rule was introduced.',
    status: 'FAIL',
    executionTime: '55s',
    failureCategory: 'Validation',
    failureReason: 'System initially rejected valid vendor due to strict character matching on company legal suffix.',
    rootCause: 'Validation rule did not strip standard corporate entity suffixes (LLC, Inc, Corp) before catalog lookup.',
    resolution: 'Added normalized entity alias resolver before executing vendor register cross-check.'
  },
  {
    id: 'tc-08',
    code: 'TEST #08',
    title: 'External verification timeout during high load',
    category: 'Policy Constraint',
    inputDescription: 'Remote inventory database returns HTTP 504 timeout during verification step.',
    expectedBehavior: 'System must not crash or display 500 error; must preserve all completed steps and offer retry.',
    actualResult: 'Gracefully entered partial success mode: "4 of 5 steps completed. We couldn\'t verify the final result." Offered retry.',
    status: 'PASS',
    executionTime: '1m 10s'
  }
];

export const IMPACT_STATS = {
  tasksCompleted: 148,
  timeSavedHours: 74,
  successRatePercent: 96.4,
  manualReviewsPercent: 18.2
};
