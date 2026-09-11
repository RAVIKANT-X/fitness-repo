import { PoseLandmark } from '../biomechanics/landmarkMapping'
import type { NormalizedLandmark } from '../pose/poseTypes'
import { YOGA_POSES, type YogaPoseDefinition, type YogaPoseId } from './yogaPoseDefinitions'

export interface YogaCheckResult {
  label: string
  ok: boolean
  detail: string
}

export interface YogaEvaluationResult {
  poseId: YogaPoseId
  poseName: string
  isCorrect: boolean
  accuracy: number
  confidence: number
  status: 'Correct' | 'Needs adjustment' | 'Detecting...'
  feedback: string
  keyIssues: string[]
  checks: YogaCheckResult[]
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function getLandmark(landmarks: NormalizedLandmark[], id: PoseLandmark): NormalizedLandmark | undefined {
  return landmarks[id]
}

function distance(a: NormalizedLandmark, b: NormalizedLandmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function angleBetween(a: NormalizedLandmark, b: NormalizedLandmark, c: NormalizedLandmark): number {
  const ab = { x: a.x - b.x, y: a.y - b.y }
  const cb = { x: c.x - b.x, y: c.y - b.y }

  const dot = ab.x * cb.x + ab.y * cb.y
  const magnitude = Math.hypot(ab.x, ab.y) * Math.hypot(cb.x, cb.y)

  if (magnitude < 0.0001) return 0

  const cosTheta = clamp(dot / magnitude, -1, 1)
  return (Math.acos(cosTheta) * 180) / Math.PI
}

function mean(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((total, value) => total + value, 0) / values.length
}

function isLevel(a: NormalizedLandmark, b: NormalizedLandmark, threshold = 0.06): boolean {
  return Math.abs(a.y - b.y) <= threshold
}

function isStraight(a: NormalizedLandmark, b: NormalizedLandmark, c: NormalizedLandmark, threshold = 150): boolean {
  return angleBetween(a, b, c) >= threshold
}

function isBent(a: NormalizedLandmark, b: NormalizedLandmark, c: NormalizedLandmark, min = 25, max = 110): boolean {
  const value = angleBetween(a, b, c)
  return value >= min && value <= max
}

function getVerticalityScore(a: NormalizedLandmark, b: NormalizedLandmark): number {
  return clamp(100 - (Math.abs(a.x - b.x) * 600), 0, 100)
}

function getPoseById(poseId: YogaPoseId): YogaPoseDefinition {
  return YOGA_POSES.find((pose) => pose.id === poseId) ?? YOGA_POSES[0]
}

export function evaluateYogaPose(
  landmarks: NormalizedLandmark[] | undefined,
  poseId: YogaPoseId,
): YogaEvaluationResult {
  const pose = getPoseById(poseId)

  if (!landmarks || landmarks.length < 33) {
    return {
      poseId: pose.id,
      poseName: pose.name,
      isCorrect: false,
      accuracy: 0,
      confidence: 0,
      status: 'Detecting...',
      feedback: 'No person detected. Please position yourself clearly in front of the camera.',
      keyIssues: ['No person detected'],
      checks: [],
    }
  }

  const leftShoulder = getLandmark(landmarks, PoseLandmark.LEFT_SHOULDER)
  const rightShoulder = getLandmark(landmarks, PoseLandmark.RIGHT_SHOULDER)
  const leftHip = getLandmark(landmarks, PoseLandmark.LEFT_HIP)
  const rightHip = getLandmark(landmarks, PoseLandmark.RIGHT_HIP)
  const leftKnee = getLandmark(landmarks, PoseLandmark.LEFT_KNEE)
  const rightKnee = getLandmark(landmarks, PoseLandmark.RIGHT_KNEE)
  const leftAnkle = getLandmark(landmarks, PoseLandmark.LEFT_ANKLE)
  const rightAnkle = getLandmark(landmarks, PoseLandmark.RIGHT_ANKLE)
  const leftElbow = getLandmark(landmarks, PoseLandmark.LEFT_ELBOW)
  const rightElbow = getLandmark(landmarks, PoseLandmark.RIGHT_ELBOW)
  const leftWrist = getLandmark(landmarks, PoseLandmark.LEFT_WRIST)
  const rightWrist = getLandmark(landmarks, PoseLandmark.RIGHT_WRIST)
  const leftFoot = getLandmark(landmarks, PoseLandmark.LEFT_FOOT_INDEX)
  const rightFoot = getLandmark(landmarks, PoseLandmark.RIGHT_FOOT_INDEX)

  if (!leftShoulder || !rightShoulder || !leftHip || !rightHip || !leftKnee || !rightKnee) {
    return {
      poseId: pose.id,
      poseName: pose.name,
      isCorrect: false,
      accuracy: 0,
      confidence: 0,
      status: 'Detecting...',
      feedback: 'Please improve lighting or move into the camera frame.',
      keyIssues: ['Low visibility'],
      checks: [],
    }
  }

  const checks: YogaCheckResult[] = []
  const issues: string[] = []

  const shouldersLevel = !!leftShoulder && !!rightShoulder && isLevel(leftShoulder, rightShoulder, 0.08)
  checks.push({
    label: 'Shoulders level',
    ok: shouldersLevel,
    detail: shouldersLevel ? 'Shoulders are aligned evenly.' : 'Try to keep your shoulders level and relaxed.',
  })
  if (!shouldersLevel) issues.push('Shoulders uneven')

  const hipsLevel = !!leftHip && !!rightHip && isLevel(leftHip, rightHip, 0.08)
  checks.push({
    label: 'Hips level',
    ok: hipsLevel,
    detail: hipsLevel ? 'Your hips are balanced.' : 'Keep your hips level to reduce wobble.',
  })
  if (!hipsLevel) issues.push('Hips uneven')

  const torsoCenter = ((leftShoulder.x + rightShoulder.x) / 2 + (leftHip.x + rightHip.x) / 2) / 2
  const torsoTop = { x: torsoCenter, y: (leftShoulder.y + rightShoulder.y) / 2, z: 0 }
  const torsoBottom = { x: torsoCenter, y: (leftHip.y + rightHip.y) / 2, z: 0 }
  const torsoVertical = getVerticalityScore(torsoTop, torsoBottom)
  const torsoUpright = torsoVertical > 55
  checks.push({
    label: 'Torso alignment',
    ok: torsoUpright,
    detail: torsoUpright ? 'Your torso is stacked and stable.' : 'Aim for a more upright torso position.',
  })
  if (!torsoUpright) issues.push('Torso leaning')

  switch (poseId) {
    case 'tadasana': {
      const leftLegStraight = !!leftKnee && !!leftAnkle && isStraight(leftHip ?? leftKnee, leftKnee, leftAnkle, 150)
      const rightLegStraight = !!rightKnee && !!rightAnkle && isStraight(rightHip ?? rightKnee, rightKnee, rightAnkle, 150)
      const kneesStable = (leftLegStraight || rightLegStraight) && Math.abs(leftKnee.y - rightKnee.y) < 0.1
      checks.push({
        label: 'Standing alignment',
        ok: kneesStable,
        detail: kneesStable ? 'Your stance is grounded and balanced.' : 'Let the knees soften slightly and stay stacked over the feet.',
      })
      if (!kneesStable) issues.push('Leg alignment')
      break
    }
    case 'tree-pose': {
      const standingKnee = leftKnee.y > rightKnee.y ? rightKnee : leftKnee
      const liftedKnee = leftKnee.y > rightKnee.y ? leftKnee : rightKnee
      const standingAnkle = leftKnee.y > rightKnee.y ? rightAnkle : leftAnkle
      const standingHip = leftKnee.y > rightKnee.y ? rightHip : leftHip
      const standingLegStraight = !!standingHip && !!standingKnee && !!standingAnkle && isStraight(standingHip, standingKnee, standingAnkle, 140)
      const liftedKneeBent = !!standingHip && !!liftedKnee && !!standingAnkle && isBent(standingHip, liftedKnee, standingAnkle, 20, 110)
      const hipsBalanced = isLevel(leftHip, rightHip, 0.06)
      const armsBalanced = !!leftWrist && !!rightWrist ? isLevel(leftWrist, rightWrist, 0.10) : true
      checks.push({
        label: 'Standing leg stability',
        ok: standingLegStraight,
        detail: standingLegStraight ? 'Your standing leg is strong and stable.' : 'Straighten the standing leg and press the foot into the floor.',
      })
      checks.push({
        label: 'Raised knee alignment',
        ok: liftedKneeBent,
        detail: liftedKneeBent ? 'The lifted knee is in a healthy position.' : 'Bend the lifted knee and place the foot at the ankle or calf.',
      })
      checks.push({
        label: 'Balance and posture',
        ok: hipsBalanced && armsBalanced,
        detail: hipsBalanced && armsBalanced ? 'Balance and posture look steady.' : 'Keep the pelvis level and the arms steady.',
      })
      if (!standingLegStraight) issues.push('Standing knee not straight')
      if (!liftedKneeBent) issues.push('Raised knee position')
      if (!(hipsBalanced && armsBalanced)) issues.push('Balance and posture')
      break
    }
    case 'warrior-two': {
      const leftFrontKnee = !!leftHip && !!leftKnee && !!leftAnkle && isBent(leftHip, leftKnee, leftAnkle, 35, 120)
      const rightFrontKnee = !!rightHip && !!rightKnee && !!rightAnkle && isBent(rightHip, rightKnee, rightAnkle, 35, 120)
      const frontKnee = leftFrontKnee || rightFrontKnee
      const leftBackStraight = !!leftHip && !!leftKnee && !!leftAnkle && isStraight(leftHip, leftKnee, leftAnkle, 135)
      const rightBackStraight = !!rightHip && !!rightKnee && !!rightAnkle && isStraight(rightHip, rightKnee, rightAnkle, 135)
      const backLegStraight = leftBackStraight || rightBackStraight
      const leftArmAngle = leftShoulder && leftElbow && leftWrist ? angleBetween(leftShoulder, leftElbow, leftWrist) : 0
      const rightArmAngle = rightShoulder && rightElbow && rightWrist ? angleBetween(rightShoulder, rightElbow, rightWrist) : 0
      const armsOpen = leftArmAngle > 60 || rightArmAngle > 60
      checks.push({
        label: 'Front knee bend',
        ok: frontKnee,
        detail: frontKnee ? 'The front knee is aligned and active.' : 'Bend the front knee while keeping it over the ankle.',
      })
      checks.push({
        label: 'Back leg length',
        ok: backLegStraight,
        detail: backLegStraight ? 'The back leg is long and stable.' : 'Keep the back leg straight and the hips open.',
      })
      checks.push({
        label: 'Arm reach',
        ok: armsOpen,
        detail: armsOpen ? 'Your arms are extended in the correct position.' : 'Reach the arms straight out to shoulder height.',
      })
      if (!frontKnee) issues.push('Front knee alignment')
      if (!backLegStraight) issues.push('Back leg position')
      if (!armsOpen) issues.push('Arm reach')
      break
    }
    case 'downward-dog': {
      const leftArmAngle = leftShoulder && leftElbow && leftWrist ? angleBetween(leftShoulder, leftElbow, leftWrist) : 0
      const rightArmAngle = rightShoulder && rightElbow && rightWrist ? angleBetween(rightShoulder, rightElbow, rightWrist) : 0
      const leftArm = leftArmAngle > 70
      const rightArm = rightArmAngle > 70
      const hipsHigh = !!leftHip && !!rightHip && ((leftHip.y + rightHip.y) / 2) < ((leftShoulder.y + rightShoulder.y) / 2)
      const leftKneeExtended = !!leftHip && !!leftKnee && !!leftAnkle && isStraight(leftHip, leftKnee, leftAnkle, 145)
      const rightKneeExtended = !!rightHip && !!rightKnee && !!rightAnkle && isStraight(rightHip, rightKnee, rightAnkle, 145)
      const kneesExtended = leftKneeExtended && rightKneeExtended
      checks.push({
        label: 'Leg extension',
        ok: kneesExtended,
        detail: kneesExtended ? 'The legs are long and active.' : 'Straighten the legs while keeping a slight bend in the knees if needed.',
      })
      checks.push({
        label: 'Arm reach',
        ok: leftArm && rightArm,
        detail: leftArm && rightArm ? 'Your arms are reaching strongly.' : 'Reach the arms long and press into the floor.',
      })
      checks.push({
        label: 'Hip height',
        ok: hipsHigh,
        detail: hipsHigh ? 'The hips are lifted correctly.' : 'Raise the hips slightly to form the inverted V shape.',
      })
      if (!kneesExtended) issues.push('Leg extension')
      if (!(leftArm && rightArm)) issues.push('Arm reach')
      if (!hipsHigh) issues.push('Hip height')
      break
    }
    case 'cobra': {
      const chestLift = !!leftShoulder && !!rightShoulder && !!leftHip && !!rightHip && ((leftShoulder.y + rightShoulder.y) / 2) < ((leftHip.y + rightHip.y) / 2)
      const leftBackOpen = !!leftShoulder && !!leftHip && !!leftKnee && angleBetween(leftShoulder, leftHip, leftKnee) < 150
      const rightBackOpen = !!rightShoulder && !!rightHip && !!rightKnee && angleBetween(rightShoulder, rightHip, rightKnee) < 150
      const backOpen = leftBackOpen || rightBackOpen
      checks.push({
        label: 'Chest lift',
        ok: chestLift,
        detail: chestLift ? 'The chest is lifted with length through the spine.' : 'Lift the chest gently while keeping the lower body grounded.',
      })
      checks.push({
        label: 'Back extension',
        ok: backOpen,
        detail: backOpen ? 'The back is extending well.' : 'Open through the chest without dropping the shoulders.',
      })
      if (!chestLift) issues.push('Chest lift')
      if (!backOpen) issues.push('Back extension')
      break
    }
    case 'chair-pose': {
      const leftKneeBend = !!leftHip && !!leftKnee && !!leftAnkle && isBent(leftHip, leftKnee, leftAnkle, 75, 130)
      const rightKneeBend = !!rightHip && !!rightKnee && !!rightAnkle && isBent(rightHip, rightKnee, rightAnkle, 75, 130)
      const kneeBend = leftKneeBend || rightKneeBend
      const hipsLowered = !!leftHip && !!rightHip && ((leftHip.y + rightHip.y) / 2) > ((leftShoulder.y + rightShoulder.y) / 2)
      const feetStable = !!leftFoot && !!rightFoot && distance(leftFoot, rightFoot) < 0.5
      checks.push({
        label: 'Knee bend',
        ok: kneeBend,
        detail: kneeBend ? 'The knees are bent into the chair shape.' : 'Sit the hips back and bend the knees deeper.',
      })
      checks.push({
        label: 'Hip position',
        ok: hipsLowered,
        detail: hipsLowered ? 'The hips are lowered into the pose.' : 'Lower the hips while keeping the torso long.',
      })
      checks.push({
        label: 'Foot stability',
        ok: feetStable,
        detail: feetStable ? 'The feet are grounded and stable.' : 'Press the feet evenly into the ground.',
      })
      if (!kneeBend) issues.push('Knee bend')
      if (!hipsLowered) issues.push('Hip position')
      if (!feetStable) issues.push('Foot stability')
      break
    }
    case 'child-pose': {
      const hipsLower = !!leftHip && !!rightHip && ((leftHip.y + rightHip.y) / 2) > ((leftShoulder.y + rightShoulder.y) / 2)
      const torsoFolded = !!leftShoulder && !!rightShoulder && !!leftHip && !!rightHip && Math.abs((leftShoulder.x + rightShoulder.x) / 2 - (leftHip.x + rightHip.x) / 2) < 0.16
      const leftArmAngle = leftShoulder && leftElbow && leftWrist ? angleBetween(leftShoulder, leftElbow, leftWrist) : 0
      const rightArmAngle = rightShoulder && rightElbow && rightWrist ? angleBetween(rightShoulder, rightElbow, rightWrist) : 0
      const armsExtended = leftArmAngle > 120 || rightArmAngle > 120
      checks.push({
        label: 'Hip depth',
        ok: hipsLower,
        detail: hipsLower ? 'The hips are lowered toward the heels.' : 'Sit the hips back and let them sink lower.',
      })
      checks.push({
        label: 'Torso fold',
        ok: torsoFolded,
        detail: torsoFolded ? 'The torso is folding forward as intended.' : 'Fold the chest forward and lengthen the spine.',
      })
      checks.push({
        label: 'Arm position',
        ok: armsExtended,
        detail: armsExtended ? 'The arms are extended and relaxed.' : 'Reach the arms forward or rest them by the sides.',
      })
      if (!hipsLower) issues.push('Hip depth')
      if (!torsoFolded) issues.push('Torso fold')
      if (!armsExtended) issues.push('Arm position')
      break
    }
    default:
      break
  }

  const passedChecks = checks.filter((check) => check.ok).length
  const accuracy = Math.round((passedChecks / Math.max(checks.length, 1)) * 100)
  const confidence = clamp(Math.round((accuracy * 0.9) + (mean(checks.map((check) => (check.ok ? 100 : 35))) * 0.1)), 0, 100)
  const isCorrect = accuracy >= 70

  const feedback = isCorrect
    ? `Excellent alignment! ${pose.name} is looking strong and stable.`
    : issues[0]
      ? `Keep adjusting: ${issues[0].toLowerCase()}.`
      : 'Keep your posture centered and let the alignment settle.'

  return {
    poseId: pose.id,
    poseName: pose.name,
    isCorrect,
    accuracy,
    confidence,
    status: isCorrect ? 'Correct' : accuracy > 0 ? 'Needs adjustment' : 'Detecting...',
    feedback,
    keyIssues: issues.length > 0 ? issues.slice(0, 3) : ['Stable alignment'],
    checks,
  }
}

export function getYogaPoseSummary(poseId: YogaPoseId): { name: string; description: string } {
  const pose = getPoseById(poseId)
  return {
    name: pose.name,
    description: pose.description,
  }
}
