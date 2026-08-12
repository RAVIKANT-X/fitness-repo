/**
 * Analysis feature — all numeric thresholds for Phase 4.
 *
 * These are initial PROTOTYPE HEURISTICS for a fitness application.
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
 */

// ── Squat thresholds ──────────────────────────────────────────────────────────

export const SQUAT = {
  /**
   * Knee angle above which the person is considered STANDING.
   * ~160° corresponds to near-straight legs.
   *
   * PROTOTYPE HEURISTIC — not medically validated.
   */
  STANDING_ENTER: 160,
  /**
   * Must drop below this to leave STANDING (hysteresis gap of 15°).
   *
   * PROTOTYPE HEURISTIC — not medically validated.
   */
  STANDING_EXIT: 145,

  /**
   * Knee angle below which BOTTOM of squat is confirmed.
   * ~130° allows detection of a partial squat and flags depth separately.
   *
   * PROTOTYPE HEURISTIC — not medically validated.
   */
  BOTTOM_ENTER: 130,
  /**
   * Must rise above this to leave BOTTOM (hysteresis gap of 15°).
   *
   * PROTOTYPE HEURISTIC — not medically validated.
   */
  BOTTOM_EXIT: 145,

  /**
   * Depth deviation: minimum knee angle the user must reach during a rep.
   * If the completed rep never reached this angle, flag DEPTH_TOO_SHALLOW.
   *
   * 128° enters BOTTOM but stays above 115° → DEPTH_TOO_SHALLOW flagged.
   * 108° enters BOTTOM and reaches 108° < 115° → good depth, no flag.
   *
   * PROTOTYPE HEURISTIC — not medically validated.
   */
  MIN_DEPTH_REQUIRED: 115,

  /**
   * Asymmetry deviation: difference between left and right knee angles.
   * > 20° indicates meaningful bilateral imbalance.
   */
  KNEE_ASYMMETRY_THRESHOLD: 20,

  /**
   * Hip asymmetry: difference between left and right hip angles.
   */
  HIP_ASYMMETRY_THRESHOLD: 20,

  /**
   * Minimum landmark visibility score for squat analysis.
   * Lower than the default (0.5) because lower-body landmarks are often
   * partially occluded in typical home workout setups.
   */
  MIN_VISIBILITY: 0.5,
} as const

// ── Push-Up thresholds ────────────────────────────────────────────────────────

export const PUSHUP = {
  /**
   * Elbow angle above which arms are considered fully extended (TOP).
   * ~155° is a slightly soft lock-out, avoiding forced hyperextension.
   */
  TOP_ENTER: 155,
  /** Must drop below this to leave TOP (hysteresis gap of 15°). */
  TOP_EXIT: 140,

  /**
   * Elbow angle below which BOTTOM of push-up is confirmed.
   * ~80° corresponds to good chest-near-floor depth.
   */
  BOTTOM_ENTER: 80,
  /** Must rise above this to leave BOTTOM (hysteresis gap of 15°). */
  BOTTOM_EXIT: 95,

  /**
   * Depth deviation: minimum elbow angle the user must achieve.
   * If a completed rep never reached this angle, flag DEPTH_TOO_SHALLOW.
   */
  MIN_DEPTH_REQUIRED: 90,

  /**
   * Elbow asymmetry: difference between left and right elbow angles.
   */
  ELBOW_ASYMMETRY_THRESHOLD: 20,

  /**
   * Shoulder alignment: shoulder angle (elbow–shoulder–hip) threshold.
   * Should remain close to 180° for neutral shoulder; > 60° indicates flaring.
   */
  SHOULDER_ALIGNMENT_MAX: 60,

  MIN_VISIBILITY: 0.5,
} as const

// ── Curl thresholds ───────────────────────────────────────────────────────────

export const CURL = {
  /**
   * Elbow angle above which arm is considered EXTENDED.
   * ~155° is near-straight arm.
   */
  EXTENDED_ENTER: 155,
  /** Must drop below this to leave EXTENDED (hysteresis gap of 15°). */
  EXTENDED_EXIT: 140,

  /**
   * Elbow angle below which the curl PEAK is confirmed.
   * ~60° corresponds to a solid bicep contraction.
   */
  PEAK_ENTER: 60,
  /** Must rise above this to leave PEAK (hysteresis gap of 15°). */
  PEAK_EXIT: 75,

  /**
   * Incomplete curl: minimum elbow angle the user must reach.
   * If a completed rep never got below this, flag INCOMPLETE_CURL.
   */
  MIN_CURL_REQUIRED: 75,

  /**
   * Incomplete extension: minimum elbow angle on return.
   * If the arm never returned above this, flag INCOMPLETE_EXTENSION.
   */
  MIN_EXTENSION_REQUIRED: 145,

  /**
   * Shoulder movement: how much the shoulder angle (elbow–shoulder–hip)
   * can deviate from the baseline before flagging SHOULDER_MOVEMENT.
   * The baseline is captured at the first EXTENDED frame.
   */
  SHOULDER_MOVEMENT_MAX_DEVIATION: 25,

  /**
   * Minimum elbow-angle delta to recognise an arm as "moving".
   * Used to select the active arm for single-arm curls.
   * If one arm is moving more than this amount, it is the active arm.
   */
  ARM_MOVEMENT_DELTA: 15,

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
