/**
 * genericExerciseBridge.ts
 *
 * Bridges AI-generated custom exercises into the existing engine layers:
 *
 *   1. inferExerciseConfig()
 *      Given an ExerciseDefinition (from localStorage), infers which body
 *      region is targeted and returns the correct AngleDefinitions,
 *      PoseLandmarks, and a "movement type" tag used by the generic analyzer.
 *
 *   2. generateExerciseSteps()
 *      Converts an ExerciseDefinition's `instructions` string array into
 *      a proper ExerciseStep[] that the calibration engine can evaluate.
 *      Uses the inferred body region to assign meaningful angle targets.
 *
 *   3. analyzeGenericExercise()
 *      A pure analysis function (same signature as analyzeSquat/etc.) that
 *      provides generic rep counting + basic form tracking for any unknown
 *      exercise, using the inferred primary joint.
 *
 * Design constraints:
 *   - No fabricated data — if landmarks cannot be inferred, a safe fallback
 *     using shoulder angles is always used so the engine never crashes.
 *   - All angle targets use generous tolerances (±25°) since we cannot know
 *     the user's exact range of motion for an arbitrary exercise.
 *   - The generic analyzer counts reps via a simple angular threshold crossing
 *     (flex → extend → flex) on the inferred primary joint.
 */

import { PoseLandmark } from '../biomechanics/landmarkMapping'
import type { AngleDefinition } from '../biomechanics/biomechanicsTypes'
import type { ExerciseDefinition } from './exerciseTypes'
import type { ExerciseStep } from '../calibration/calibrationTypes'
import type { AnalysisState } from '../analysis/analysisTypes'
import type { JointAngles } from '../biomechanics/biomechanicsTypes'

// ── Movement region tags ──────────────────────────────────────────────────────

export type MovementRegion =
  | 'LOWER_BODY'   // squat, lunge, deadlift, leg press, calf raise…
  | 'UPPER_PUSH'   // push-up, shoulder press, chest fly, dip…
  | 'UPPER_PULL'   // pull-up, row, lat pulldown, face pull…
  | 'ARM_CURL'     // bicep curl, hammer curl, wrist curl…
  | 'CORE'         // plank, crunch, sit-up, leg raise…
  | 'CARDIO'       // burpee, jump squat, mountain climber, jumping jack…
  | 'FULL_BODY'    // deadlift, clean, kettlebell swing, thruster…
  | 'GENERIC'      // unknown — use shoulder angle fallback

// ── Inferred exercise configuration ──────────────────────────────────────────

export interface ExerciseConfig {
  region: MovementRegion
  /** Primary angles used both for calibration and live analysis */
  primaryAngles: AngleDefinition[]
  /** Primary landmark whose angle value drives rep counting */
  primaryAngleName: string
  /** All landmarks that must be visible for analysis to run */
  requiredLandmarks: PoseLandmark[]
  /** Expected angle when at "resting / start" position (degrees) */
  restAngle: number
  /** Expected angle at deepest / peak contraction (degrees) */
  peakAngle: number
  /** Tolerance for calibration targets (degrees) */
  tolerance: number
  /** Human-readable label for the primary joint */
  primaryJointLabel: string
}

// ── Keyword banks for region detection ───────────────────────────────────────

const LOWER_KEYWORDS = [
  'squat', 'lunge', 'leg', 'deadlift', 'hip', 'glute', 'calf', 'step',
  'lateral lunge', 'romanian', 'rdl', 'sumo', 'box squat', 'split squat',
  'pistol', 'goblet', 'hack squat', 'bulgarian', 'wall sit', 'knee',
  'quad', 'hamstring', 'thigh',
]
const UPPER_PUSH_KEYWORDS = [
  'push', 'press', 'chest', 'tricep', 'dip', 'fly', 'flye', 'pec',
  'overhead press', 'ohp', 'shoulder press', 'bench', 'pike',
]
const UPPER_PULL_KEYWORDS = [
  'pull', 'row', 'lat', 'pulldown', 'back', 'rhomboid', 'rear delt',
  'face pull', 'shrug', 'upright row', 'high pull',
]
const ARM_CURL_KEYWORDS = [
  'curl', 'bicep', 'hammer', 'wrist curl', 'preacher', 'concentration curl',
  'reverse curl', 'spider curl', 'forearm',
]
const CORE_KEYWORDS = [
  'plank', 'crunch', 'sit up', 'sit-up', 'situp', 'ab ', 'core', 'oblique',
  'leg raise', 'hollow', 'bird dog', 'dead bug', 'russian twist', 'v-up',
  'flutter', 'bicycle', 'mountain climber',
]
const CARDIO_KEYWORDS = [
  'burpee', 'jump', 'jumping', 'sprint', 'run', 'jog', 'box jump',
  'jump rope', 'high knee', 'butt kick', 'star jump', 'skater',
]
const FULL_BODY_KEYWORDS = [
  'clean', 'snatch', 'thruster', 'kettlebell', 'swing', 'turkish', 'bear crawl',
  'man maker', 'devil press', 'complex',
]

