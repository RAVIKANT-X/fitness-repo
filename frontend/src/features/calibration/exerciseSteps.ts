/**
 * Per-exercise calibration step definitions.
 *
 * Each exercise has 3–5 steps corresponding to key positions in its movement.
 * The user must hold each position correctly before advancing.
 *
 * These steps are derived from the existing exerciseLibrary angle definitions
 * so they share the same biomechanical landmarks — no duplication.
 */

import type { ExerciseStep } from './calibrationTypes'
import { PoseLandmark } from '../biomechanics/landmarkMapping'

// ── Squat steps ───────────────────────────────────────────────────────────────

export const SQUAT_STEPS: ExerciseStep[] = [
  {
    number: 1,
    title: 'Start Position',
    instruction: 'Stand upright with feet shoulder-width apart. Keep your chest tall and arms relaxed.',
    requiredLandmarks: [
      PoseLandmark.LEFT_HIP, PoseLandmark.RIGHT_HIP,
      PoseLandmark.LEFT_KNEE, PoseLandmark.RIGHT_KNEE,
      PoseLandmark.LEFT_ANKLE, PoseLandmark.RIGHT_ANKLE,
      PoseLandmark.LEFT_SHOULDER, PoseLandmark.RIGHT_SHOULDER,
    ],
    angles: [
      { name: 'leftKneeAngle',  pointA: PoseLandmark.LEFT_HIP,      vertex: PoseLandmark.LEFT_KNEE,  pointC: PoseLandmark.LEFT_ANKLE },
      { name: 'rightKneeAngle', pointA: PoseLandmark.RIGHT_HIP,     vertex: PoseLandmark.RIGHT_KNEE, pointC: PoseLandmark.RIGHT_ANKLE },
      { name: 'leftHipAngle',   pointA: PoseLandmark.LEFT_SHOULDER, vertex: PoseLandmark.LEFT_HIP,   pointC: PoseLandmark.LEFT_KNEE },
      { name: 'rightHipAngle',  pointA: PoseLandmark.RIGHT_SHOULDER,vertex: PoseLandmark.RIGHT_HIP,  pointC: PoseLandmark.RIGHT_KNEE },
    ],
    targets: [
      { angleName: 'leftKneeAngle',  idealDegrees: 170, toleranceDegrees: 15, label: 'Left knee' },
      { angleName: 'rightKneeAngle', idealDegrees: 170, toleranceDegrees: 15, label: 'Right knee' },
      { angleName: 'leftHipAngle',   idealDegrees: 170, toleranceDegrees: 15, label: 'Left hip' },
      { angleName: 'rightHipAngle',  idealDegrees: 170, toleranceDegrees: 15, label: 'Right hip' },
    ],
    holdFrames: 15,
    correction: 'Stand up straight. Your knees and hips should be fully extended. Make sure your whole body is visible.',
  },
  {
    number: 2,
    title: 'Quarter Squat',
    instruction: 'Slowly bend your knees to about 135°. Think of sitting back slightly into a chair.',
    requiredLandmarks: [
      PoseLandmark.LEFT_HIP, PoseLandmark.RIGHT_HIP,
      PoseLandmark.LEFT_KNEE, PoseLandmark.RIGHT_KNEE,
      PoseLandmark.LEFT_ANKLE, PoseLandmark.RIGHT_ANKLE,
      PoseLandmark.LEFT_SHOULDER, PoseLandmark.RIGHT_SHOULDER,
    ],
    angles: [
      { name: 'leftKneeAngle',  pointA: PoseLandmark.LEFT_HIP,  vertex: PoseLandmark.LEFT_KNEE,  pointC: PoseLandmark.LEFT_ANKLE },
      { name: 'rightKneeAngle', pointA: PoseLandmark.RIGHT_HIP, vertex: PoseLandmark.RIGHT_KNEE, pointC: PoseLandmark.RIGHT_ANKLE },
    ],
    targets: [
      { angleName: 'leftKneeAngle',  idealDegrees: 135, toleranceDegrees: 20, label: 'Left knee bend' },
      { angleName: 'rightKneeAngle', idealDegrees: 135, toleranceDegrees: 20, label: 'Right knee bend' },
    ],
    holdFrames: 15,
    correction: 'Bend your knees more — aim for roughly 135°. Keep your heels flat on the floor and chest upright.',
  },
  {
    number: 3,
    title: 'Parallel Squat',
    instruction: 'Lower until your thighs are parallel to the floor (knees ~90°). Hold this position.',
    requiredLandmarks: [
      PoseLandmark.LEFT_HIP, PoseLandmark.RIGHT_HIP,
      PoseLandmark.LEFT_KNEE, PoseLandmark.RIGHT_KNEE,
      PoseLandmark.LEFT_ANKLE, PoseLandmark.RIGHT_ANKLE,
      PoseLandmark.LEFT_SHOULDER, PoseLandmark.RIGHT_SHOULDER,
    ],
    angles: [
      { name: 'leftKneeAngle',  pointA: PoseLandmark.LEFT_HIP,       vertex: PoseLandmark.LEFT_KNEE,  pointC: PoseLandmark.LEFT_ANKLE },
      { name: 'rightKneeAngle', pointA: PoseLandmark.RIGHT_HIP,      vertex: PoseLandmark.RIGHT_KNEE, pointC: PoseLandmark.RIGHT_ANKLE },
      { name: 'leftHipAngle',   pointA: PoseLandmark.LEFT_SHOULDER,  vertex: PoseLandmark.LEFT_HIP,   pointC: PoseLandmark.LEFT_KNEE },
      { name: 'rightHipAngle',  pointA: PoseLandmark.RIGHT_SHOULDER, vertex: PoseLandmark.RIGHT_HIP,  pointC: PoseLandmark.RIGHT_KNEE },
    ],
    targets: [
      { angleName: 'leftKneeAngle',  idealDegrees: 90, toleranceDegrees: 20, label: 'Left knee depth' },
      { angleName: 'rightKneeAngle', idealDegrees: 90, toleranceDegrees: 20, label: 'Right knee depth' },
      { angleName: 'leftHipAngle',   idealDegrees: 90, toleranceDegrees: 20, label: 'Left hip fold' },
      { angleName: 'rightHipAngle',  idealDegrees: 90, toleranceDegrees: 20, label: 'Right hip fold' },
    ],
    holdFrames: 15,
    correction: 'You need to go deeper. Lower until your thighs are parallel — knees should be around 90°. Keep your chest up and knees over toes.',
  },
  {
    number: 4,
    title: 'Return to Stand',
    instruction: 'Push through your feet and return to the full standing position.',
    requiredLandmarks: [
      PoseLandmark.LEFT_HIP, PoseLandmark.RIGHT_HIP,
      PoseLandmark.LEFT_KNEE, PoseLandmark.RIGHT_KNEE,
      PoseLandmark.LEFT_ANKLE, PoseLandmark.RIGHT_ANKLE,
      PoseLandmark.LEFT_SHOULDER, PoseLandmark.RIGHT_SHOULDER,
    ],
    angles: [
      { name: 'leftKneeAngle',  pointA: PoseLandmark.LEFT_HIP,  vertex: PoseLandmark.LEFT_KNEE,  pointC: PoseLandmark.LEFT_ANKLE },
      { name: 'rightKneeAngle', pointA: PoseLandmark.RIGHT_HIP, vertex: PoseLandmark.RIGHT_KNEE, pointC: PoseLandmark.RIGHT_ANKLE },
    ],
    targets: [
      { angleName: 'leftKneeAngle',  idealDegrees: 170, toleranceDegrees: 15, label: 'Left leg extension' },
      { angleName: 'rightKneeAngle', idealDegrees: 170, toleranceDegrees: 15, label: 'Right leg extension' },
    ],
    holdFrames: 12,
    correction: 'Fully extend your legs when standing back up. Squeeze your glutes at the top.',
  },
]

