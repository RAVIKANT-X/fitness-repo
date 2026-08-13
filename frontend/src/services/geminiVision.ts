/**
 * Gemini Vision Service — calls Google Gemini 1.5 Flash vision API
 * directly from the browser using the existing VITE_GEMINI_KEY.
 *
 * Returns structured coaching tips designed for a swipeable flashcard UI.
 */

// ── Public types ──────────────────────────────────────────────────────────────

// ── Posture scan input (replaces image — all on-device data) ─────────────────

export interface PostureScanInput {
  /** Detected activity e.g. "DESK_SITTING", "STANDING" */
  activity: string
  /** Activity label e.g. "Sitting at desk" */
  activityLabel: string
  /** On-device posture score 0–100 (null if not sitting) */
  postureScore: number | null
  /** Per-check coaching results from postureAnalysis.ts */
  postureChecks: Array<{
    label: string
    rating: 'GOOD' | 'FAIR' | 'POOR'
    detail: string
    coaching: string | null
  }>
  /** Whether a single human was confirmed on-device */
  humanDetected: boolean
  /** How many seconds the person has been in this posture (0 if unknown) */
  sessionDurationSeconds: number
}

// ── Workout AI Summary types ───────────────────────────────────────────────────

export interface WorkoutCoachingPoint {
  /** Joint / movement area, e.g. "Left Knee", "Elbow Extension" */
  area: string
  /** What was observed during the session */
  observation: string
  /** Specific coaching correction */
  correction: string
  /** How critical this is */
  severity: 'good' | 'warning' | 'critical'
  /** Reference ideal vs what was observed, e.g. "90° ideal → 72° observed" */
  referenceNote?: string
}

export interface WorkoutAISummary {
  /** Overall 0–100 form score for this session */
  formScore: number
  /** 1–2 sentence overall verdict */
  verdict: string
  /** Per-issue coaching points (3–6 items) */
  coachingPoints: WorkoutCoachingPoint[]
  /** The single most important thing to fix in the next session */
  topPriority: string
  /** 1–2 positive things the user did well */
  positives: string[]
  /** Specific drills / exercises to improve weak areas */
  nextSessionTips: string[]
}

export interface PostureIssue {
  area: string           // e.g. "Head / Neck"
  observation: string    // e.g. "Head leaning forward"
  suggestion: string     // e.g. "Raise your screen to eye level"
  severity: 'good' | 'warning' | 'tip'
}

export interface SpaceObservation {
  item: string           // e.g. "Monitor", "Chair", "Lighting"
  observation: string
  suggestion: string
}

/**
 * A single flashcard tip — shown one card at a time in the swipe deck.
 * Each card has a category, headline, detail and a concrete action.
 */
export interface FlashTip {
  /** Card category for colour coding */
  category: 'posture' | 'space' | 'activity' | 'quick-win'
  /** Short headline shown large on the card (≤ 8 words) */
  headline: string
  /** 1–2 sentence explanation */
  detail: string
  /** Single concrete action the user should do right now */
  action: string
  /** Severity / importance level */
  severity: 'good' | 'warning' | 'tip'
}

export interface GeminiScanResult {
  /** Short overall assessment, 1–2 sentences */
  summary: string
  /** 0–100 overall posture score estimated from image */
  postureScore: number
  /** Per-area posture checks (legacy — kept for compatibility) */
  postureIssues: PostureIssue[]
  /** Workspace environment observations (legacy — kept for compatibility) */
  spaceObservations: SpaceObservation[]
  /** The single most important action to take right now */
  topAction: string
  /** Activity detected in the image */
  detectedActivity: string
  /**
   * Flashcard tips — ordered by priority, ready to swipe through.
   * 5–8 cards covering posture, workspace, activity-specific advice and quick wins.
   */
  flashTips: FlashTip[]
  /**
   * Gemini-level scene validation status.
   *  "valid"               — single person clearly detected, analysis is valid
   *  "invalid_human_scene" — Gemini cannot identify primary user (0+ or 2+ people)
   */
  analysisStatus: 'valid' | 'invalid_human_scene'
}

// ── Text prompt builder for posture scan ─────────────────────────────────────

