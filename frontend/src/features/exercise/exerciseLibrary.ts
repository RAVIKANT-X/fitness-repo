/**
 * Exercise library — the central registry of supported exercises.
 *
 * Each definition describes the biomechanical structure of one exercise.
 * No thresholds, rep logic, or form rules are included here.
 *
 * Adding a new exercise in a future phase:
 *  1. Create an ExerciseDefinition below.
 *  2. Add it to EXERCISE_LIBRARY.
 *  3. No other file needs to change for Phase 4 to pick it up.
 */

import type { ExerciseDefinition } from './exerciseTypes'
import { PoseLandmark } from '../biomechanics/landmarkMapping'

// ── Squat ─────────────────────────────────────────────────────────────────────
const squat: ExerciseDefinition = {
  id: 'squat',
  name: 'Squat',
  description: 'A fundamental lower-body compound movement targeting quads, glutes, and core.',
  shortDescription:
    'A foundational lower-body movement that builds strength in your quads, glutes, and hamstrings. Great for everyday functional fitness.',
  difficulty: 'beginner',
  category: 'Strength',
  muscleGroups: ['Quadriceps', 'Glutes', 'Hamstrings', 'Core'],
  instructions: [
    'Stand with your feet shoulder-width apart, toes pointed slightly outward.',
    'Brace your core and keep your chest tall throughout the movement.',
    'Begin bending your knees and push your hips back as if sitting into a chair.',
    'Lower until your thighs are roughly parallel to the floor.',
    'Push through your feet to return to the standing position.',
  ],
  commonMistakes: [
    'Knees caving inward during the descent or ascent.',
    'Raising your heels off the floor — keep them grounded.',
    'Rounding the lower back at the bottom of the movement.',
    'Not reaching sufficient depth (thighs above parallel).',
  ],
  aiMonitors: [
    'Left and right knee angle',
    'Left and right hip angle',
    'Knee symmetry (both sides bending evenly)',
    'Squat depth',
  ],
  primaryAngles: [
    {
      name: 'leftKneeAngle',
      pointA: PoseLandmark.LEFT_HIP,
      vertex: PoseLandmark.LEFT_KNEE,
      pointC: PoseLandmark.LEFT_ANKLE,
    },
    {
      name: 'rightKneeAngle',
      pointA: PoseLandmark.RIGHT_HIP,
      vertex: PoseLandmark.RIGHT_KNEE,
      pointC: PoseLandmark.RIGHT_ANKLE,
    },
    {
      name: 'leftHipAngle',
      pointA: PoseLandmark.LEFT_SHOULDER,
      vertex: PoseLandmark.LEFT_HIP,
      pointC: PoseLandmark.LEFT_KNEE,
    },
    {
      name: 'rightHipAngle',
      pointA: PoseLandmark.RIGHT_SHOULDER,
      vertex: PoseLandmark.RIGHT_HIP,
      pointC: PoseLandmark.RIGHT_KNEE,
    },
  ],
  requiredLandmarks: [
    PoseLandmark.LEFT_HIP,
    PoseLandmark.RIGHT_HIP,
    PoseLandmark.LEFT_KNEE,
    PoseLandmark.RIGHT_KNEE,
    PoseLandmark.LEFT_ANKLE,
    PoseLandmark.RIGHT_ANKLE,
    PoseLandmark.LEFT_SHOULDER,
    PoseLandmark.RIGHT_SHOULDER,
  ],
}

// ── Push-Up ───────────────────────────────────────────────────────────────────
const pushUp: ExerciseDefinition = {
  id: 'pushup',
  name: 'Push-Up',
  description: 'An upper-body pushing exercise targeting chest, triceps, and shoulders.',
  shortDescription:
    'A classic upper-body exercise that strengthens your chest, triceps, and shoulders using only your bodyweight.',
  difficulty: 'beginner',
  category: 'Strength',
  muscleGroups: ['Chest', 'Triceps', 'Shoulders', 'Core'],
  instructions: [
    'Start in a high plank: hands slightly wider than shoulder-width, body in a straight line.',
    'Brace your core and keep your hips level — avoid sagging or piking.',
    'Bend your elbows and lower your chest toward the floor.',
    'Lower until your elbows reach roughly 90°.',
    'Push through your palms to fully extend your arms and return to the start.',
  ],
  commonMistakes: [
    'Hips sagging or lifting — your body should form a straight line.',
    'Elbows flaring out excessively — keep them at roughly 45° from your torso.',
    'Not reaching full depth before pushing back up.',
    'Locking out the elbows aggressively at the top.',
  ],
  aiMonitors: [
    'Left and right elbow angle',
    'Left and right shoulder alignment',
    'Elbow symmetry (both sides bending evenly)',
  ],
  primaryAngles: [
    {
      name: 'leftElbowAngle',
      pointA: PoseLandmark.LEFT_SHOULDER,
      vertex: PoseLandmark.LEFT_ELBOW,
      pointC: PoseLandmark.LEFT_WRIST,
    },
    {
      name: 'rightElbowAngle',
      pointA: PoseLandmark.RIGHT_SHOULDER,
      vertex: PoseLandmark.RIGHT_ELBOW,
      pointC: PoseLandmark.RIGHT_WRIST,
    },
    {
      // Measures upper-arm / torso alignment — should stay close to 180°
      // in a good push-up (elbows not flaring excessively)
      name: 'leftShoulderAngle',
      pointA: PoseLandmark.LEFT_ELBOW,
      vertex: PoseLandmark.LEFT_SHOULDER,
      pointC: PoseLandmark.LEFT_HIP,
    },
    {
      name: 'rightShoulderAngle',
      pointA: PoseLandmark.RIGHT_ELBOW,
      vertex: PoseLandmark.RIGHT_SHOULDER,
      pointC: PoseLandmark.RIGHT_HIP,
    },
  ],
  requiredLandmarks: [
    PoseLandmark.LEFT_SHOULDER,
    PoseLandmark.RIGHT_SHOULDER,
    PoseLandmark.LEFT_ELBOW,
    PoseLandmark.RIGHT_ELBOW,
    PoseLandmark.LEFT_WRIST,
    PoseLandmark.RIGHT_WRIST,
    PoseLandmark.LEFT_HIP,
    PoseLandmark.RIGHT_HIP,
  ],
}