// ── Push-up steps ─────────────────────────────────────────────────────────────

export const PUSHUP_STEPS: ExerciseStep[] = [
  {
    number: 1,
    title: 'High Plank (Start)',
    instruction: 'Get into a high plank: arms fully extended, hands under shoulders, body in a straight line.',
    requiredLandmarks: [
      PoseLandmark.LEFT_SHOULDER, PoseLandmark.RIGHT_SHOULDER,
      PoseLandmark.LEFT_ELBOW, PoseLandmark.RIGHT_ELBOW,
      PoseLandmark.LEFT_WRIST, PoseLandmark.RIGHT_WRIST,
      PoseLandmark.LEFT_HIP, PoseLandmark.RIGHT_HIP,
    ],
    angles: [
      { name: 'leftElbowAngle',   pointA: PoseLandmark.LEFT_SHOULDER,  vertex: PoseLandmark.LEFT_ELBOW,  pointC: PoseLandmark.LEFT_WRIST },
      { name: 'rightElbowAngle',  pointA: PoseLandmark.RIGHT_SHOULDER, vertex: PoseLandmark.RIGHT_ELBOW, pointC: PoseLandmark.RIGHT_WRIST },
      { name: 'leftShoulderAngle',pointA: PoseLandmark.LEFT_ELBOW,     vertex: PoseLandmark.LEFT_SHOULDER,pointC: PoseLandmark.LEFT_HIP },
    ],
    targets: [
      { angleName: 'leftElbowAngle',  idealDegrees: 165, toleranceDegrees: 20, label: 'Left arm extension' },
      { angleName: 'rightElbowAngle', idealDegrees: 165, toleranceDegrees: 20, label: 'Right arm extension' },
    ],
    holdFrames: 15,
    correction: 'Fully extend both arms. Keep your core tight and hips level — do not let them sag or pike.',
  },
  {
    number: 2,
    title: 'Halfway Down',
    instruction: 'Slowly lower your chest halfway — elbows should be at about 120°.',
    requiredLandmarks: [
      PoseLandmark.LEFT_SHOULDER, PoseLandmark.RIGHT_SHOULDER,
      PoseLandmark.LEFT_ELBOW, PoseLandmark.RIGHT_ELBOW,
      PoseLandmark.LEFT_WRIST, PoseLandmark.RIGHT_WRIST,
    ],
    angles: [
      { name: 'leftElbowAngle',  pointA: PoseLandmark.LEFT_SHOULDER,  vertex: PoseLandmark.LEFT_ELBOW,  pointC: PoseLandmark.LEFT_WRIST },
      { name: 'rightElbowAngle', pointA: PoseLandmark.RIGHT_SHOULDER, vertex: PoseLandmark.RIGHT_ELBOW, pointC: PoseLandmark.RIGHT_WRIST },
    ],
    targets: [
      { angleName: 'leftElbowAngle',  idealDegrees: 120, toleranceDegrees: 20, label: 'Left elbow control' },
      { angleName: 'rightElbowAngle', idealDegrees: 120, toleranceDegrees: 20, label: 'Right elbow control' },
    ],
    holdFrames: 12,
    correction: 'Bend your elbows more slowly and hold at 120°. Keep elbows at roughly 45° from your torso — not flaring wide.',
  },
  {
    number: 3,
    title: 'Bottom Position',
    instruction: 'Lower all the way until elbows reach 90°. Hold this position with chest close to the floor.',
    requiredLandmarks: [
      PoseLandmark.LEFT_SHOULDER, PoseLandmark.RIGHT_SHOULDER,
      PoseLandmark.LEFT_ELBOW, PoseLandmark.RIGHT_ELBOW,
      PoseLandmark.LEFT_WRIST, PoseLandmark.RIGHT_WRIST,
    ],
    angles: [
      { name: 'leftElbowAngle',  pointA: PoseLandmark.LEFT_SHOULDER,  vertex: PoseLandmark.LEFT_ELBOW,  pointC: PoseLandmark.LEFT_WRIST },
      { name: 'rightElbowAngle', pointA: PoseLandmark.RIGHT_SHOULDER, vertex: PoseLandmark.RIGHT_ELBOW, pointC: PoseLandmark.RIGHT_WRIST },
    ],
    targets: [
      { angleName: 'leftElbowAngle',  idealDegrees: 80, toleranceDegrees: 20, label: 'Left depth' },
      { angleName: 'rightElbowAngle', idealDegrees: 80, toleranceDegrees: 20, label: 'Right depth' },
    ],
    holdFrames: 12,
    correction: 'Lower further — your elbows should reach 90° or below. Do not let your hips sag or rise.',
  },
  {
    number: 4,
    title: 'Push Back Up',
    instruction: 'Push through your palms and extend fully back to the top position.',
    requiredLandmarks: [
      PoseLandmark.LEFT_SHOULDER, PoseLandmark.RIGHT_SHOULDER,
      PoseLandmark.LEFT_ELBOW, PoseLandmark.RIGHT_ELBOW,
      PoseLandmark.LEFT_WRIST, PoseLandmark.RIGHT_WRIST,
    ],
    angles: [
      { name: 'leftElbowAngle',  pointA: PoseLandmark.LEFT_SHOULDER,  vertex: PoseLandmark.LEFT_ELBOW,  pointC: PoseLandmark.LEFT_WRIST },
      { name: 'rightElbowAngle', pointA: PoseLandmark.RIGHT_SHOULDER, vertex: PoseLandmark.RIGHT_ELBOW, pointC: PoseLandmark.RIGHT_WRIST },
    ],
    targets: [
      { angleName: 'leftElbowAngle',  idealDegrees: 165, toleranceDegrees: 20, label: 'Left arm lockout' },
      { angleName: 'rightElbowAngle', idealDegrees: 165, toleranceDegrees: 20, label: 'Right arm lockout' },
    ],
    holdFrames: 12,
    correction: 'Fully extend your arms at the top. Do not stop halfway — push all the way through.',
  },
]

