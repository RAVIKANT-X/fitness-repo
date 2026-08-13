/**
 * Reference feature — public API barrel.
 */

export type {
  ReferencePose,
  ReferencePhase,
  TrueReference,
  JointDeviation,
  ReferenceComparison,
  RepReferenceAnalysis,
  CorrectionDirection,
} from './referenceTypes'

export { getTrueReference, getReferencePhase } from './referenceLibrary'
export { compareToReference, smoothMatchScore } from './referenceEngine'
export { renderReferencGhost, renderReferenceOnly } from './referenceRenderer'
export {
  resolveGhostPose,
  computeBodyFrame,
  smoothLandmarks,
  interpolatePoses,
} from './ghostSync'