/** Detect the movement region from an exercise name + muscle groups */
export function inferMovementRegion(exercise: ExerciseDefinition): MovementRegion {
  const text = [
    exercise.name,
    ...(exercise.muscleGroups ?? []),
    ...(exercise.instructions ?? []),
  ].join(' ').toLowerCase()

  if (ARM_CURL_KEYWORDS.some((k) => text.includes(k)))  return 'ARM_CURL'
  if (CORE_KEYWORDS.some((k) => text.includes(k)))       return 'CORE'
  if (LOWER_KEYWORDS.some((k) => text.includes(k)))      return 'LOWER_BODY'
  if (UPPER_PUSH_KEYWORDS.some((k) => text.includes(k))) return 'UPPER_PUSH'
  if (UPPER_PULL_KEYWORDS.some((k) => text.includes(k))) return 'UPPER_PULL'
  if (FULL_BODY_KEYWORDS.some((k) => text.includes(k)))  return 'FULL_BODY'
  if (CARDIO_KEYWORDS.some((k) => text.includes(k)))     return 'CARDIO'

  // Category fallback
  const cat = (exercise.category ?? '').toLowerCase()
  if (cat === 'cardio') return 'CARDIO'
  if (cat === 'mobility') return 'LOWER_BODY'

  return 'GENERIC'
}

