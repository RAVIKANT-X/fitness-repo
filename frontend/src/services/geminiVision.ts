/**
 * Gemini Vision Service — calls Google Gemini 1.5 Flash vision API
 * directly from the browser using the existing VITE_GEMINI_KEY.
 *
 * Returns structured coaching tips designed for a swipeable flashcard UI.
 */

// ── Public types ──────────────────────────────────────────────────────────────

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
  if (!apiKey) {
    throw new Error('VITE_GEMINI_KEY is not configured. Add it to frontend/.env.local.')
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
