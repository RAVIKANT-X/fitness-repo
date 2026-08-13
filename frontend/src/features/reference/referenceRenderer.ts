/**
 * Reference ghost renderer — draws the True Reference skeleton as a
 * semi-transparent ghost over the live pose on a canvas.
 *
 * Improvements over original:
 *  - Body-relative scaling: ghost scales with detected body bounding box
 *  - Larger landmark markers (visible at ~1m)
 *  - Thicker skeleton lines (visible at ~1m)
 *  - Strong contrast: white border on green ghost
 *  - Deviation highlighting in red with pulsing radius
 *  - Correction arrows from user → reference position
 *  - Uses body-adapted reference landmarks (ghostSync.ts)
 */

import type { NormalizedLandmark } from '../pose/poseTypes'
import type { JointDeviation } from './referenceTypes'
import { POSE_CONNECTIONS } from '../pose/poseRenderer'
import { computeBodyFrame } from './ghostSync'

// ── Style constants (optimised for visibility at ~1m) ────────────────────────

const MIN_VISIBILITY          = 0.30

// Scale landmark radius and line width based on body size in frame
// Base values assume body occupies ~50% of frame height
const BASE_LANDMARK_RADIUS    = 8     // base px for landmark dot (was 5)
const BASE_CONNECTION_WIDTH   = 3.5   // base px for skeleton lines (was 2.5)

// Ghost style — semi-transparent green, clearly distinct from user
const GHOST_COLOR_FILL        = 'rgba(52,211,153,0.65)'   // emerald-400 at 65%
const GHOST_COLOR_BORDER      = 'rgba(255,255,255,0.75)'  // white border
const GHOST_CONNECTION_NORMAL = 'rgba(52,211,153,0.50)'   // emerald connection
const GHOST_DEVIATION_FILL    = 'rgba(239,68,68,0.80)'    // red for deviations
const GHOST_DEVIATION_CONN    = 'rgba(239,68,68,0.55)'    // red connections
const ARROW_COLOR             = 'rgba(251,191,36,0.95)'   // amber arrows

// Label style
const LABEL_REF_BG            = 'rgba(52,211,153,0.90)'

// ── Ghost scale from body frame ────────────────────────────────────────────────

/**
 * Computes a scale factor based on the user's detected body size in frame.
 * A larger body in frame → larger ghost markers.
 * Prevents ghost being too small when user is close, or too large when far.
 */
function computeGhostScale(
  landmarks: NormalizedLandmark[],
  _canvasWidth: number,
  canvasHeight: number,
): number {
  const frame = computeBodyFrame(landmarks)
  if (!frame) return 1.0

  // Estimate body height in pixels based on torso height
  const torsoHeightPx = frame.th * canvasHeight
  // Normalise: 200px torso → scale 1.0
  const scale = Math.max(0.6, Math.min(2.0, torsoHeightPx / 200))
  return scale
}

// ── Main renderer ─────────────────────────────────────────────────────────────

/**
 * Renders the True Reference skeleton as a ghost overlay on the canvas.
 *
 * @param ctx              - 2D canvas context (sized to video resolution)
 * @param refLandmarks     - Reference pose landmarks (33 NormalizedLandmark)
 *                           Should be body-adapted (from ghostSync.resolveGhostPose)
 * @param mirrored         - Whether to apply horizontal flip (front camera)
 * @param deviations       - Active joint deviations (for red highlighting)
 * @param userLandmarks    - User's live landmarks (for scale + correction arrows)
 */