function buildPostureScanPrompt(input: PostureScanInput): string {
  const checksText = input.postureChecks.length > 0
    ? input.postureChecks.map(c =>
        `  - ${c.label}: ${c.rating}${c.detail ? ` — ${c.detail}` : ''}${c.coaching ? ` | Fix: ${c.coaching}` : ''}`
      ).join('\n')
    : '  - No posture checks available'

  return `You are FitCoach AI, an expert posture and workspace wellness coach.

A user has been scanned using an on-device AI pose tracker (MediaPipe 33-point skeleton). Analyse the SENSOR DATA below and generate coaching tips.

═══════════════════════════════════════
ON-DEVICE SENSOR DATA (no image — landmark-based):
═══════════════════════════════════════
Activity detected:   ${input.activityLabel} (${input.activity})
Session duration:    ${input.sessionDurationSeconds > 0 ? `${Math.round(input.sessionDurationSeconds)}s` : 'Unknown'}
On-device posture score: ${input.postureScore !== null ? `${input.postureScore}/100` : 'N/A (not sitting)'}
Human detected:      ${input.humanDetected ? 'Yes — single person confirmed' : 'No'}

Posture checks (measured from skeleton landmarks):
${checksText}
═══════════════════════════════════════

You MUST respond with ONLY valid JSON — no markdown, no code fences, no explanations.

Respond with this exact JSON structure:
{
  "analysisStatus": "valid",
  "summary": "One or two sentence overall assessment based on the sensor data.",
  "postureScore": 75,
  "detectedActivity": "${input.activityLabel}",
  "topAction": "The single most important thing to do right now.",
  "postureIssues": [
    {
      "area": "Head / Neck",
      "observation": "What the sensor data shows",
      "suggestion": "Specific actionable coaching tip",
      "severity": "warning"
    }
  ],
  "spaceObservations": [
    {
      "item": "Workspace setup",
      "observation": "General tip based on the detected activity",
      "suggestion": "Specific suggestion"
    }
  ],
  "flashTips": [
    {
      "category": "posture",
      "headline": "Chin tuck now",
      "detail": "The sensor detected forward head posture. This strains the neck extensors.",
      "action": "Pull chin straight back so ears align over shoulders. Hold 5 seconds.",
      "severity": "warning"
    }
  ]
}

Rules for flashTips:
- Generate 5 to 8 flashTips ordered from most urgent to least urgent
- Base ALL tips on the sensor data provided above — reference the actual check results
- category must be one of: "posture" | "space" | "activity" | "quick-win"
- headline: 3–8 words maximum
- detail: 1–2 sentences — reference the specific sensor reading (e.g. "The sensor showed POOR shoulder alignment")
- action: ONE specific concrete action the user can do in 30 seconds
- severity: "good" | "warning" | "tip"
- Always include at least 1 "good" severity card for checks that are rated GOOD
- Always include at least 1 "quick-win" card
- Keep all text CONCISE — detail ≤ 40 words, action ≤ 20 words

Rules for other fields:
- analysisStatus: always "valid" (human detection already confirmed on-device)
- postureScore: use the on-device score if provided, otherwise estimate from checks
- Do NOT mention "image" or "photo" — this is sensor/landmark data only
- Do NOT diagnose medical conditions — coaching language only`
}

// ── API call ──────────────────────────────────────────────────────────────────

const GEMINI_MODEL = 'gemini-3.5-flash-lite'
const GEMINI_BASE  = 'https://generativelanguage.googleapis.com/v1beta/models'

/**
 * Analyse posture and activity using TEXT-ONLY Gemini call.
 * Accepts on-device MediaPipe landmark analysis results — NO image sent.
 * Returns structured coaching result with flashcard tips.
 */