/** Map a movement region to concrete angle definitions and thresholds */
export function regionToConfig(region: MovementRegion): ExerciseConfig {
  switch (region) {

    case 'LOWER_BODY':
      return {
        region,
        primaryAngles: [
          { name: 'leftKneeAngle',  pointA: PoseLandmark.LEFT_HIP,      vertex: PoseLandmark.LEFT_KNEE,  pointC: PoseLandmark.LEFT_ANKLE },
          { name: 'rightKneeAngle', pointA: PoseLandmark.RIGHT_HIP,     vertex: PoseLandmark.RIGHT_KNEE, pointC: PoseLandmark.RIGHT_ANKLE },
          { name: 'leftHipAngle',   pointA: PoseLandmark.LEFT_SHOULDER, vertex: PoseLandmark.LEFT_HIP,   pointC: PoseLandmark.LEFT_KNEE },
          { name: 'rightHipAngle',  pointA: PoseLandmark.RIGHT_SHOULDER,vertex: PoseLandmark.RIGHT_HIP,  pointC: PoseLandmark.RIGHT_KNEE },
        ],
        primaryAngleName: 'leftKneeAngle',
        requiredLandmarks: [
          PoseLandmark.LEFT_HIP, PoseLandmark.RIGHT_HIP,
          PoseLandmark.LEFT_KNEE, PoseLandmark.RIGHT_KNEE,
          PoseLandmark.LEFT_ANKLE, PoseLandmark.RIGHT_ANKLE,
          PoseLandmark.LEFT_SHOULDER, PoseLandmark.RIGHT_SHOULDER,
        ],
        restAngle: 170,
        peakAngle: 90,
        tolerance: 25,
        primaryJointLabel: 'Knee angle',
      }

    case 'UPPER_PUSH':
      return {
        region,
        primaryAngles: [
          { name: 'leftElbowAngle',    pointA: PoseLandmark.LEFT_SHOULDER,  vertex: PoseLandmark.LEFT_ELBOW,   pointC: PoseLandmark.LEFT_WRIST },
          { name: 'rightElbowAngle',   pointA: PoseLandmark.RIGHT_SHOULDER, vertex: PoseLandmark.RIGHT_ELBOW,  pointC: PoseLandmark.RIGHT_WRIST },
          { name: 'leftShoulderAngle', pointA: PoseLandmark.LEFT_ELBOW,     vertex: PoseLandmark.LEFT_SHOULDER,pointC: PoseLandmark.LEFT_HIP },
          { name: 'rightShoulderAngle',pointA: PoseLandmark.RIGHT_ELBOW,    vertex: PoseLandmark.RIGHT_SHOULDER,pointC: PoseLandmark.RIGHT_HIP },
        ],
        primaryAngleName: 'leftElbowAngle',
        requiredLandmarks: [
          PoseLandmark.LEFT_SHOULDER, PoseLandmark.RIGHT_SHOULDER,
          PoseLandmark.LEFT_ELBOW, PoseLandmark.RIGHT_ELBOW,
          PoseLandmark.LEFT_WRIST, PoseLandmark.RIGHT_WRIST,
          PoseLandmark.LEFT_HIP, PoseLandmark.RIGHT_HIP,
        ],
        restAngle: 165,
        peakAngle: 80,
        tolerance: 25,
        primaryJointLabel: 'Elbow angle',
      }

    case 'UPPER_PULL':
      return {
        region,
        primaryAngles: [
          { name: 'leftElbowAngle',    pointA: PoseLandmark.LEFT_SHOULDER,  vertex: PoseLandmark.LEFT_ELBOW,  pointC: PoseLandmark.LEFT_WRIST },
          { name: 'rightElbowAngle',   pointA: PoseLandmark.RIGHT_SHOULDER, vertex: PoseLandmark.RIGHT_ELBOW, pointC: PoseLandmark.RIGHT_WRIST },
          { name: 'leftShoulderAngle', pointA: PoseLandmark.LEFT_ELBOW,     vertex: PoseLandmark.LEFT_SHOULDER,pointC: PoseLandmark.LEFT_HIP },
          { name: 'rightShoulderAngle',pointA: PoseLandmark.RIGHT_ELBOW,    vertex: PoseLandmark.RIGHT_SHOULDER,pointC: PoseLandmark.RIGHT_HIP },
        ],
        primaryAngleName: 'leftElbowAngle',
        requiredLandmarks: [
          PoseLandmark.LEFT_SHOULDER, PoseLandmark.RIGHT_SHOULDER,
          PoseLandmark.LEFT_ELBOW, PoseLandmark.RIGHT_ELBOW,
          PoseLandmark.LEFT_WRIST, PoseLandmark.RIGHT_WRIST,
          PoseLandmark.LEFT_HIP, PoseLandmark.RIGHT_HIP,
        ],
        restAngle: 165,
        peakAngle: 60,
        tolerance: 25,
        primaryJointLabel: 'Elbow angle',
      }

    case 'ARM_CURL':
      return {
        region,
        primaryAngles: [
          { name: 'leftElbowAngle',        pointA: PoseLandmark.LEFT_SHOULDER,  vertex: PoseLandmark.LEFT_ELBOW,   pointC: PoseLandmark.LEFT_WRIST },
          { name: 'rightElbowAngle',       pointA: PoseLandmark.RIGHT_SHOULDER, vertex: PoseLandmark.RIGHT_ELBOW,  pointC: PoseLandmark.RIGHT_WRIST },
          { name: 'leftShoulderStability', pointA: PoseLandmark.LEFT_ELBOW,     vertex: PoseLandmark.LEFT_SHOULDER,pointC: PoseLandmark.LEFT_HIP },
          { name: 'rightShoulderStability',pointA: PoseLandmark.RIGHT_ELBOW,    vertex: PoseLandmark.RIGHT_SHOULDER,pointC: PoseLandmark.RIGHT_HIP },
        ],
        primaryAngleName: 'leftElbowAngle',
        requiredLandmarks: [
          PoseLandmark.LEFT_SHOULDER, PoseLandmark.RIGHT_SHOULDER,
          PoseLandmark.LEFT_ELBOW, PoseLandmark.RIGHT_ELBOW,
          PoseLandmark.LEFT_WRIST, PoseLandmark.RIGHT_WRIST,
          PoseLandmark.LEFT_HIP, PoseLandmark.RIGHT_HIP,
        ],
        restAngle: 165,
        peakAngle: 55,
        tolerance: 20,
        primaryJointLabel: 'Elbow angle',
      }

    case 'CORE':
      return {
        region,
        primaryAngles: [
          { name: 'leftHipAngle',  pointA: PoseLandmark.LEFT_SHOULDER, vertex: PoseLandmark.LEFT_HIP,  pointC: PoseLandmark.LEFT_KNEE },
          { name: 'rightHipAngle', pointA: PoseLandmark.RIGHT_SHOULDER,vertex: PoseLandmark.RIGHT_HIP, pointC: PoseLandmark.RIGHT_KNEE },
          { name: 'leftShoulderAngle', pointA: PoseLandmark.LEFT_ELBOW,vertex: PoseLandmark.LEFT_SHOULDER,pointC: PoseLandmark.LEFT_HIP },
          { name: 'rightShoulderAngle',pointA: PoseLandmark.RIGHT_ELBOW,vertex: PoseLandmark.RIGHT_SHOULDER,pointC: PoseLandmark.RIGHT_HIP },
        ],
        primaryAngleName: 'leftHipAngle',
        requiredLandmarks: [
          PoseLandmark.LEFT_SHOULDER, PoseLandmark.RIGHT_SHOULDER,
          PoseLandmark.LEFT_HIP, PoseLandmark.RIGHT_HIP,
          PoseLandmark.LEFT_KNEE, PoseLandmark.RIGHT_KNEE,
        ],
        restAngle: 170,
        peakAngle: 90,
        tolerance: 30,
        primaryJointLabel: 'Hip angle',
      }

    case 'CARDIO':
    case 'FULL_BODY':
      return {
        region,
        primaryAngles: [
          { name: 'leftKneeAngle',  pointA: PoseLandmark.LEFT_HIP,      vertex: PoseLandmark.LEFT_KNEE,  pointC: PoseLandmark.LEFT_ANKLE },
          { name: 'rightKneeAngle', pointA: PoseLandmark.RIGHT_HIP,     vertex: PoseLandmark.RIGHT_KNEE, pointC: PoseLandmark.RIGHT_ANKLE },
          { name: 'leftHipAngle',   pointA: PoseLandmark.LEFT_SHOULDER, vertex: PoseLandmark.LEFT_HIP,   pointC: PoseLandmark.LEFT_KNEE },
          { name: 'rightHipAngle',  pointA: PoseLandmark.RIGHT_SHOULDER,vertex: PoseLandmark.RIGHT_HIP,  pointC: PoseLandmark.RIGHT_KNEE },
        ],
        primaryAngleName: 'leftKneeAngle',
        requiredLandmarks: [
          PoseLandmark.LEFT_HIP, PoseLandmark.RIGHT_HIP,
          PoseLandmark.LEFT_KNEE, PoseLandmark.RIGHT_KNEE,
          PoseLandmark.LEFT_ANKLE, PoseLandmark.RIGHT_ANKLE,
          PoseLandmark.LEFT_SHOULDER, PoseLandmark.RIGHT_SHOULDER,
        ],
        restAngle: 165,
        peakAngle: 100,
        tolerance: 30,
        primaryJointLabel: 'Knee angle',
      }

    case 'GENERIC':
    default:
      return {
        region: 'GENERIC',
        primaryAngles: [
          { name: 'leftShoulderAngle',  pointA: PoseLandmark.LEFT_ELBOW,  vertex: PoseLandmark.LEFT_SHOULDER,  pointC: PoseLandmark.LEFT_HIP },
          { name: 'rightShoulderAngle', pointA: PoseLandmark.RIGHT_ELBOW, vertex: PoseLandmark.RIGHT_SHOULDER, pointC: PoseLandmark.RIGHT_HIP },
          { name: 'leftHipAngle',       pointA: PoseLandmark.LEFT_SHOULDER,vertex: PoseLandmark.LEFT_HIP,      pointC: PoseLandmark.LEFT_KNEE },
          { name: 'rightHipAngle',      pointA: PoseLandmark.RIGHT_SHOULDER,vertex: PoseLandmark.RIGHT_HIP,    pointC: PoseLandmark.RIGHT_KNEE },
        ],
        primaryAngleName: 'leftShoulderAngle',
        requiredLandmarks: [
          PoseLandmark.LEFT_SHOULDER, PoseLandmark.RIGHT_SHOULDER,
          PoseLandmark.LEFT_HIP, PoseLandmark.RIGHT_HIP,
        ],
        restAngle: 170,
        peakAngle: 90,
        tolerance: 30,
        primaryJointLabel: 'Shoulder angle',
      }
  }
}