// ── Bicep Curl ────────────────────────────────────────────────────────────────
const curl: ExerciseDefinition = {
  id: 'curl',
  name: 'Bicep Curl',
  description: 'An isolation exercise for the biceps performed with the arm curling at the elbow.',
  shortDescription:
    'An isolation movement for the biceps. Focus on a full range of motion and keeping the upper arm still throughout.',
  difficulty: 'beginner',
  category: 'Strength',
  muscleGroups: ['Biceps', 'Forearms'],
  instructions: [
    'Stand with your feet hip-width apart, arms hanging at your sides.',
    'Keep your upper arms still and pressed against your torso.',
    'Curl one or both arms upward by bending at the elbow.',
    'Squeeze your bicep at the top of the curl.',
    'Slowly lower back to full extension to complete the rep.',
  ],
  commonMistakes: [
    'Swinging the shoulders or torso to generate momentum.',
    'Not fully extending the arm on the way down.',
    'Not curling high enough — aim for full contraction at the top.',
    'One arm lagging behind the other (asymmetry).',
  ],
  aiMonitors: [
    'Left and right elbow angle',
    'Shoulder stability (upper arm movement)',
    'Curl symmetry (both arms tracking evenly)',
    'Full extension on the descent',
  ],
  primaryAngles: [
    {
      name: 'leftElbowAngle',
      pointA: PoseLandmark.LEFT_SHOULDER,
      vertex: PoseLandmark.LEFT_ELBOW,
      pointC: PoseLandmark.LEFT_WRIST,
    },
    {
      name: 'rightElbowAngle',
      pointA: PoseLandmark.RIGHT_SHOULDER,
      vertex: PoseLandmark.RIGHT_ELBOW,
      pointC: PoseLandmark.RIGHT_WRIST,
    },
    {
      // Upper-arm stability: measures how much the shoulder lifts during the curl.
      // Should remain close to its starting value throughout the movement.
      name: 'leftShoulderStability',
      pointA: PoseLandmark.LEFT_ELBOW,
      vertex: PoseLandmark.LEFT_SHOULDER,
      pointC: PoseLandmark.LEFT_HIP,
    },
    {
      name: 'rightShoulderStability',
      pointA: PoseLandmark.RIGHT_ELBOW,
      vertex: PoseLandmark.RIGHT_SHOULDER,
      pointC: PoseLandmark.RIGHT_HIP,
    },
  ],
  requiredLandmarks: [
    PoseLandmark.LEFT_SHOULDER,
    PoseLandmark.RIGHT_SHOULDER,
    PoseLandmark.LEFT_ELBOW,
    PoseLandmark.RIGHT_ELBOW,
    PoseLandmark.LEFT_WRIST,
    PoseLandmark.RIGHT_WRIST,
    PoseLandmark.LEFT_HIP,
    PoseLandmark.RIGHT_HIP,
  ],
}

// ── Registry ──────────────────────────────────────────────────────────────────

/**
 * The central exercise library.
 * Index by `id` for O(1) lookup: `EXERCISE_MAP['squat']`
 * Iterate for display: `EXERCISE_LIBRARY`
 */
export const EXERCISE_LIBRARY: ExerciseDefinition[] = [squat, pushUp, curl]

export const EXERCISE_MAP: Record<string, ExerciseDefinition> = Object.fromEntries(
  EXERCISE_LIBRARY.map((ex) => [ex.id, ex]),
)

/** Convenience lookup — checks built-in map first, then custom localStorage exercises. */
export function getExerciseById(id: string): ExerciseDefinition | undefined {
  if (EXERCISE_MAP[id]) return EXERCISE_MAP[id]
  // Fall back to custom exercises stored in localStorage
  try {
    const raw = localStorage.getItem('fitcoach_custom_exercises')
    if (raw) {
      const customs = JSON.parse(raw) as ExerciseDefinition[]
      return customs.find((ex) => ex.id === id)
    }
  } catch {
    // ignore
  }
  return undefined
}
