/**
 * Gemini Vision Service — calls Google Gemini 1.5 Flash vision API
 * directly from the browser using the existing VITE_GEMINI_KEY.
 *
 * Returns structured coaching tips designed for a swipeable flashcard UI.
 */

// ── Public types ──────────────────────────────────────────────────────────────

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

// ── Prompt ────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are FitCoach AI, an expert posture and workspace wellness coach.

Analyse the provided image of a person at their workspace or during an activity.

You MUST respond with ONLY valid JSON — no markdown, no code fences, no explanations.
Do NOT include \`\`\`json or any other wrapping.

Respond with this exact JSON structure:
{
  "analysisStatus": "valid",
  "summary": "One or two sentence overall assessment.",
  "postureScore": 75,
  "detectedActivity": "Sitting at desk",
  "topAction": "The single most important thing to do right now.",
  "postureIssues": [
    {
      "area": "Head / Neck",
      "observation": "Brief description of what you see",
      "suggestion": "Specific actionable coaching tip",
      "severity": "warning"
    }
  ],
  "spaceObservations": [
    {
      "item": "Monitor",
      "observation": "Brief description",
      "suggestion": "Specific suggestion"
    }
  ],
  "flashTips": [
    {
      "category": "posture",
      "headline": "Chin tuck now",
      "detail": "Your head is protruding forward by about 5 cm. This strains the neck extensors and compresses cervical discs.",
      "action": "Pull your chin straight back so your ears align over your shoulders. Hold 5 seconds.",
      "severity": "warning"
    }
  ]
}

Rules for flashTips (MOST IMPORTANT — read carefully):
- Generate 5 to 8 flashTips, ordered from most urgent to least urgent
- category must be one of: "posture" | "space" | "activity" | "quick-win"
- headline: 3–8 words maximum, imperative or noun phrase, e.g. "Raise your screen", "Shoulders back", "Desk lighting fix"
- detail: 1–2 sentences explaining WHY this matters and WHAT you observe
- action: ONE specific concrete action the user can do in 30 seconds
- severity: "good" (they are already doing this well), "warning" (needs correction), "tip" (optional improvement)
- For the detected activity include at least 2 activity-specific tips (e.g. for desk work: eye-strain, wrist angle; for gaming: lumbar support, neck position)
- Always include at least 1 "quick-win" category card (something fixable in under 1 minute)
- Always include at least 1 "good" severity card to acknowledge what is already correct
- Keep all text CONCISE — detail ≤ 40 words, action ≤ 20 words

Rules for other fields:
- analysisStatus: "valid" if exactly one person is clearly visible; "invalid_human_scene" otherwise
- postureScore: integer 0–100; 0 if invalid_human_scene
- severity values: "good" | "warning" | "tip"
- postureIssues: max 4 items
- spaceObservations: max 4 items
- Do NOT diagnose medical conditions — coaching language only`

// ── API call ──────────────────────────────────────────────────────────────────

const GEMINI_MODEL = 'gemini-1.5-flash'
const GEMINI_BASE  = 'https://generativelanguage.googleapis.com/v1beta/models'

/**
 * Send a captured JPEG frame (base64, no data-URI prefix) to Gemini Vision.
 * Returns structured coaching result with flashcard tips.
 */
export async function analyseWorkspaceFrame(base64Jpeg: string): Promise<GeminiScanResult> {
  const apiKey = import.meta.env.VITE_GEMINI_KEY as string | undefined

  // Dev-only diagnostic (never logs the key value)
  console.log('[ScanSpace] Gemini API key configured:', !!apiKey)

  if (!apiKey) {
    throw new Error('AI configuration is missing. Please contact the administrator.')
  }

  const url = `${GEMINI_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`

  const body = {
    contents: [
      {
        parts: [
          { text: SYSTEM_PROMPT },
          {
            inline_data: {
              mime_type: 'image/jpeg',
              data: base64Jpeg,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
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

  // Strip any accidental markdown fences Gemini may add despite instructions
  const cleaned = rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim()

  try {
    const parsed = JSON.parse(cleaned) as Partial<GeminiScanResult>
    const analysisStatus = parsed.analysisStatus === 'invalid_human_scene'
      ? 'invalid_human_scene'
      : 'valid'

    // Normalise flashTips — ensure valid categories and severities
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
      postureScore:      analysisStatus === 'invalid_human_scene' ? 0 : clamp(parsed.postureScore ?? 50, 0, 100),
      postureIssues:     Array.isArray(parsed.postureIssues)     ? parsed.postureIssues     : [],
      spaceObservations: Array.isArray(parsed.spaceObservations) ? parsed.spaceObservations : [],
      topAction:         parsed.topAction          ?? '',
      detectedActivity:  parsed.detectedActivity   ?? 'Unknown',
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
  /** Per-phase reference match data if available */
  phaseMatchData?: Array<{ phase: string; matchScore: number; primaryDeviation?: string }>
}

const WORKOUT_SUMMARY_PROMPT = (data: WorkoutSessionInput) => `You are FitCoach AI, an expert personal trainer and movement analyst.

A user just completed a ${data.exerciseName} workout session. Analyse their performance data and give detailed coaching feedback comparing their movements to the ideal True Reference form.

SESSION DATA:
- Exercise: ${data.exerciseName}
- Reps completed: ${data.repCount}
- Overall form status: ${data.formStatus}
- Duration: ${Math.round(data.durationSeconds)}s
- Average reference match score: ${data.avgMatchScore ?? 'N/A'}%
- Form deviations detected: ${data.deviations.length === 0 ? 'None' : data.deviations.map(d => `${d.id} (${d.severity})`).join(', ')}
${data.phaseMatchData ? `- Phase-by-phase match:\n${data.phaseMatchData.map(p => `  ${p.phase}: ${p.matchScore}% match${p.primaryDeviation ? ` (main issue: ${p.primaryDeviation})` : ''}`).join('\n')}` : ''}

TRUE REFERENCE MOVEMENT STANDARDS for ${data.exerciseName}:
${getTrueReferenceContext(data.exerciseId)}

You MUST respond with ONLY valid JSON — no markdown, no code fences.

Respond with this exact JSON:
{
  "formScore": 78,
  "verdict": "1-2 sentence overall verdict on this session vs ideal True Reference form.",
  "coachingPoints": [
    {
      "area": "Joint/Movement area",
      "observation": "What was observed in this session",
      "correction": "Specific actionable correction for next time",
      "severity": "warning",
      "referenceNote": "Reference ideal: 90° → observed: 72°"
    }
  ],
  "topPriority": "The single most important thing to focus on next session.",
  "positives": ["Something done well", "Another positive"],
  "nextSessionTips": ["Specific drill or cue", "Another tip"]
}

Rules:
- formScore: 0–100 integer reflecting how closely movements matched True Reference
- coachingPoints: 3–5 items; severity must be "good" | "warning" | "critical"
- If no deviations detected, give a high score and mostly "good" severity points
- positives: always include 1–2 genuine positives
- nextSessionTips: 2–3 specific actionable drills or mental cues
- Keep all text concise and coaching-focused
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
