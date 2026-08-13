/**
 * Human Scene Validation — shared gate for ALL camera-based features.
 *
 * Architecture:
 *   Camera → Human Detection → Count → State Machine → Allow / Block
 *
 * This module exposes:
 *   - validateHumanScene()     — per-frame validation (call from rAF loop)
 *   - smoothValidationState()  — temporal smoother to prevent rapid flicker
 *   - HumanSceneValidation     — canonical result type
 *   - HumanSceneStatus         — strict union of allowed statuses
 *
 * Statuses:
 *   NO_HUMAN          — no pose detected (empty room, animal, furniture, etc.)
 *   SINGLE_HUMAN      — exactly one valid human → proceed
 *   MULTIPLE_HUMANS   — 2+ humans detected → block
 *   LOW_CONFIDENCE    — human-like pose but visibility too low
 *
 * Rules enforced:
 *   • Only SINGLE_HUMAN allows camera-dependent processing.
 *   • Animals/furniture/objects → NO_HUMAN (no pose landmarks emitted by MediaPipe)
 *   • Multiple people → MULTIPLE_HUMANS regardless of size/position
 *   • Temporal smoothing: state must persist for STABLE_FRAMES frames before
 *     the UI changes — prevents single-frame flicker.
 *
 * Note on multi-person detection:
 *   MediaPipe Pose (single-person model) returns at most one pose per frame.
 *   A second person is detected by inspecting whether any *secondary* body
 *   region (head, torso extremity) appears at a distinct spatial cluster that
 *   is inconsistent with the primary skeleton. We also check if MediaPipe
 *   returns multiple pose entries (when the multi-pose model variant is used).
 *   For the current single-pose model we use a heuristic: if the primary pose
 *   has a full right-half AND a full left-half that are geometrically separated
 *   beyond a plausible single-body envelope, we flag MULTIPLE_HUMANS.
 */

import type { NormalizedLandmark } from '../pose/poseTypes'

// ── Public types ──────────────────────────────────────────────────────────────

export type HumanSceneStatus =
  | 'NO_HUMAN'
  | 'SINGLE_HUMAN'
  | 'MULTIPLE_HUMANS'
  | 'LOW_CONFIDENCE'

export interface HumanSceneValidation {
  /** Current scene status */
  status: HumanSceneStatus
  /** Number of detected humans (0, 1, or 2+) */
  personCount: number
  /** 0–1 confidence for the primary detection */
  confidence: number
  /** ID-string for the primary person (always 'p0' when single, null otherwise) */
  primaryPersonId: string | null
  /** Human-readable message for camera overlay */
  message: string
  /** Whether camera-dependent processing should proceed */
  canProceed: boolean
}

// ── Thresholds ────────────────────────────────────────────────────────────────

/** Minimum landmark visibility to consider it "present" */
const VIS_MIN = 0.45

/** Minimum average visibility across key landmarks for LOW_CONFIDENCE threshold */
const VIS_LOW = 0.25

/** Minimum average visibility to accept as SINGLE_HUMAN */
const VIS_ACCEPT = 0.50

/** How many torso landmarks (out of 4) must be visible for a valid human */
const TORSO_REQUIRED = 3

/**
 * Horizontal distance threshold: if the left-cluster and right-cluster of
 * the primary pose are this far apart (in normalised 0–1 coordinates),
 * we flag a potential second person.
 * A normal standing human spans ~0.25–0.40 of frame width at typical distances.
 */
const BODY_WIDTH_MAX = 0.55

/** Minimum frames a state must persist before the UI is updated */
export const STABLE_FRAMES = 6

// ── Landmark index groups ─────────────────────────────────────────────────────

const TORSO   = [11, 12, 23, 24] as const   // L/R shoulders + hips
const HEAD    = [0, 7, 8] as const           // nose + ears
const LEGS    = [25, 26, 27, 28] as const    // knees + ankles
const ARMS    = [13, 14, 15, 16] as const    // elbows + wrists

/** All key landmarks for average-visibility calculation */
const ALL_KEY = [...TORSO, ...HEAD, ...LEGS, ...ARMS]

// ── Exercise-specific required landmark groups ────────────────────────────────

export const EXERCISE_LANDMARKS: Record<string, readonly number[]> = {
  squat:  [...TORSO, ...LEGS],
  pushup: [...TORSO, ...ARMS],
  curl:   [...TORSO, ...ARMS],
  /** Generic / unknown — require only torso */
  default: [...TORSO, ...HEAD],
}

