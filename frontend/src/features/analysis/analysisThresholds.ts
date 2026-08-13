/**
 * Analysis feature — all numeric thresholds for Phase 4.
 *
 * These are tuned heuristics for a fitness application.
 * They are NOT medically validated values.
 *
 * Centralised here so they can be tuned without touching the engine logic.
 *
 * Naming convention:
 *   <EXERCISE>_<MEASUREMENT>_<DIRECTION/MEANING>
 *
 * Hysteresis pairs (ENTER vs EXIT) prevent oscillation around a threshold:
 *   ENTER: value must cross this to enter a state
 *   EXIT:  value must cross this to leave a state (wider gap = more stable)
 *
 * All values are in degrees.
 *
 * Refinement notes (v2):
 *  - Squat STANDING_ENTER raised to 165° (people often stand with 160-165°)
 *  - Squat BOTTOM_ENTER tightened to 120° (was 130° — reduces false BOTTOM
 *    on partial squats that shouldn't count as depth-confirmed)
 *  - Squat MIN_DEPTH_REQUIRED tightened to 110° (was 115°)
 *  - Squat KNEE/HIP asymmetry thresholds tightened to 15° (was 20°)
 *  - Squat added BACK_LEAN_MAX for forward-lean detection
 *  - PushUp TOP_ENTER raised to 160° (full lock-out required)
 *  - PushUp BOTTOM_ENTER tightened to 70° (was 80° — proper chest depth)
 *  - PushUp ELBOW_ASYMMETRY tightened to 15° (was 20°)
 *  - PushUp added BODY_SAG_MAX for hip-sag detection
 *  - Curl EXTENDED_ENTER lowered slightly to 150° (was 155°) — more forgiving
 *    on full extension for people with limited ROM
 *  - Curl PEAK_ENTER tightened to 55° (was 60°) — full contraction required
 *  - Curl MIN_CURL_REQUIRED tightened to 65° (was 75°)
 *  - Curl ARM_MOVEMENT_DELTA increased to 20° (was 15°) — reduces false arm
 *    selection from subtle resting elbow bend
 *  - Added DWELL_FRAMES_DEPTH: minimum frames to stay at depth before returning
 */

// ── Squat thresholds ──────────────────────────────────────────────────────────

export const SQUAT = {
  /**
   * Knee angle above which the person is considered STANDING.
   * 165° — near-full extension without hyperextension.
   */
  STANDING_ENTER: 165,
  /**
   * Must drop below this to leave STANDING (hysteresis gap of 20°).
   */
  STANDING_EXIT: 145,

  /**
   * Knee angle below which BOTTOM of squat is confirmed.
   * 120° ensures the user has reached a genuine squat depth
   * (was 130° — partial knee bends no longer falsely enter BOTTOM).
   */
  BOTTOM_ENTER: 120,
  /**
   * Must rise above this to leave BOTTOM (hysteresis gap of 20°).
   */
  BOTTOM_EXIT: 140,

  /**
   * Minimum dwell frames at BOTTOM before RETURNING is allowed.
   * Prevents counting a bounce-through as depth.
   * At 30fps this is ~2 frames — just enough to block single-frame glitch.
   */
  DWELL_FRAMES_DEPTH: 2,

  /**
   * Depth deviation: minimum knee angle the user must reach during a rep.
   * If the completed rep never reached 110°, flag DEPTH_TOO_SHALLOW.
   */
  MIN_DEPTH_REQUIRED: 110,

  /**
   * Asymmetry deviation: difference between left and right knee angles.
   * Tightened from 20° to 15° for earlier detection.
   */
  KNEE_ASYMMETRY_THRESHOLD: 15,

  /**
   * Hip asymmetry: difference between left and right hip angles.
   * Tightened from 20° to 15°.
   */
  HIP_ASYMMETRY_THRESHOLD: 15,

  /**
   * Back lean: the hip-to-shoulder angle from vertical.
   * If the torso tilts forward more than this during descent, flag BACK_LEAN.
   * Measured as (shoulder_y - hip_y) / torso_length ratio in the angle evaluator.
   * In degrees: acceptable lean for squats is ~20-30° forward.
   */
  BACK_LEAN_MAX: 45,

  MIN_VISIBILITY: 0.5,
} as const