export async function analyseWorkspaceFrame(input: PostureScanInput): Promise<GeminiScanResult> {
  const apiKey = import.meta.env.VITE_GEMINI_KEY as string | undefined

  console.log('[ScanSpace] Gemini API key configured:', !!apiKey)

  if (!apiKey) {
    throw new Error('AI configuration is missing. Please contact the administrator.')
  }

  const prompt = buildPostureScanPrompt(input)
  const url = `${GEMINI_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`

  // TEXT ONLY — no inline_data, no image
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.25,
      maxOutputTokens: 1500,
    },
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const err = await response.text().catch(() => response.statusText)
    throw new Error(`Gemini API error ${response.status}: ${err}`)
  }

  const json = await response.json() as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> }
      finishReason?: string
    }>
    error?: { message: string }
  }

  if (json.error) {
    throw new Error(`Gemini error: ${json.error.message}`)
  }

  const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  if (!rawText) {
    throw new Error('Gemini returned an empty response.')
  }

  const cleaned = rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim()

  try {
    const parsed = JSON.parse(cleaned) as Partial<GeminiScanResult>
    const analysisStatus: 'valid' | 'invalid_human_scene' = 'valid' // always valid — human confirmed on-device

    const rawTips: FlashTip[] = Array.isArray(parsed.flashTips) ? parsed.flashTips : []
    const validCategories = new Set(['posture', 'space', 'activity', 'quick-win'])
    const validSeverities = new Set(['good', 'warning', 'tip'])
    const flashTips: FlashTip[] = rawTips.map((t) => ({
      category: validCategories.has(t.category) ? t.category : 'posture',
      headline: t.headline ?? 'Posture tip',
      detail:   t.detail   ?? '',
      action:   t.action   ?? '',
      severity: validSeverities.has(t.severity) ? t.severity : 'tip',
    }))

    return {
      analysisStatus,
      summary:           parsed.summary            ?? 'Analysis complete.',
      postureScore:      clamp(parsed.postureScore ?? (input.postureScore ?? 50), 0, 100),
      postureIssues:     Array.isArray(parsed.postureIssues)     ? parsed.postureIssues     : [],
      spaceObservations: Array.isArray(parsed.spaceObservations) ? parsed.spaceObservations : [],
      topAction:         parsed.topAction          ?? '',
      detectedActivity:  parsed.detectedActivity   ?? input.activityLabel,
      flashTips,
    }
  } catch {
    throw new Error(`Gemini returned non-JSON response: ${cleaned.slice(0, 200)}`)
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(n)))
}

// ── Workout session AI analysis ───────────────────────────────────────────────

export interface WorkoutSessionInput {
  exerciseName: string
  exerciseId: string
  repCount: number
  formStatus: string
  durationSeconds: number
  /** Deviations detected during the session */
  deviations: Array<{ id: string; severity: string }>
  /** Average reference match score 0–100 */
  avgMatchScore?: number
  /**
   * Rich per-rep trackpoint data serialised as text.
   * Includes actual measured joint angles, depth targets, range of motion,
   * and per-rep deviation observations with observed/threshold degrees.
   */
  trackDataText?: string
}

const WORKOUT_SUMMARY_PROMPT = (data: WorkoutSessionInput) => `You are FitCoach AI, an expert personal trainer and movement analyst.

A user just completed a ${data.exerciseName} workout session. Analyse their ACTUAL MEASURED JOINT ANGLE DATA and give precise coaching feedback comparing their movements to the ideal True Reference form standards.

${data.trackDataText ? `═══════════════════════════════════════
ACTUAL TRACKPOINT DATA (real measured joint angles per rep):
═══════════════════════════════════════
${data.trackDataText}
═══════════════════════════════════════` : `SESSION SUMMARY DATA:
- Exercise: ${data.exerciseName}
- Reps completed: ${data.repCount}
- Overall form status: ${data.formStatus}
- Duration: ${Math.round(data.durationSeconds)}s
- Avg reference match: ${data.avgMatchScore ?? 'N/A'}%
- Deviations: ${data.deviations.length === 0 ? 'None' : data.deviations.map(d => `${d.id} (${d.severity})`).join(', ')}`}

TRUE REFERENCE STANDARDS for ${data.exerciseName}:
${getTrueReferenceContext(data.exerciseId)}

You MUST respond with ONLY valid JSON — no markdown, no code fences.

Respond with this exact JSON:
{
  "formScore": 78,
  "verdict": "1-2 sentence overall verdict. Mention specific angles if trackpoint data was provided.",
  "coachingPoints": [
    {
      "area": "Joint/Movement area e.g. Knee Depth",
      "observation": "What the trackpoint data shows — use actual numbers e.g. avg min knee angle was 125° vs target ≤ 110°",
      "correction": "Specific actionable correction referencing the measured angles",
      "severity": "warning",
      "referenceNote": "Reference: ≤ 110° → measured avg: 125°"
    }
  ],
  "topPriority": "The single most important thing based on the angle data.",
  "positives": ["Specific positive based on measured data", "Another positive"],
  "nextSessionTips": ["Specific drill referencing their angle numbers", "Another tip"]
}

Rules:
- formScore: 0–100 based on actual angle data vs True Reference targets
- coachingPoints: 3–6 items; use ACTUAL measured angles in observation and referenceNote fields
- severity must be "good" | "warning" | "critical"
- Reference actual rep numbers when a trend is visible (e.g. "reps 3-5 showed shallower depth")
- If trackDataText was provided, EVERY coachingPoint must reference specific angle measurements
- positives: reference what the data shows was done well
- nextSessionTips: 2–3 drills targeting the weakest angles measured
- Keep text concise; observation ≤ 30 words, correction ≤ 25 words
- Do NOT diagnose injuries or medical conditions`

