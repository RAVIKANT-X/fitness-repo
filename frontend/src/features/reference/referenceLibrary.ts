/**
 * True Reference library — the registry of TrueReference definitions.
 *
 * Each entry describes the full movement arc for one exercise, broken
 * into temporal phases. The reference poses are normalised landmark arrays
 * that can be rendered as ghost skeletons.
 *
 * Adding a new exercise:
 *  1. Add reference poses to referencePoses.ts
 *  2. Add a TrueReference entry here
 *  3. Nothing else changes — consumers auto-discover via getTrueReference()
 */

import type { TrueReference } from './referenceTypes'
import {
  SQUAT_STANDING, SQUAT_DESCENDING, SQUAT_BOTTOM, SQUAT_ASCENDING,
  PUSHUP_TOP, PUSHUP_DESCENDING, PUSHUP_BOTTOM, PUSHUP_ASCENDING,
  CURL_EXTENDED, CURL_CURLING, CURL_PEAK, CURL_RETURNING,
} from './referencePoses'

// ── Squat True Reference ──────────────────────────────────────────────────────

const SQUAT_REFERENCE: TrueReference = {
  exerciseId: 'squat',
  exerciseName: 'Squat',
  phases: [
    {
      phase: 'STANDING',
      label: 'Starting Position',
      instruction: 'Stand upright, feet shoulder-width. Chest tall, core braced.',
      pose: SQUAT_STANDING,
      expectedAngles: {
        leftKneeAngle: 170,
        rightKneeAngle: 170,
        leftHipAngle: 170,
        rightHipAngle: 170,
      },
      keyJoints: ['Left Knee', 'Right Knee', 'Left Hip', 'Right Hip'],
    },
    {
      phase: 'DESCENDING',
      label: 'Descent',
      instruction: 'Push hips back, bend knees to ~135°. Weight through heels.',
      pose: SQUAT_DESCENDING,
      expectedAngles: {
        leftKneeAngle: 135,
        rightKneeAngle: 135,
        leftHipAngle: 130,
        rightHipAngle: 130,
      },
      keyJoints: ['Left Knee', 'Right Knee'],
    },
    {
      phase: 'BOTTOM',
      label: 'Bottom Position',
      instruction: 'Thighs parallel to floor. Knees track over toes. Chest up.',
      pose: SQUAT_BOTTOM,
      expectedAngles: {
        leftKneeAngle: 90,
        rightKneeAngle: 90,
        leftHipAngle: 90,
        rightHipAngle: 90,
      },
      keyJoints: ['Left Knee', 'Right Knee', 'Left Hip', 'Right Hip'],
    },
    {
      phase: 'ASCENDING',
      label: 'Recovery',
      instruction: 'Drive through heels. Keep knees tracking over toes as you rise.',
      pose: SQUAT_ASCENDING,
      expectedAngles: {
        leftKneeAngle: 120,
        rightKneeAngle: 120,
        leftHipAngle: 120,
        rightHipAngle: 120,
      },
      keyJoints: ['Left Knee', 'Right Knee'],
    },
  ],
}

// ── Push-Up True Reference ────────────────────────────────────────────────────

const PUSHUP_REFERENCE: TrueReference = {
  exerciseId: 'pushup',
  exerciseName: 'Push-Up',
  phases: [
    {
      phase: 'TOP',
      label: 'High Plank',
      instruction: 'Arms extended, body in a straight line from head to heels.',
      pose: PUSHUP_TOP,
      expectedAngles: {
        leftElbowAngle: 165,
        rightElbowAngle: 165,
        leftShoulderAngle: 45,
        rightShoulderAngle: 45,
      },
      keyJoints: ['Left Elbow', 'Right Elbow', 'Body Alignment'],
    },
    {
      phase: 'DESCENDING',
      label: 'Lowering',
      instruction: 'Elbows at ~45° from torso. Lower chest to the floor.',
      pose: PUSHUP_DESCENDING,
      expectedAngles: {
        leftElbowAngle: 120,
        rightElbowAngle: 120,
      },
      keyJoints: ['Left Elbow', 'Right Elbow'],
    },
    {
      phase: 'BOTTOM',
      label: 'Bottom Position',
      instruction: 'Elbows at 90°. Chest near floor. Body straight.',
      pose: PUSHUP_BOTTOM,
      expectedAngles: {
        leftElbowAngle: 80,
        rightElbowAngle: 80,
      },
      keyJoints: ['Left Elbow', 'Right Elbow'],
    },
    {
      phase: 'ASCENDING',
      label: 'Push Up',
      instruction: 'Push through palms. Extend fully. Keep body rigid.',
      pose: PUSHUP_ASCENDING,
      expectedAngles: {
        leftElbowAngle: 120,
        rightElbowAngle: 120,
      },
      keyJoints: ['Left Elbow', 'Right Elbow'],
    },
  ],
}

// ── Curl True Reference ───────────────────────────────────────────────────────

const CURL_REFERENCE: TrueReference = {
  exerciseId: 'curl',
  exerciseName: 'Bicep Curl',
  phases: [
    {
      phase: 'EXTENDED',
      label: 'Starting Position',
      instruction: 'Arm fully extended at side. Upper arm still against torso.',
      pose: CURL_EXTENDED,
      expectedAngles: {
        leftElbowAngle: 165,
        rightElbowAngle: 165,
        leftShoulderStability: 30,
        rightShoulderStability: 30,
      },
      keyJoints: ['Left Elbow', 'Right Elbow'],
    },
    {
      phase: 'CURLING',
      label: 'Curl',
      instruction: 'Elbow at 90°. Upper arm pinned. No shoulder swing.',
      pose: CURL_CURLING,
      expectedAngles: {
        leftElbowAngle: 90,
        rightElbowAngle: 90,
      },
      keyJoints: ['Left Elbow', 'Right Elbow', 'Left Shoulder', 'Right Shoulder'],
    },
    {
      phase: 'PEAK',
      label: 'Peak Contraction',
      instruction: 'Squeeze bicep fully. Elbow ~55°. Shoulder stays down.',
      pose: CURL_PEAK,
      expectedAngles: {
        leftElbowAngle: 55,
        rightElbowAngle: 55,
        leftShoulderStability: 30,
        rightShoulderStability: 30,
      },
      keyJoints: ['Left Elbow', 'Right Elbow'],
    },
    {
      phase: 'RETURNING',
      label: 'Lowering',
      instruction: 'Lower slowly. Maintain control. Keep upper arm still.',
      pose: CURL_RETURNING,
      expectedAngles: {
        leftElbowAngle: 90,
        rightElbowAngle: 90,
      },
      keyJoints: ['Left Elbow', 'Right Elbow'],
    },
  ],
}

// ── Registry ──────────────────────────────────────────────────────────────────

const REFERENCE_MAP: Record<string, TrueReference> = {
  squat:  SQUAT_REFERENCE,
  pushup: PUSHUP_REFERENCE,
  curl:   CURL_REFERENCE,
}

/** Returns the TrueReference for a given exercise ID, or undefined. */
export function getTrueReference(exerciseId: string): TrueReference | undefined {
  return REFERENCE_MAP[exerciseId]
}

/** Returns the reference phase matching the given MovementPhase, or undefined. */
export function getReferencePhase(exerciseId: string, phase: string) {
  return REFERENCE_MAP[exerciseId]?.phases.find((p) => p.phase === phase)
}

export { SQUAT_REFERENCE, PUSHUP_REFERENCE, CURL_REFERENCE }