// ── Push-Up thresholds ────────────────────────────────────────────────────────

export const PUSHUP = {
  /**
   * Elbow angle above which arms are considered fully extended (TOP).
   * 160° — requiring near full lock-out for proper push-up form.
   */
  TOP_ENTER: 160,
  /** Must drop below this to leave TOP (hysteresis gap of 20°). */
  TOP_EXIT: 140,

  /**
   * Elbow angle below which BOTTOM of push-up is confirmed.
   * 70° — proper depth with chest near-floor.
   */
  BOTTOM_ENTER: 70,
  /** Must rise above this to leave BOTTOM (hysteresis gap of 20°). */
  BOTTOM_EXIT: 90,

  /**
   * Minimum dwell frames at BOTTOM before RETURNING is allowed.
   * Prevents bounced/half reps from counting as valid depth.
   */
  DWELL_FRAMES_DEPTH: 2,

  /**
   * Depth deviation: minimum elbow angle the user must achieve.
   */
  MIN_DEPTH_REQUIRED: 85,

  /**
   * Elbow asymmetry: difference between left and right elbow angles.
   * Tightened from 20° to 15°.
   */
  ELBOW_ASYMMETRY_THRESHOLD: 15,

  /**
   * Shoulder alignment: shoulder angle (elbow–shoulder–hip) threshold.
   * Should remain close to 180° for neutral shoulder; > 55° indicates flaring.
   * Tightened from 60° to 55°.
   */
  SHOULDER_ALIGNMENT_MAX: 55,

  /**
   * Body sag detection: hip-to-shoulder line angle from horizontal.
   * If hips drop significantly below shoulder-ankle line, flag BODY_SAG.
   * In normalised coords: hip_y - midpoint(shoulder_y, ankle_y) > threshold.
   */
  BODY_SAG_THRESHOLD: 0.08,

  MIN_VISIBILITY: 0.5,
} as const

// ── Curl thresholds ───────────────────────────────────────────────────────────

export const CURL = {
  /**
   * Elbow angle above which arm is considered EXTENDED.
   * Lowered slightly to 150° to be more forgiving of limited ROM.
   */
  EXTENDED_ENTER: 150,
  /** Must drop below this to leave EXTENDED (hysteresis gap of 15°). */
  EXTENDED_EXIT: 135,

  /**
   * Elbow angle below which the curl PEAK is confirmed.
   * 55° — full bicep contraction required (was 60°).
   */
  PEAK_ENTER: 55,
  /** Must rise above this to leave PEAK (hysteresis gap of 15°). */
  PEAK_EXIT: 70,

  /**
   * Minimum dwell frames at PEAK before RETURNING is allowed.
   */
  DWELL_FRAMES_DEPTH: 1,

  /**
   * Incomplete curl: minimum elbow angle the user must reach.
   * Tightened from 75° to 65° — must curl more fully.
   */
  MIN_CURL_REQUIRED: 65,

  /**
   * Incomplete extension: minimum elbow angle on return.
   * Unchanged — 145° is a good full-extension standard.
   */
  MIN_EXTENSION_REQUIRED: 145,

  /**
   * Shoulder movement: deviation from baseline before flagging.
   * Unchanged — 25° is reasonable for shoulder stability.
   */
  SHOULDER_MOVEMENT_MAX_DEVIATION: 25,

  /**
   * Minimum elbow-angle delta to recognise an arm as "moving".
   * Increased from 15° to 20° — reduces false arm selection from
   * small resting elbow bends.
   */
  ARM_MOVEMENT_DELTA: 20,

  /**
   * Elbow drift detection: if the active elbow moves laterally
   * (away from the torso) during the curl, flag ELBOW_DRIFT.
   * Measured as horizontal distance normalised to torso width.
   */
  ELBOW_DRIFT_MAX: 0.18,

  MIN_VISIBILITY: 0.5,
} as const

// ── General thresholds ────────────────────────────────────────────────────────

export const GENERAL = {
  /**
   * Minimum landmark visibility score for any exercise.
   * Landmarks below this are treated as missing.
   */
  MIN_LANDMARK_VISIBILITY: 0.5,
} as const
