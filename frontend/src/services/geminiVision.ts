/**
 * Gemini Vision Service — calls Google Gemini 1.5 Flash vision API
 * directly from the browser using the existing VITE_GEMINI_KEY.
 *
 * Usage:
 *   const result = await analyseWorkspaceFrame(base64Jpeg)
 *
 * The API key is intentionally client-side here because:
 *   - It is already exposed in the browser bundle via VITE_GEMINI_KEY
 *   - Gemini free-tier quotas are per-user acceptable
 *   - No raw video is transmitted — only a single captured frame
 *
 * Returns a structured GeminiScanResult or throws on network/API failure.
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
  observation: string    // e.g. "Screen appears below eye level"
  suggestion: string     // e.g. "Raise monitor by ~5 cm"
}

export interface GeminiScanResult {
  /** Short overall assessment, 1–2 sentences */
  summary: string
  /** 0–100 overall posture score estimated from image */
  postureScore: number
  /** Per-area posture checks */
  postureIssues: PostureIssue[]
  /** Workspace environment observations */
  spaceObservations: SpaceObservation[]
  /** The single most important action to take right now */
  topAction: string
  /** Activity detected in the image */
  detectedActivity: string
  /**
   * Gemini-level scene validation status.
   *  "valid"               — single person clearly detected, analysis is valid
   *  "invalid_human_scene" — Gemini cannot identify primary user (0+ or 2+ people)
   */
  analysisStatus: 'valid' | 'invalid_human_scene'
}

// ── Prompt ────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are FitCoach AI, an expert posture and workspace wellness coach.

Analyse the provided image of a person at their workspace.

You MUST respond with ONLY valid JSON — no markdown, no code fences, no explanations.
Do NOT include \`\`\`json or any other wrapping.

Respond with this exact JSON structure:
{
  "analysisStatus": "valid",
  "summary": "One or two sentence overall assessment of posture and workspace.",
  "postureScore": 75,
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
  "topAction": "The single most important thing the person should do right now.",
  "detectedActivity": "Sitting at desk"
}

Rules:
- analysisStatus: "valid" if exactly one person is clearly visible; "invalid_human_scene" if no person, multiple people, or the main subject cannot be identified
- postureScore: integer 0–100 based on what you observe; set to 0 if analysisStatus is "invalid_human_scene"
- severity values: "good" | "warning" | "tip"
- postureIssues: analyse head/neck, shoulders, torso/spine, arms/wrists (only include visible areas)
- spaceObservations: note monitor height, lighting, chair, keyboard position, clutter (only what's visible)
- topAction: must be a single, concrete, actionable sentence (not generic)
- If no person is clearly visible OR multiple people are visible, set analysisStatus to "invalid_human_scene", postureScore to 0, and explain in summary
- Do NOT diagnose medical conditions — use coaching language only
- Maximum 4 postureIssues and 4 spaceObservations
- Keep all text concise`

// ── API call ──────────────────────────────────────────────────────────────────

const GEMINI_MODEL = 'gemini-1.5-flash'
const GEMINI_BASE  = 'https://generativelanguage.googleapis.com/v1beta/models'

/**
 * Send a captured JPEG frame (base64, no data-URI prefix) to Gemini Vision.
 * Returns structured coaching result.
 *
 * @param base64Jpeg  Pure base64 string (strip "data:image/jpeg;base64," prefix before passing)
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
      maxOutputTokens: 1024,
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
    return {
      analysisStatus,
      summary:            parsed.summary            ?? 'Analysis complete.',
      postureScore:       analysisStatus === 'invalid_human_scene' ? 0 : clamp(parsed.postureScore ?? 50, 0, 100),
      postureIssues:      Array.isArray(parsed.postureIssues)      ? parsed.postureIssues      : [],
      spaceObservations:  Array.isArray(parsed.spaceObservations)  ? parsed.spaceObservations  : [],
      topAction:          parsed.topAction          ?? '',
      detectedActivity:   parsed.detectedActivity   ?? 'Unknown',
    }
  } catch {
    throw new Error(`Gemini returned non-JSON response: ${cleaned.slice(0, 200)}`)
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(n)))
}
