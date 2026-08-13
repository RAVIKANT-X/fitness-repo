/**
 * Pose renderer — draws landmarks and skeleton connections onto a canvas.
 *
 * Refinements (v2):
 *  - Connections are colour-coded by the minimum visibility of their two endpoints:
 *      high (≥ 0.75):  sky-blue  (crisp, fully tracked)
 *      mid  (≥ 0.50):  green     (reliable)
 *      low  (< 0.50):  hidden    (below MIN_VISIBILITY — not drawn)
 *  - Landmark dots are filled with a colour that reflects visibility:
 *      high: sky-blue with white border
 *      mid:  green with white border
 *  - Connection stroke width is slightly increased for visibility on mobile.
 *  - Body-part grouping: torso connections are drawn slightly thicker than limb
 *    connections to anchor the skeleton visually.
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

// Torso connections drawn thicker as the skeleton anchor
const TORSO_CONNECTIONS = new Set<string>(['11,12', '11,23', '12,24', '23,24'])

// ── Drawing style constants ───────────────────────────────────────────────────

/** Landmark dot radius */
const LANDMARK_RADIUS = 4.5
const LANDMARK_BORDER_WIDTH = 1.5

/** Connection stroke widths */
const CONNECTION_WIDTH_TORSO = 3.0
const CONNECTION_WIDTH_LIMB  = 2.0

/** Minimum visibility score to render a landmark/connection. */
const MIN_VISIBILITY = 0.50

/** Visibility threshold above which a landmark is "high confidence" */
const HIGH_VISIBILITY = 0.75

// Colour palette
const COLOR_HIGH     = 'rgba(56, 189, 248, 1.00)'    // sky-400 — high confidence
const COLOR_MID      = 'rgba(34, 197,  94, 0.85)'    // green-500 — mid confidence
const COLOR_HIGH_T   = 'rgba(56, 189, 248, 0.55)'    // translucent high — connections
const COLOR_MID_T    = 'rgba(34, 197,  94, 0.55)'    // translucent mid — connections
const COLOR_BORDER   = 'rgba(255, 255, 255, 0.90)'   // white border

function connectionColor(visA: number, visB: number): string | null {
  const minVis = Math.min(visA, visB)
  if (minVis < MIN_VISIBILITY) return null  // skip
  return minVis >= HIGH_VISIBILITY ? COLOR_HIGH_T : COLOR_MID_T
}

function landmarkFillColor(vis: number): string {
  return vis >= HIGH_VISIBILITY ? COLOR_HIGH : COLOR_MID
}

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
  ctx.save()
  if (mirrored) {
    ctx.translate(width, 0)
    ctx.scale(-1, 1)
  }

  // ── Draw connections ──────────────────────────────────────────────────────
  ctx.lineCap = 'round'

  for (const [a, b] of POSE_CONNECTIONS) {
    const lmA = landmarks[a]
    const lmB = landmarks[b]
    if (!lmA || !lmB) continue

    const visA = lmA.visibility ?? 1
    const visB = lmB.visibility ?? 1
    const color = connectionColor(visA, visB)
    if (!color) continue

    const key = `${a},${b}`
    const isTorso = TORSO_CONNECTIONS.has(key)

    ctx.lineWidth = isTorso ? CONNECTION_WIDTH_TORSO : CONNECTION_WIDTH_LIMB
    ctx.strokeStyle = color

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
    ctx.fillStyle = COLOR_BORDER
    ctx.fill()

    // Confidence-tinted fill
    ctx.beginPath()
    ctx.arc(px, py, LANDMARK_RADIUS, 0, Math.PI * 2)
    ctx.fillStyle = landmarkFillColor(vis)
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
