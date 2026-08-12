/**
 * Reference ghost renderer — draws the True Reference skeleton as a
 * semi-transparent ghost over (or beside) the live pose on a canvas.
 *
 * Two modes:
 *  - GHOST:   Renders reference skeleton in green at 40% opacity overlaid
 *             on the user's position (calibration mode).
 *  - SPLIT:   Renders reference in left half, user in right half
 *             (comparison mode — not used when camera is full-screen).
 *
 * Deviation highlighting:
 *  - Normal joints: reference green (#22c55e) at 55% opacity
 *  - Deviated joints: highlighted in red (#ef4444) with pulsing radius
 *
 * Correction arrows:
 *  - Drawn from deviated user landmark toward the correct position
 */

import type { NormalizedLandmark } from '../pose/poseTypes'
import type { JointDeviation } from './referenceTypes'
import { POSE_CONNECTIONS } from '../pose/poseRenderer'

// ── Style constants ────────────────────────────────────────────────────────────

const GHOST_LANDMARK_RADIUS   = 5
const GHOST_CONNECTION_WIDTH  = 2.5
const GHOST_COLOR_NORMAL      = 'rgba(34,197,94,0.55)'   // green, 55% opacity
const GHOST_COLOR_BORDER      = 'rgba(255,255,255,0.40)'
const GHOST_CONNECTION_NORMAL = 'rgba(34,197,94,0.40)'
const GHOST_DEVIATION_COLOR   = 'rgba(239,68,68,0.80)'   // red for deviations
const GHOST_DEVIATION_CONN    = 'rgba(239,68,68,0.50)'
const ARROW_COLOR             = 'rgba(251,191,36,0.90)'  // amber arrows
const MIN_VISIBILITY          = 0.35   // lower threshold for reference landmarks

/**
 * Renders the True Reference skeleton as a ghost overlay on the canvas.
 *
 * @param ctx              - 2D canvas context (sized to video resolution)
 * @param refLandmarks     - Reference pose landmarks (33 NormalizedLandmark)
 * @param mirrored         - Whether to apply horizontal flip (front camera)
 * @param deviations       - Active joint deviations (for red highlighting)
 * @param userLandmarks    - User's live landmarks (for correction arrows)
 */
export function renderReferencGhost(
  ctx: CanvasRenderingContext2D,
  refLandmarks: NormalizedLandmark[],
  mirrored: boolean,
  deviations: JointDeviation[] = [],
  userLandmarks: NormalizedLandmark[] = [],
): void {
  const { width, height } = ctx.canvas

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
    ctx.lineWidth   = GHOST_CONNECTION_WIDTH
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
    const radius = isDeviated ? GHOST_LANDMARK_RADIUS + 2 : GHOST_LANDMARK_RADIUS

    // Border
    ctx.beginPath()
    ctx.arc(px, py, radius + 1.5, 0, Math.PI * 2)
    ctx.fillStyle = GHOST_COLOR_BORDER
    ctx.fill()

    // Fill
    ctx.beginPath()
    ctx.arc(px, py, radius, 0, Math.PI * 2)
    ctx.fillStyle = isDeviated ? GHOST_DEVIATION_COLOR : GHOST_COLOR_NORMAL
    ctx.fill()
  }

  // ── Draw correction arrows ────────────────────────────────────────────────
  if (userLandmarks.length > 0) {
    for (const dev of deviations) {
      if (dev.severity !== 'WARNING' && dev.severity !== 'ERROR') continue
      if (dev.correctionDirection === 'NONE') continue

      // Draw arrow from user's primary landmark → reference position
      const primaryIdx = dev.landmarkIndices[1] ?? dev.landmarkIndices[0]
      const userLm = userLandmarks[primaryIdx]
      const refLm  = refLandmarks[primaryIdx]
      if (!userLm || !refLm) continue
      if ((userLm.visibility ?? 0) < 0.4) continue

      drawArrow(
        ctx,
        userLm.x * width, userLm.y * height,
        refLm.x * width,  refLm.y * height,
      )
    }
  }

  ctx.restore()
}

/**
 * Renders a minimal ghost skeleton WITHOUT the user's skeleton — used for
 * the static reference preview in calibration explain view.
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
  ctx.lineWidth = 3
  ctx.strokeStyle = 'rgba(34,197,94,0.90)'

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
    ctx.beginPath()
    ctx.arc(lm.x * width, lm.y * height, 5, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(34,197,94,0.85)'
    ctx.fill()
  }

  ctx.restore()
}

// ── Arrow helper ──────────────────────────────────────────────────────────────

function drawArrow(
  ctx: CanvasRenderingContext2D,
  fromX: number, fromY: number,
  toX: number,   toY: number,
): void {
  const dx = toX - fromX
  const dy = toY - fromY
  const dist = Math.sqrt(dx * dx + dy * dy)
  if (dist < 8) return   // too close — no arrow needed

  // Shorten the arrow so it ends near (not at) the reference landmark
  const scale = Math.min(1, (dist - 12) / dist)
  const endX = fromX + dx * scale
  const endY = fromY + dy * scale

  const headLen = 10
  const angle   = Math.atan2(dy, dx)

  ctx.save()
  ctx.strokeStyle = ARROW_COLOR
  ctx.fillStyle   = ARROW_COLOR
  ctx.lineWidth   = 2.5
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