/** One-shot convenience: infer region then get the full config */
export function inferExerciseConfig(exercise: ExerciseDefinition): ExerciseConfig {
  const region = inferMovementRegion(exercise)
  return regionToConfig(region)
}

// ── Step generator ────────────────────────────────────────────────────────────

/**
 * Converts an exercise's `instructions` string array into a proper
 * ExerciseStep[] that the calibration engine can evaluate.
 *
 * Strategy: produce 3 canonical steps (Start → Peak → Return) regardless of
 * how many instruction strings exist, so the calibration flow always has
 * something meaningful to evaluate. Detailed instructions text is used for
 * the step instructions shown to the user.
 */
export function generateExerciseSteps(exercise: ExerciseDefinition): ExerciseStep[] {
  const config = inferExerciseConfig(exercise)
  const instr = exercise.instructions ?? []

  // Build human-readable step instructions from the exercise's own instructions
  const startText = instr[0] ?? `Stand in the starting position for ${exercise.name}. Make sure your full body is visible.`
  const midText   = instr[Math.floor(instr.length / 2)] ?? `Begin the ${exercise.name} movement and stop at the midpoint.`
  const peakText  = instr[Math.min(1, instr.length - 1)] ?? `Reach the peak position of ${exercise.name}.`
  const returnText = instr[instr.length - 1] ?? `Return to the starting position to complete one rep.`

  // Always generate 4 steps: Start → Mid → Peak → Return
  // (matches the built-in exercise pattern)
  const steps: ExerciseStep[] = [
    {
      number: 1,
      title: 'Starting Position',
      instruction: startText,
      requiredLandmarks: config.requiredLandmarks,
      angles: config.primaryAngles,
      targets: [
        {
          angleName: config.primaryAngleName,
          idealDegrees: config.restAngle,
          toleranceDegrees: config.tolerance,
          label: `${config.primaryJointLabel} — start`,
        },
      ],
      holdFrames: 15,
      correction: `Return to the starting position. Keep your body upright and joints extended. Make sure your full body is visible in frame.`,
    },
    {
      number: 2,
      title: 'Mid Movement',
      instruction: midText,
      requiredLandmarks: config.requiredLandmarks,
      angles: config.primaryAngles,
      targets: [
        {
          angleName: config.primaryAngleName,
          idealDegrees: Math.round((config.restAngle + config.peakAngle) / 2),
          toleranceDegrees: config.tolerance + 5,
          label: `${config.primaryJointLabel} — midpoint`,
        },
      ],
      holdFrames: 12,
      correction: `Move to the midpoint of the ${exercise.name}. Control the movement — don't rush.`,
    },
    {
      number: 3,
      title: 'Peak Position',
      instruction: peakText,
      requiredLandmarks: config.requiredLandmarks,
      angles: config.primaryAngles,
      targets: [
        {
          angleName: config.primaryAngleName,
          idealDegrees: config.peakAngle,
          toleranceDegrees: config.tolerance,
          label: `${config.primaryJointLabel} — peak`,
        },
      ],
      holdFrames: 12,
      correction: `Go deeper / further into the movement. Hold the peak position of ${exercise.name} and maintain form.`,
    },
    {
      number: 4,
      title: 'Return',
      instruction: returnText,
      requiredLandmarks: config.requiredLandmarks,
      angles: config.primaryAngles,
      targets: [
        {
          angleName: config.primaryAngleName,
          idealDegrees: config.restAngle,
          toleranceDegrees: config.tolerance,
          label: `${config.primaryJointLabel} — return`,
        },
      ],
      holdFrames: 12,
      correction: `Fully return to the starting position. Complete the rep with control.`,
    },
  ]

  return steps
}