function getTrueReferenceContext(exerciseId: string): string {
  const contexts: Record<string, string> = {
    squat: `Standing: feet shoulder-width apart, toes slightly out, spine neutral.
Descending: knees tracking over toes, hips hinging back and down, chest up.
Bottom: thighs parallel to floor or below, knees at 90°, weight through heels.
Ascending: drive through heels, knees out, hips and shoulders rise together.`,
    pushup: `Top: arms fully extended, body in straight plank line, hands shoulder-width.
Descending: elbows at 45° to body (not flared), controlled lowering.
Bottom: chest near floor, elbows at ~90°, core tight throughout.
Ascending: push through palms evenly, maintain plank position.`,
    curl: `Extended: arms fully extended, biceps stretched, elbows near torso.
Curling: elbows fixed at sides, forearms supinating, controlled raise.
Peak: full contraction at top, forearms vertical or slightly past, squeeze biceps.
Returning: slow controlled lowering, full extension before next rep.`,
  }
  return contexts[exerciseId] ?? 'Standard exercise form with controlled movement and proper joint alignment.'
}

/**
 * Analyse a completed workout session using Gemini text AI.
 * Compares the user's recorded deviations and match scores against
 * True Reference movement standards for the exercise.
 *
 * No image required — uses text-only prompt with structured workout data.
 */
export async function analyseWorkoutSession(data: WorkoutSessionInput): Promise<WorkoutAISummary> {
  const apiKey = import.meta.env.VITE_GEMINI_KEY as string | undefined

  if (!apiKey) {
    throw new Error('AI configuration is missing. Please contact the administrator.')
  }

  const prompt = WORKOUT_SUMMARY_PROMPT(data)
  const url = `${GEMINI_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 1200 },
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const err = await response.text().catch(() => response.statusText)
    throw new Error(`Gemini API error ${response.status}: ${err}`)
  }

  const json = await response.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    error?: { message: string }
  }

  if (json.error) throw new Error(`Gemini error: ${json.error.message}`)

  const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  if (!rawText) throw new Error('Gemini returned an empty response.')

  const cleaned = rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim()

  try {
    const parsed = JSON.parse(cleaned) as Partial<WorkoutAISummary>
    const validSeverities = new Set(['good', 'warning', 'critical'])

    return {
      formScore:    clamp(parsed.formScore ?? 70, 0, 100),
      verdict:      parsed.verdict ?? 'Session analysis complete.',
      topPriority:  parsed.topPriority ?? '',
      positives:    Array.isArray(parsed.positives) ? parsed.positives : [],
      nextSessionTips: Array.isArray(parsed.nextSessionTips) ? parsed.nextSessionTips : [],
      coachingPoints: Array.isArray(parsed.coachingPoints)
        ? parsed.coachingPoints.map((p) => ({
            area:          p.area ?? 'Movement',
            observation:   p.observation ?? '',
            correction:    p.correction ?? '',
            severity:      validSeverities.has(p.severity ?? '') ? (p.severity as WorkoutCoachingPoint['severity']) : 'warning',
            referenceNote: p.referenceNote,
          }))
        : [],
    }
  } catch {
    throw new Error(`Gemini returned non-JSON: ${cleaned.slice(0, 200)}`)
  }
}