// ── Core validation ───────────────────────────────────────────────────────────

/**
 * Validate a single frame from one pose result (MediaPipe single-person model).
 *
 * @param allPoses   Array of pose results — the model may emit 0 or 1 per frame
 *                   (pass the raw `poses` array from usePoseLandmarker)
 * @param exerciseId Optional: checks exercise-specific landmarks
 */
export function validateHumanScene(
  allPoses: Array<{ landmarks: NormalizedLandmark[] }>,
  exerciseId?: string,
): HumanSceneValidation {

  // ── 0 poses → nothing detected ────────────────────────────────────────────
  if (!allPoses || allPoses.length === 0) {
    return noHuman('No person detected. Step into the camera frame.')
  }

  // ── 2+ poses from multi-person model ─────────────────────────────────────
  if (allPoses.length >= 2) {
    return multipleHumans(allPoses.length, 'Multiple people detected. Only one person should be visible.')
  }

  // ── Single pose entry — validate quality ──────────────────────────────────
  const landmarks = allPoses[0]?.landmarks ?? []
  if (landmarks.length === 0) {
    return noHuman('No person detected. Step into the camera frame.')
  }

  // Torso check
  const torsoVisible = TORSO.filter(i => (landmarks[i]?.visibility ?? 0) >= VIS_MIN).length
  if (torsoVisible === 0) {
    return noHuman('Human body not detected. Make sure you are visible.')
  }

  // Average visibility
  const avgVis = average(ALL_KEY.map(i => landmarks[i]?.visibility ?? 0))

  if (avgVis < VIS_LOW || torsoVisible < 2) {
    return {
      status: 'LOW_CONFIDENCE',
      personCount: 1,
      confidence: avgVis,
      primaryPersonId: null,
      message: 'Move closer or improve lighting.',
      canProceed: false,
    }
  }

  // ── Second-person spatial heuristic (single-model only) ───────────────────
  //
  // If we can detect two separate head+shoulder clusters at very different
  // x positions within the single pose output, flag multiple humans.
  //
  // We check: leftmost visible shoulder vs rightmost visible shoulder,
  // accounting for the natural human body width envelope.
  const multiplePeopleHeuristic = detectMultiplePeopleHeuristic(landmarks)
  if (multiplePeopleHeuristic) {
    return multipleHumans(2, 'Multiple people detected. Only one person should be visible.')
  }

  // ── Insufficient overall confidence ───────────────────────────────────────
  if (avgVis < VIS_ACCEPT || torsoVisible < TORSO_REQUIRED) {
    return {
      status: 'LOW_CONFIDENCE',
      personCount: 1,
      confidence: avgVis,
      primaryPersonId: null,
      message: 'Improve lighting or move closer to the camera.',
      canProceed: false,
    }
  }

  // ── Exercise-specific landmark check ──────────────────────────────────────
  if (exerciseId) {
    const required = EXERCISE_LANDMARKS[exerciseId] ?? EXERCISE_LANDMARKS.default
    const visCount = required.filter(i => (landmarks[i]?.visibility ?? 0) >= VIS_MIN).length
    const visFrac  = visCount / required.length
    if (visFrac < 0.6) {
      return {
        status: 'LOW_CONFIDENCE',
        personCount: 1,
        confidence: visFrac,
        primaryPersonId: null,
        message: getExerciseMessage(exerciseId),
        canProceed: false,
      }
    }
  }

  // ── Valid single human ────────────────────────────────────────────────────
  return {
    status: 'SINGLE_HUMAN',
    personCount: 1,
    confidence: avgVis,
    primaryPersonId: 'p0',
    message: 'One person detected.',
    canProceed: true,
  }
}

// ── Temporal smoother ─────────────────────────────────────────────────────────

/**
 * Prevents the UI from flickering by requiring a status to persist for
 * STABLE_FRAMES consecutive frames before it becomes the "committed" state.
 *
 * Usage: create one instance per component, call update() on each frame.
 *
 * @example
 *   const smoother = new ValidationSmoother()
 *   // in rAF loop:
 *   const raw = validateHumanScene(poses)
 *   const stable = smoother.update(raw)
 *   // use `stable` for UI rendering
 */
export class ValidationSmoother {
  private committed: HumanSceneValidation = noHuman('No person detected. Step into the camera frame.')
  private pending:   HumanSceneValidation | null = null
  private pendingCount = 0