// ── Curl steps ────────────────────────────────────────────────────────────────

export const CURL_STEPS: ExerciseStep[] = [
  {
    number: 1,
    title: 'Arms at Rest',
    instruction: 'Stand upright with arms fully extended at your sides, palms forward.',
    requiredLandmarks: [
      PoseLandmark.LEFT_SHOULDER, PoseLandmark.RIGHT_SHOULDER,
      PoseLandmark.LEFT_ELBOW, PoseLandmark.RIGHT_ELBOW,
      PoseLandmark.LEFT_WRIST, PoseLandmark.RIGHT_WRIST,
      PoseLandmark.LEFT_HIP, PoseLandmark.RIGHT_HIP,
    ],
    angles: [
      { name: 'leftElbowAngle',  pointA: PoseLandmark.LEFT_SHOULDER,  vertex: PoseLandmark.LEFT_ELBOW,  pointC: PoseLandmark.LEFT_WRIST },
      { name: 'rightElbowAngle', pointA: PoseLandmark.RIGHT_SHOULDER, vertex: PoseLandmark.RIGHT_ELBOW, pointC: PoseLandmark.RIGHT_WRIST },
    ],
    targets: [
      { angleName: 'leftElbowAngle',  idealDegrees: 165, toleranceDegrees: 20, label: 'Left arm extension' },
      { angleName: 'rightElbowAngle', idealDegrees: 165, toleranceDegrees: 20, label: 'Right arm extension' },
    ],
    holdFrames: 15,
    correction: 'Let your arms hang fully extended at your sides. Do not bend at the elbow.',
  },
  {
    number: 2,
    title: 'Halfway Curl',
    instruction: 'Curl both arms to 90° — forearms parallel to the floor. Keep upper arms still.',
    requiredLandmarks: [
      PoseLandmark.LEFT_SHOULDER, PoseLandmark.RIGHT_SHOULDER,
      PoseLandmark.LEFT_ELBOW, PoseLandmark.RIGHT_ELBOW,
      PoseLandmark.LEFT_WRIST, PoseLandmark.RIGHT_WRIST,
    ],
    angles: [
      { name: 'leftElbowAngle',  pointA: PoseLandmark.LEFT_SHOULDER,  vertex: PoseLandmark.LEFT_ELBOW,  pointC: PoseLandmark.LEFT_WRIST },
      { name: 'rightElbowAngle', pointA: PoseLandmark.RIGHT_SHOULDER, vertex: PoseLandmark.RIGHT_ELBOW, pointC: PoseLandmark.RIGHT_WRIST },
    ],
    targets: [
      { angleName: 'leftElbowAngle',  idealDegrees: 90, toleranceDegrees: 20, label: 'Left elbow at 90°' },
      { angleName: 'rightElbowAngle', idealDegrees: 90, toleranceDegrees: 20, label: 'Right elbow at 90°' },
    ],
    holdFrames: 15,
    correction: 'Curl until your forearms are parallel to the ground. Keep your upper arms pressed against your torso.',
  },
  {
    number: 3,
    title: 'Peak Contraction',
    instruction: 'Curl all the way up — squeeze your biceps at the top. Elbows should reach ~55°.',
    requiredLandmarks: [
      PoseLandmark.LEFT_SHOULDER, PoseLandmark.RIGHT_SHOULDER,
      PoseLandmark.LEFT_ELBOW, PoseLandmark.RIGHT_ELBOW,
      PoseLandmark.LEFT_WRIST, PoseLandmark.RIGHT_WRIST,
      PoseLandmark.LEFT_HIP, PoseLandmark.RIGHT_HIP,
    ],
    angles: [
      { name: 'leftElbowAngle',         pointA: PoseLandmark.LEFT_SHOULDER,  vertex: PoseLandmark.LEFT_ELBOW,   pointC: PoseLandmark.LEFT_WRIST },
      { name: 'rightElbowAngle',        pointA: PoseLandmark.RIGHT_SHOULDER, vertex: PoseLandmark.RIGHT_ELBOW,  pointC: PoseLandmark.RIGHT_WRIST },
      { name: 'leftShoulderStability',  pointA: PoseLandmark.LEFT_ELBOW,     vertex: PoseLandmark.LEFT_SHOULDER,pointC: PoseLandmark.LEFT_HIP },
      { name: 'rightShoulderStability', pointA: PoseLandmark.RIGHT_ELBOW,    vertex: PoseLandmark.RIGHT_SHOULDER,pointC: PoseLandmark.RIGHT_HIP },
    ],
    targets: [
      { angleName: 'leftElbowAngle',  idealDegrees: 55, toleranceDegrees: 20, label: 'Left bicep peak' },
      { angleName: 'rightElbowAngle', idealDegrees: 55, toleranceDegrees: 20, label: 'Right bicep peak' },
    ],
    holdFrames: 12,
    correction: 'Curl higher — squeeze all the way to the top. Do not swing your shoulders forward to cheat the movement.',
  },
]

// ── Registry ──────────────────────────────────────────────────────────────────

export const EXERCISE_STEPS: Record<string, ExerciseStep[]> = {
  squat:  SQUAT_STEPS,
  pushup: PUSHUP_STEPS,
  curl:   CURL_STEPS,
}

export function getStepsForExercise(exerciseId: string): ExerciseStep[] {
  return EXERCISE_STEPS[exerciseId] ?? []
}
