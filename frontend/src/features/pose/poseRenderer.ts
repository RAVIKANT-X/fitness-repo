/**
 * Pose renderer — draws landmarks and skeleton connections onto a canvas.
 *
 * Coordinate system contract:
 *  - MediaPipe normalised landmarks are in [0..1] x [0..1] image space
 *    where (0,0) is the TOP-LEFT of the VIDEO frame as captured.
 *  - For the FRONT camera the <video> element is CSS-mirrored (scaleX(-1)).
 *    The canvas must apply the same mirror so the skeleton stays aligned
 *    with the person's body as seen on screen.
 *  - For the REAR camera no mirror is applied to either element.
 *
 * The caller passes `mirrored` to control this; it must match exactly what
 * the <video> element's CSS transform is doing.
 *
 * No React dependency — pure canvas drawing.
 */

import type { NormalizedLandmark } from './poseTypes'

// ── Skeleton connection pairs (MediaPipe 33-landmark topology) ───────────────
// Each pair [a, b] means "draw a line from landmark[a] to landmark[b]".
// Source: https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker
export const POSE_CONNECTIONS: [number, number][] = [
  // Face
  [0, 1], [1, 2], [2, 3], [3, 7],
  [0, 4], [4, 5], [5, 6], [6, 8],
  [9, 10],
  // Torso
  [11, 12], [11, 23], [12, 24], [23, 24],
  // Left arm
  [11, 13], [13, 15], [15, 17], [15, 19], [15, 21], [17, 19],
  // Right arm
  [12, 14], [14, 16], [16, 18], [16, 20], [16, 22], [18, 20],
  // Left leg
  [23, 25], [25, 27], [27, 29], [27, 31], [29, 31],
  // Right leg
  [24, 26], [26, 28], [28, 30], [28, 32], [30, 32],
]

// ── Drawing style constants ───────────────────────────────────────────────────
const LANDMARK_RADIUS = 5
const LANDMARK_COLOR = '#16a34a'        // primary green — matches design system
const LANDMARK_BORDER_COLOR = '#ffffff'
const LANDMARK_BORDER_WIDTH = 1.5

const CONNECTION_COLOR = 'rgba(22, 163, 74, 0.75)' // semi-transparent green
const CONNECTION_WIDTH = 2.5

/** Minimum visibility score to render a landmark/connection. */
const MIN_VISIBILITY = 0.5

/**
 * Renders pose landmarks and skeleton onto the provided canvas context.
 *
 * @param ctx       - 2D canvas rendering context (canvas must be sized to video resolution)
 * @param landmarks - 33 normalised landmarks from MediaPipe
 * @param mirrored  - Whether to apply a horizontal mirror transform (front camera)
 */
export function renderPose(
  ctx: CanvasRenderingContext2D,
  landmarks: NormalizedLandmark[],
  mirrored: boolean,
): void {
  const { width, height } = ctx.canvas

  ctx.clearRect(0, 0, width, height)

  // Apply mirror transform if needed (front camera).
  // We translate to the right edge, flip horizontally, then draw normally.
  // This makes landmark x=0 render on the RIGHT side of the canvas,
  // matching the mirrored video.
  ctx.save()
  if (mirrored) {
    ctx.translate(width, 0)
    ctx.scale(-1, 1)
  }

  // ── Draw connections ──────────────────────────────────────────────────────
  ctx.lineWidth = CONNECTION_WIDTH
  ctx.strokeStyle = CONNECTION_COLOR
  ctx.lineCap = 'round'

  for (const [a, b] of POSE_CONNECTIONS) {
    const lmA = landmarks[a]
    const lmB = landmarks[b]
    if (!lmA || !lmB) continue

    // Skip low-confidence connections
    const visA = lmA.visibility ?? 1
    const visB = lmB.visibility ?? 1
    if (visA < MIN_VISIBILITY || visB < MIN_VISIBILITY) continue

    ctx.beginPath()
    ctx.moveTo(lmA.x * width, lmA.y * height)
    ctx.lineTo(lmB.x * width, lmB.y * height)
    ctx.stroke()
  }

  // ── Draw landmark dots ────────────────────────────────────────────────────
  for (const lm of landmarks) {
    const vis = lm.visibility ?? 1
    if (vis < MIN_VISIBILITY) continue

    const px = lm.x * width
    const py = lm.y * height

    // White border for contrast against dark and light backgrounds
    ctx.beginPath()
    ctx.arc(px, py, LANDMARK_RADIUS + LANDMARK_BORDER_WIDTH, 0, Math.PI * 2)
    ctx.fillStyle = LANDMARK_BORDER_COLOR
    ctx.fill()

    // Green fill
    ctx.beginPath()
    ctx.arc(px, py, LANDMARK_RADIUS, 0, Math.PI * 2)
    ctx.fillStyle = LANDMARK_COLOR
    ctx.fill()
  }

  ctx.restore()
}

/**
 * Clears the canvas (used when no pose is detected or camera is stopped).
 */
export function clearCanvas(ctx: CanvasRenderingContext2D): void {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
}
