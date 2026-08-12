import { describe, it, expect } from 'vitest'
import {
  EXERCISE_LIBRARY,
  EXERCISE_MAP,
  getExerciseById,
} from '../features/exercise/exerciseLibrary'
import { PoseLandmark, POSE_LANDMARK_COUNT } from '../features/biomechanics/landmarkMapping'

// ── Library integrity ─────────────────────────────────────────────────────────

describe('EXERCISE_LIBRARY — presence', () => {
  it('contains exactly squat, pushup, and curl', () => {
    const ids = EXERCISE_LIBRARY.map((e) => e.id)
    expect(ids).toContain('squat')
    expect(ids).toContain('pushup')
    expect(ids).toContain('curl')
    expect(ids).toHaveLength(3)
  })
})

describe('EXERCISE_LIBRARY — unique IDs', () => {
  it('has no duplicate IDs', () => {
    const ids = EXERCISE_LIBRARY.map((e) => e.id)
    const unique = new Set(ids)
    expect(unique.size).toBe(ids.length)
  })
})

describe('EXERCISE_MAP', () => {
  it('allows O(1) lookup by id', () => {
    expect(EXERCISE_MAP['squat']).toBeDefined()
    expect(EXERCISE_MAP['pushup']).toBeDefined()
    expect(EXERCISE_MAP['curl']).toBeDefined()
  })
})

describe('getExerciseById', () => {
  it('returns the exercise for a valid id', () => {
    const ex = getExerciseById('squat')
    expect(ex).toBeDefined()
    expect(ex?.name).toBe('Squat')
  })

  it('returns undefined for an unknown id', () => {
    expect(getExerciseById('deadlift')).toBeUndefined()
  })
})

// ── Per-exercise schema validation ────────────────────────────────────────────

describe.each(EXERCISE_LIBRARY)('ExerciseDefinition: $name', (exercise) => {
  it('has a non-empty id', () => {
    expect(exercise.id.trim()).not.toBe('')
  })

  it('has a non-empty name', () => {
    expect(exercise.name.trim()).not.toBe('')
  })

  it('has a non-empty description', () => {
    expect(exercise.description.trim()).not.toBe('')
  })

  it('has at least one muscle group', () => {
    expect(exercise.muscleGroups.length).toBeGreaterThan(0)
  })

  it('has at least one primary angle definition', () => {
    expect(exercise.primaryAngles.length).toBeGreaterThan(0)
  })

  it('has at least one required landmark', () => {
    expect(exercise.requiredLandmarks.length).toBeGreaterThan(0)
  })

  it('all primary angle definitions have non-empty names', () => {
    for (const angleDef of exercise.primaryAngles) {
      expect(angleDef.name.trim()).not.toBe('')
    }
  })

  it('all primary angle landmark indices are valid PoseLandmark values', () => {
    const validIndices = Object.values(PoseLandmark).filter(
      (v) => typeof v === 'number',
    ) as number[]

    for (const angleDef of exercise.primaryAngles) {
      expect(validIndices).toContain(angleDef.pointA)
      expect(validIndices).toContain(angleDef.vertex)
      expect(validIndices).toContain(angleDef.pointC)
    }
  })

  it('all required landmark indices are within MediaPipe range', () => {
    for (const id of exercise.requiredLandmarks) {
      expect(id).toBeGreaterThanOrEqual(0)
      expect(id).toBeLessThan(POSE_LANDMARK_COUNT)
    }
  })

  it('primary angle names are unique within the exercise', () => {
    const names = exercise.primaryAngles.map((a) => a.name)
    const unique = new Set(names)
    expect(unique.size).toBe(names.length)
  })

  it('all required landmarks appear in at least one angle definition', () => {
    // Every required landmark should be referenced by at least one angle —
    // if a landmark is required but never used in an angle, it's a schema error.
    const usedInAngles = new Set<PoseLandmark>()
    for (const a of exercise.primaryAngles) {
      usedInAngles.add(a.pointA)
      usedInAngles.add(a.vertex)
      usedInAngles.add(a.pointC)
    }
    for (const lm of exercise.requiredLandmarks) {
      expect(usedInAngles.has(lm)).toBe(true)
    }
  })
})

// ── Squat-specific checks ─────────────────────────────────────────────────────

describe('Squat definition', () => {
  const squat = getExerciseById('squat')!

  it('includes bilateral knee angles', () => {
    const names = squat.primaryAngles.map((a) => a.name)
    expect(names).toContain('leftKneeAngle')
    expect(names).toContain('rightKneeAngle')
  })

  it('includes bilateral hip angles', () => {
    const names = squat.primaryAngles.map((a) => a.name)
    expect(names).toContain('leftHipAngle')
    expect(names).toContain('rightHipAngle')
  })

  it('knee angles use HIP → KNEE → ANKLE', () => {
    const left = squat.primaryAngles.find((a) => a.name === 'leftKneeAngle')!
    expect(left.pointA).toBe(PoseLandmark.LEFT_HIP)
    expect(left.vertex).toBe(PoseLandmark.LEFT_KNEE)
    expect(left.pointC).toBe(PoseLandmark.LEFT_ANKLE)
  })
})

// ── Push-up-specific checks ───────────────────────────────────────────────────

describe('Push-Up definition', () => {
  const pushUp = getExerciseById('pushup')!

  it('includes bilateral elbow angles', () => {
    const names = pushUp.primaryAngles.map((a) => a.name)
    expect(names).toContain('leftElbowAngle')
    expect(names).toContain('rightElbowAngle')
  })

  it('elbow angles use SHOULDER → ELBOW → WRIST', () => {
    const left = pushUp.primaryAngles.find((a) => a.name === 'leftElbowAngle')!
    expect(left.pointA).toBe(PoseLandmark.LEFT_SHOULDER)
    expect(left.vertex).toBe(PoseLandmark.LEFT_ELBOW)
    expect(left.pointC).toBe(PoseLandmark.LEFT_WRIST)
  })
})

// ── Curl-specific checks ──────────────────────────────────────────────────────

describe('Curl definition', () => {
  const curl = getExerciseById('curl')!

  it('includes bilateral elbow angles', () => {
    const names = curl.primaryAngles.map((a) => a.name)
    expect(names).toContain('leftElbowAngle')
    expect(names).toContain('rightElbowAngle')
  })

  it('includes shoulder stability angles', () => {
    const names = curl.primaryAngles.map((a) => a.name)
    expect(names).toContain('leftShoulderStability')
    expect(names).toContain('rightShoulderStability')
  })
})