// ── Generic live analyzer ─────────────────────────────────────────────────────

/**
 * Generic rep counter and basic form tracker for any unknown exercise.
 *
 * Algorithm:
 *   - Tracks the primary joint angle (knee, elbow, hip, or shoulder) from
 *     the ExerciseConfig.
 *   - Counts a rep when the angle moves from rest→peak→rest with sufficient
 *     amplitude (threshold: half of the rest-to-peak range).
 *   - Provides a single generic deviation if the joint appears to not reach
 *     peak position during a rep cycle.
 *
 * This is intentionally simple — it is far better to correctly count reps and
 * say "good form" than to fabricate specific form corrections we cannot
 * reliably measure for an arbitrary exercise.
 */
export function analyzeGenericExercise(
  angles: JointAngles,
  prev: AnalysisState,
  config: ExerciseConfig,
): AnalysisState {
  const angleResult = angles[config.primaryAngleName]

  if (!angleResult || !angleResult.valid) {
    return { ...prev, currentPhase: 'INVALID' }
  }

  const current = angleResult.degrees
  const { restAngle, peakAngle } = config

  // Determine movement direction (flex vs extend)
  // For lower-body/push: rest > peak (170 → 90) — angle decreases on flex
  // For arm curl:        rest > peak (165 → 55) — same direction
  const isFlex = restAngle > peakAngle
  const amplitude = Math.abs(restAngle - peakAngle)
  const midpoint  = Math.round((restAngle + peakAngle) / 2)
  const threshold = amplitude * 0.35  // 35% of full range = "meaningfully moved"

  // Map current angle to a coarse movement phase
  let currentPhase = prev.currentPhase
  if (isFlex) {
    // rest=high, peak=low — flexion moves angle DOWN
    if (current > midpoint + threshold * 0.5) {
      currentPhase = 'STANDING'    // near rest position
    } else if (current <= peakAngle + threshold) {
      currentPhase = 'BOTTOM'      // near peak/bottom
    } else if (current < midpoint) {
      currentPhase = 'DESCENDING'  // going down
    } else {
      currentPhase = 'ASCENDING'   // coming back up
    }
  } else {
    // rest=low, peak=high — uncommon, treat similarly
    if (current < midpoint - threshold * 0.5) {
      currentPhase = 'STANDING'
    } else if (current >= peakAngle - threshold) {
      currentPhase = 'BOTTOM'
    } else {
      currentPhase = 'DESCENDING'
    }
  }

  // ── Rep counting state machine ────────────────────────────────────────────
  // Same pattern as built-in analyzers: IDLE → STARTED → DEPTH → RETURNING → COMPLETE
  let repCycleState = prev.repCycleState
  let repCount = prev.repCount
  let minAngle = prev.minAngleDuringCycle
  let maxAngle = prev.maxAngleDuringCycle
  let lastCompletedRepDeviations = prev.lastCompletedRepDeviations

  // Track range
  if (repCycleState !== 'IDLE') {
    minAngle = Math.min(minAngle, current)
    maxAngle = Math.max(maxAngle, current)
  }

  const atPeak    = isFlex ? current <= peakAngle + threshold   : current >= peakAngle - threshold
  const atRest    = isFlex ? current >= restAngle - threshold    : current <= restAngle + threshold
  const pastStart = isFlex ? current <= restAngle - threshold    : current >= restAngle + threshold

  switch (repCycleState) {
    case 'IDLE':
      if (pastStart) {
        repCycleState = 'STARTED'
        minAngle = current
        maxAngle = current
      }
      break
    case 'STARTED':
      if (atPeak) {
        repCycleState = 'DEPTH'
      }
      break
    case 'DEPTH':
      if (!atPeak) {
        repCycleState = 'RETURNING'
      }
      break
    case 'RETURNING':
      if (atRest) {
        repCycleState = 'COMPLETE'
      }
      break
    case 'COMPLETE': {
      // Count the rep
      const rangeAchieved = Math.abs(maxAngle - minAngle)
      const deviations = rangeAchieved < amplitude * 0.5
        ? [{
            id: 'INCOMPLETE_RANGE',
            severity: 'WARNING' as const,
            angleName: config.primaryAngleName,
            observed: Math.round(rangeAchieved),
            threshold: Math.round(amplitude * 0.5),
          }]
        : []
      lastCompletedRepDeviations = deviations
      repCount = repCount + 1
      repCycleState = 'IDLE'
      minAngle = Infinity
      maxAngle = -Infinity
      break
    }
  }

  return {
    ...prev,
    repCount,
    repCycleState,
    currentPhase,
    repDeviations: repCycleState !== 'IDLE' ? [] : prev.repDeviations,
    minAngleDuringCycle: minAngle,
    maxAngleDuringCycle: maxAngle,
    lastCompletedRepDeviations,
  }
}

// ── Config cache (per session — avoids re-inferring on every frame) ───────────

const _configCache = new Map<string, ExerciseConfig>()

export function getOrInferConfig(exercise: ExerciseDefinition): ExerciseConfig {
  const cached = _configCache.get(exercise.id)
  if (cached) return cached
  const config = inferExerciseConfig(exercise)
  _configCache.set(exercise.id, config)
  return config
}
