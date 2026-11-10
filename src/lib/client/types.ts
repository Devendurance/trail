/// Shapes of the backend responses the UI consumes. Mirrors src/lib/discovery.ts.
export interface SupportedActionInfo {
  version: number;
  chainId: number;
  target: string;
  selector: string;
  eventTopic: string | null;
  sampleTxHash: string | null;
  sampleTxUrl: string | null;
}
export interface ProjectSummary {
  id: number;
  slug: string;
  name: string;
  officialUrl: string;
  category: string | null;
  description: string | null;
  publishedReviews: number;
  supportedAction: SupportedActionInfo | null;
}
export interface PublicReview {
  id: number;
  onchainReviewId: number;
  projectId: number;
  reviewer: string;
  rating: number;
  outcome: number;
  body: string;
  proofTxHash: string;
  reviewTxHash: string;
  proofUrl: string;
  publicationUrl: string;
  publishedAt: string;
  rewardState: string;
}
export interface ProjectsResponse {
  projects: ProjectSummary[];
  verificationLimits: string;
}
export interface ProjectCore {
  id: number;
  slug: string;
  name: string;
  officialUrl: string;
  category: string | null;
  description: string | null;
}
export interface ProjectFeed {
  project: ProjectCore;
  action: {
    version: number;
    chainId: number;
    approvedTarget: string;
    functionSelector: string;
    sampleTxHash: string | null;
  } | null;
  reviews: PublicReview[];
  verificationLimits: string;
}
export interface ReviewDetail {
  review: PublicReview;
  project: ProjectCore | null;
  verificationLimits: string;
}
export interface RankEntry {
  projectId: number;
  wallets: number;
  averageRating: number | null;
  distribution: Record<string, number>;
  workedWell: number;
  withFriction: number;
  score: number | null;
  status: "ranked" | "early_feedback";
  rank: number | null;
  project: { id: number; slug: string; name: string } | null;
  recentReviews: PublicReview[];
}
export interface RankingsResponse {
  methodology: string;
  limitations: string;
  rankings: RankEntry[];
}
export interface RewardsStatus {
  program: {
    visible: boolean;
    accepting: boolean;
    claimEnabled: boolean;
    funded: boolean;
    vault: string | null;
    claimable: boolean;
    note: string;
  };
  counts: { publishedReviews: number; assessments: number; approvedUnfunded: number };
  policy: string;
}
export interface PreparedReview {
  eligible: true;
  code: "OK";
  auth: {
    reviewer: string;
    projectId: string;
    proofTxHash: string;
    contentHash: string;
    rating: number;
    outcome: number;
    nonce: string;
    deadline: string;
  };
  signature: `0x${string}`;
  chainId: number;
  registry: `0x${string}`;
  expiresAt: string;
}