export function renderReferencGhost(
  ctx: CanvasRenderingContext2D,
  refLandmarks: NormalizedLandmark[],
  mirrored: boolean,
  deviations: JointDeviation[] = [],
  userLandmarks: NormalizedLandmark[] = [],
): void {
  const { width, height } = ctx.canvas

  // Compute scale based on user body size
  const scale = userLandmarks.length > 0
    ? computeGhostScale(userLandmarks, width, height)
    : 1.0

  const landmarkRadius  = BASE_LANDMARK_RADIUS  * scale
  const connectionWidth = BASE_CONNECTION_WIDTH * scale

  // Build set of deviated landmark indices for quick lookup
  const deviatedIndices = new Set<number>()
  for (const dev of deviations) {
    if (dev.severity === 'WARNING' || dev.severity === 'ERROR') {
      for (const idx of dev.landmarkIndices) {
        deviatedIndices.add(idx)
      }
    }
  }

  ctx.save()
  if (mirrored) {
    ctx.translate(width, 0)
    ctx.scale(-1, 1)
  }

  // ── Draw connections ──────────────────────────────────────────────────────
  ctx.lineCap = 'round'
  for (const [a, b] of POSE_CONNECTIONS) {
    const lmA = refLandmarks[a]
    const lmB = refLandmarks[b]
    if (!lmA || !lmB) continue
    if ((lmA.visibility ?? 1) < MIN_VISIBILITY || (lmB.visibility ?? 1) < MIN_VISIBILITY) continue

    const isDeviated = deviatedIndices.has(a) || deviatedIndices.has(b)
    ctx.lineWidth   = isDeviated ? connectionWidth * 1.3 : connectionWidth
    ctx.strokeStyle = isDeviated ? GHOST_DEVIATION_CONN : GHOST_CONNECTION_NORMAL
    ctx.beginPath()
    ctx.moveTo(lmA.x * width, lmA.y * height)
    ctx.lineTo(lmB.x * width, lmB.y * height)
    ctx.stroke()
  }

  // ── Draw landmark dots ────────────────────────────────────────────────────
  for (let i = 0; i < refLandmarks.length; i++) {
    const lm  = refLandmarks[i]
    if (!lm) continue
    if ((lm.visibility ?? 1) < MIN_VISIBILITY) continue

    const px = lm.x * width
    const py = lm.y * height
    const isDeviated = deviatedIndices.has(i)
    const r = isDeviated ? landmarkRadius + 3 : landmarkRadius

    // White border ring (improves contrast on any background)
    ctx.beginPath()
    ctx.arc(px, py, r + 2, 0, Math.PI * 2)
    ctx.fillStyle = GHOST_COLOR_BORDER
    ctx.fill()

    // Inner fill
    ctx.beginPath()
    ctx.arc(px, py, r, 0, Math.PI * 2)
    ctx.fillStyle = isDeviated ? GHOST_DEVIATION_FILL : GHOST_COLOR_FILL
    ctx.fill()
  }

  // ── Draw correction arrows ────────────────────────────────────────────────
  if (userLandmarks.length > 0) {
    for (const dev of deviations) {
      if (dev.severity !== 'WARNING' && dev.severity !== 'ERROR') continue
      if (dev.correctionDirection === 'NONE') continue

      const primaryIdx = dev.landmarkIndices[1] ?? dev.landmarkIndices[0]
      const userLm = userLandmarks[primaryIdx]
      const refLm  = refLandmarks[primaryIdx]
      if (!userLm || !refLm) continue
      if ((userLm.visibility ?? 0) < 0.4) continue

      drawArrow(
        ctx,
        userLm.x * width, userLm.y * height,
        refLm.x * width,  refLm.y * height,
        scale,
      )
    }
  }

  ctx.restore()

  // ── Draw "TRUE REFERENCE" label ───────────────────────────────────────────
  if (refLandmarks.length > 0) {
    const head = refLandmarks[0]
    if (head && (head.visibility ?? 1) > MIN_VISIBILITY) {
      const labelX = mirrored ? width - head.x * width : head.x * width
      const labelY = head.y * height - landmarkRadius - 18

      ctx.save()
      ctx.font = `bold ${Math.max(10, 11 * scale)}px -apple-system, sans-serif`
      ctx.textAlign = 'center'

      // Background pill
      const text = 'TRUE REFERENCE'
      const tw = ctx.measureText(text).width
      ctx.fillStyle = LABEL_REF_BG
      roundRect(ctx, labelX - tw / 2 - 6, labelY - 13, tw + 12, 17, 4)
      ctx.fill()

      ctx.fillStyle = '#fff'
      ctx.fillText(text, labelX, labelY)
      ctx.restore()
    }
  }
}

/**
 * Renders a minimal ghost skeleton for static reference preview.
 * Used in calibration explain view and exercise detail step previews.
 */
export function renderReferenceOnly(
  ctx: CanvasRenderingContext2D,
  refLandmarks: NormalizedLandmark[],
  mirrored: boolean,
  alpha = 1.0,
): void {
  const { width, height } = ctx.canvas
  ctx.save()
  ctx.globalAlpha = alpha
  if (mirrored) {
    ctx.translate(width, 0)
    ctx.scale(-1, 1)
  }

  ctx.lineCap = 'round'
  ctx.lineWidth = 4
  ctx.strokeStyle = 'rgba(52,211,153,0.92)'

  for (const [a, b] of POSE_CONNECTIONS) {
    const lmA = refLandmarks[a]
    const lmB = refLandmarks[b]
    if (!lmA || !lmB) continue
    if ((lmA.visibility ?? 1) < MIN_VISIBILITY || (lmB.visibility ?? 1) < MIN_VISIBILITY) continue
    ctx.beginPath()
    ctx.moveTo(lmA.x * width, lmA.y * height)
    ctx.lineTo(lmB.x * width, lmB.y * height)
    ctx.stroke()
  }

  for (const lm of refLandmarks) {
    if ((lm.visibility ?? 1) < MIN_VISIBILITY) continue
    const px = lm.x * width
    const py = lm.y * height

    // White border
    ctx.beginPath()
    ctx.arc(px, py, 9, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255,255,255,0.80)'
    ctx.fill()

    // Fill
    ctx.beginPath()
    ctx.arc(px, py, 7, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(52,211,153,0.90)'
    ctx.fill()
  }

  ctx.restore()
}

// ── Arrow helper ──────────────────────────────────────────────────────────────

function drawArrow(
  ctx: CanvasRenderingContext2D,
  fromX: number, fromY: number,
  toX: number,   toY: number,
  scale = 1.0,
): void {
  const dx = toX - fromX
  const dy = toY - fromY
  const dist = Math.sqrt(dx * dx + dy * dy)
  if (dist < 8) return

  const shrink = Math.min(1, (dist - 14) / dist)
  const endX = fromX + dx * shrink
  const endY = fromY + dy * shrink

  const headLen = Math.max(12, 14 * scale)
  const angle   = Math.atan2(dy, dx)

  ctx.save()
  ctx.strokeStyle = ARROW_COLOR
  ctx.fillStyle   = ARROW_COLOR
  ctx.lineWidth   = 3 * scale
  ctx.lineCap     = 'round'

  // Shaft
  ctx.beginPath()
  ctx.moveTo(fromX, fromY)
  ctx.lineTo(endX, endY)
  ctx.stroke()

  // Arrowhead
  ctx.beginPath()
  ctx.moveTo(endX, endY)
  ctx.lineTo(
    endX - headLen * Math.cos(angle - Math.PI / 6),
    endY - headLen * Math.sin(angle - Math.PI / 6),
  )
  ctx.moveTo(endX, endY)
  ctx.lineTo(
    endX - headLen * Math.cos(angle + Math.PI / 6),
    endY - headLen * Math.sin(angle + Math.PI / 6),
  )
  ctx.stroke()

  ctx.restore()
}

// ── Rounded rect helper ───────────────────────────────────────────────────────

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}