  update(raw: HumanSceneValidation): HumanSceneValidation {
    if (raw.status === this.committed.status) {
      // Same as committed — reset pending, update committed confidence
      this.pending      = null
      this.pendingCount = 0
      this.committed    = raw
      return this.committed
    }

    if (this.pending && raw.status === this.pending.status) {
      this.pendingCount++
      this.pending = raw   // keep latest copy (updated confidence / message)
      if (this.pendingCount >= STABLE_FRAMES) {
        this.committed    = raw
        this.pending      = null
        this.pendingCount = 0
      }
    } else {
      // New different status — start fresh pending window
      this.pending      = raw
      this.pendingCount = 1
    }

    return this.committed
  }

  reset(): void {
    this.committed    = noHuman('No person detected. Step into the camera frame.')
    this.pending      = null
    this.pendingCount = 0
  }
}

// ── TTS cooldown helper ───────────────────────────────────────────────────────

/**
 * Returns TTS messages for human scene status changes.
 * Call this from the component's voice coach effect.
 * Returns null if the status should not trigger speech.
 */
export function getValidationTtsMessage(status: HumanSceneStatus): string | null {
  switch (status) {
    case 'NO_HUMAN':        return 'Please step into the camera frame.'
    case 'MULTIPLE_HUMANS': return 'Only one person should be visible.'
    case 'LOW_CONFIDENCE':  return null   // silent — visual feedback only
    case 'SINGLE_HUMAN':    return null   // no speech needed on ready
    default:                return null
  }
}

// ── Private helpers ───────────────────────────────────────────────────────────

function noHuman(message: string): HumanSceneValidation {
  return {
    status: 'NO_HUMAN',
    personCount: 0,
    confidence: 0,
    primaryPersonId: null,
    message,
    canProceed: false,
  }
}

function multipleHumans(count: number, message: string): HumanSceneValidation {
  return {
    status: 'MULTIPLE_HUMANS',
    personCount: count,
    confidence: 1,
    primaryPersonId: null,
    message,
    canProceed: false,
  }
}

function average(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}

/**
 * Heuristic: if the pose's left-side body landmarks and right-side body landmarks
 * are too far apart horizontally, we may be seeing two people.
 *
 * MediaPipe assigns left/right relative to the SUBJECT (not the mirror image).
 * Left shoulder = index 11, Right shoulder = index 12.
 * Left hip = index 23, Right hip = index 24.
 *
 * For a single standing person, shoulder width in normalised coordinates
 * is typically 0.10–0.35. Beyond BODY_WIDTH_MAX we suspect two people.
 */
function detectMultiplePeopleHeuristic(landmarks: NormalizedLandmark[]): boolean {
  const lShoulder = landmarks[11]
  const rShoulder = landmarks[12]
  const lHip      = landmarks[23]
  const rHip      = landmarks[24]

  // Need both shoulders or both hips to be visible
  const shouldersVisible =
    (lShoulder?.visibility ?? 0) >= VIS_MIN &&
    (rShoulder?.visibility ?? 0) >= VIS_MIN

  const hipsVisible =
    (lHip?.visibility ?? 0) >= VIS_MIN &&
    (rHip?.visibility ?? 0) >= VIS_MIN

  if (shouldersVisible) {
    const width = Math.abs(lShoulder.x - rShoulder.x)
    if (width > BODY_WIDTH_MAX) return true
  }

  if (hipsVisible) {
    const width = Math.abs(lHip.x - rHip.x)
    if (width > BODY_WIDTH_MAX) return true
  }

  // Check if head (nose) is significantly outside the shoulder envelope
  // This can indicate a second person's head in the frame
  const nose = landmarks[0]
  if (nose && (nose.visibility ?? 0) >= VIS_MIN && shouldersVisible) {
    const minX = Math.min(lShoulder.x, rShoulder.x) - 0.15
    const maxX = Math.max(lShoulder.x, rShoulder.x) + 0.15
    if (nose.x < minX || nose.x > maxX) return true
  }

  return false
}

function getExerciseMessage(exerciseId: string): string {
  if (exerciseId === 'squat') return 'Full body required — step back to show legs and feet.'
  if (exerciseId === 'pushup') return 'Upper body and arms must be visible.'
  if (exerciseId === 'curl')   return 'Arms and torso must be fully visible.'
  return 'Move into full view for this exercise.'
}
