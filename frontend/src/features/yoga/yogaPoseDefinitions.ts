import { PoseLandmark } from '../biomechanics/landmarkMapping'

export type YogaPoseId =
  | 'tadasana'
  | 'tree-pose'
  | 'warrior-two'
  | 'downward-dog'
  | 'cobra'
  | 'chair-pose'
  | 'child-pose'

export interface YogaPoseDefinition {
  id: YogaPoseId
  name: string
  sanskrit: string
  description: string
  image: string
  instructions: string[]
  commonMistakes: string[]
  requiredLandmarks: PoseLandmark[]
}

export const YOGA_POSES: YogaPoseDefinition[] = [
  {
    id: 'tadasana',
    name: 'Tadasana',
    sanskrit: 'Mountain Pose',
    description: 'Grounded standing posture with upright alignment and centered weight.',
    image: '🌿',
    instructions: [
      'Stand tall with feet hip-width apart.',
      'Lift through the crown of the head and stack the torso over the pelvis.',
      'Relax the shoulders and keep the knees soft but stable.',
    ],
    commonMistakes: ['Leaning forward', 'One shoulder raised', 'Knees collapsing inward'],
    requiredLandmarks: [
      PoseLandmark.NOSE,
      PoseLandmark.LEFT_SHOULDER,
      PoseLandmark.RIGHT_SHOULDER,
      PoseLandmark.LEFT_HIP,
      PoseLandmark.RIGHT_HIP,
      PoseLandmark.LEFT_KNEE,
      PoseLandmark.RIGHT_KNEE,
      PoseLandmark.LEFT_ANKLE,
      PoseLandmark.RIGHT_ANKLE,
    ],
  },
  {
    id: 'tree-pose',
    name: 'Tree Pose',
    sanskrit: 'Vrikshasana',
    description: 'Single-leg balance with the lifted foot pressed into the standing leg.',
    image: '🌳',
    instructions: [
      'Shift weight into one leg and press the standing foot into the floor.',
      'Place the lifted foot on the ankle, calf, or thigh without touching the knee.',
      'Lift the arms overhead or press hands together at the chest.',
    ],
    commonMistakes: ['Knee collapsing inward', 'Torso leaning', 'Raised foot incorrectly positioned'],
    requiredLandmarks: [
      PoseLandmark.NOSE,
      PoseLandmark.LEFT_SHOULDER,
      PoseLandmark.RIGHT_SHOULDER,
      PoseLandmark.LEFT_HIP,
      PoseLandmark.RIGHT_HIP,
      PoseLandmark.LEFT_KNEE,
      PoseLandmark.RIGHT_KNEE,
      PoseLandmark.LEFT_ANKLE,
      PoseLandmark.RIGHT_ANKLE,
      PoseLandmark.LEFT_HEEL,
      PoseLandmark.RIGHT_HEEL,
    ],
  },
  {
    id: 'warrior-two',
    name: 'Warrior II',
    sanskrit: 'Virabhadrasana II',
    description: 'Strong lunge stance with arms extended and torso open to the side.',
    image: '🛡️',
    instructions: [
      'Step one leg wide and bend the front knee while keeping the back leg long.',
      'Reach the arms out to shoulder height, parallel to the floor.',
      'Keep the torso upright and the front knee aligned over the ankle.',
    ],
    commonMistakes: ['Front knee collapsing inward', 'Back leg bending too much', 'Arms dropping'],
    requiredLandmarks: [
      PoseLandmark.LEFT_SHOULDER,
      PoseLandmark.RIGHT_SHOULDER,
      PoseLandmark.LEFT_ELBOW,
      PoseLandmark.RIGHT_ELBOW,
      PoseLandmark.LEFT_WRIST,
      PoseLandmark.RIGHT_WRIST,
      PoseLandmark.LEFT_HIP,
      PoseLandmark.RIGHT_HIP,
      PoseLandmark.LEFT_KNEE,
      PoseLandmark.RIGHT_KNEE,
      PoseLandmark.LEFT_ANKLE,
      PoseLandmark.RIGHT_ANKLE,
    ],
  },
  {
    id: 'downward-dog',
    name: 'Downward Dog',
    sanskrit: 'Adho Mukha Svanasana',
    description: 'An inverted V shape with long spine, straight legs, and raised hips.',
    image: '🐶',
    instructions: [
      'Press the hands and feet into the floor with a long spine.',
      'Lift the hips up and back while keeping the knees soft but active.',
      'Keep the torso and legs in a straight line with the head relaxed.',
    ],
    commonMistakes: ['Hips too low', 'Knees overly bent', 'Back rounding'],
    requiredLandmarks: [
      PoseLandmark.LEFT_SHOULDER,
      PoseLandmark.RIGHT_SHOULDER,
      PoseLandmark.LEFT_ELBOW,
      PoseLandmark.RIGHT_ELBOW,
      PoseLandmark.LEFT_WRIST,
      PoseLandmark.RIGHT_WRIST,
      PoseLandmark.LEFT_HIP,
      PoseLandmark.RIGHT_HIP,
      PoseLandmark.LEFT_KNEE,
      PoseLandmark.RIGHT_KNEE,
      PoseLandmark.LEFT_ANKLE,
      PoseLandmark.RIGHT_ANKLE,
    ],
  },
  {
    id: 'cobra',
    name: 'Cobra Pose',
    sanskrit: 'Bhujangasana',
    description: 'Chest opening backbend that lifts the upper torso while the lower body stays grounded.',
    image: '🐍',
    instructions: [
      'Lie on the belly and press the tops of the feet and pelvis into the floor.',
      'Lift the chest using the back muscles while the shoulders stay down and wide.',
      'Keep the lower body stable and the neck long.',
    ],
    commonMistakes: ['Overarching the neck', 'Dropping shoulders', 'Lifting too high without core support'],
    requiredLandmarks: [
      PoseLandmark.NOSE,
      PoseLandmark.LEFT_SHOULDER,
      PoseLandmark.RIGHT_SHOULDER,
      PoseLandmark.LEFT_ELBOW,
      PoseLandmark.RIGHT_ELBOW,
      PoseLandmark.LEFT_WRIST,
      PoseLandmark.RIGHT_WRIST,
      PoseLandmark.LEFT_HIP,
      PoseLandmark.RIGHT_HIP,
      PoseLandmark.LEFT_KNEE,
      PoseLandmark.RIGHT_KNEE,
    ],
  },
  {
    id: 'chair-pose',
    name: 'Chair Pose',
    sanskrit: 'Utkatasana',
    description: 'A deep squat with the torso leaning forward while the knees stay aligned.',
    image: '🪑',
    instructions: [
      'Sit the hips back as if lowering into a chair.',
      'Bend the knees while keeping the chest lifted and the spine long.',
      'Press the feet into the ground and keep the knees tracking over the toes.',
    ],
    commonMistakes: ['Knees collapsing inward', 'Too much forward lean', 'Heels lifting'],
    requiredLandmarks: [
      PoseLandmark.NOSE,
      PoseLandmark.LEFT_SHOULDER,
      PoseLandmark.RIGHT_SHOULDER,
      PoseLandmark.LEFT_HIP,
      PoseLandmark.RIGHT_HIP,
      PoseLandmark.LEFT_KNEE,
      PoseLandmark.RIGHT_KNEE,
      PoseLandmark.LEFT_ANKLE,
      PoseLandmark.RIGHT_ANKLE,
    ],
  },
  {
    id: 'child-pose',
    name: 'Child\'s Pose',
    sanskrit: 'Balasana',
    description: 'A grounded forward fold with hips resting toward the heels and chest open.',
    image: '🧸',
    instructions: [
      'Sit the hips back toward the heels and fold the torso forward.',
      'Extend the arms forward or rest them by the sides.',
      'Let the spine lengthen and breathe deeply into the back.',
    ],
    commonMistakes: ['Hips too high', 'Back rounding excessive', 'Arms not extended'],
    requiredLandmarks: [
      PoseLandmark.LEFT_SHOULDER,
      PoseLandmark.RIGHT_SHOULDER,
      PoseLandmark.LEFT_ELBOW,
      PoseLandmark.RIGHT_ELBOW,
      PoseLandmark.LEFT_WRIST,
      PoseLandmark.RIGHT_WRIST,
      PoseLandmark.LEFT_HIP,
      PoseLandmark.RIGHT_HIP,
      PoseLandmark.LEFT_KNEE,
      PoseLandmark.RIGHT_KNEE,
      PoseLandmark.LEFT_ANKLE,
      PoseLandmark.RIGHT_ANKLE,
    ],
  },
]

export const YOGA_POSE_LOOKUP = Object.fromEntries(
  YOGA_POSES.map((pose) => [pose.id, pose]),
) as Record<YogaPoseId, YogaPoseDefinition>
