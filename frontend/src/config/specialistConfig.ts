/**
 * specialistConfig.ts
 *
 * Centralized configuration for the Specialist contact list.
 *
 * IMPORTANT: These are demo/placeholder entries.
 * Replace phone numbers and details with real values when deploying.
 * All phone numbers are clearly marked as placeholders.
 *
 * To update: change only this file — no UI changes required.
 */

export interface SpecialistEntry {
  id: string
  name: string
  specialization: string
  phone: string   // tel: link format e.g. "+10000000001"
  email?: string
  description: string
  /** Visual accent for the card */
  accent: 'rose' | 'blue' | 'emerald' | 'violet' | 'amber'
  /** Badge label, e.g. "FITNESS", "PHYSIO" */
  badge: string
}

/**
 * PLACEHOLDER NUMBERS — Replace before production deployment.
 *
 * Format: international E.164 (+ country code + number)
 * Example real format: "+447911123456" for a UK number
 *
 * Do NOT use these numbers as real contacts.
 */
const DEMO_NOTICE = '(Demo — not a real number)'

export const SPECIALISTS: SpecialistEntry[] = [
  {
    id: 'fitness-1',
    name: 'Certified Fitness Coach',
    specialization: 'Strength & Conditioning',
    phone: '+10000000001',
    description: `General strength training, exercise programme design, and
      movement quality coaching for all levels. ${DEMO_NOTICE}`,
    accent: 'emerald',
    badge: 'FITNESS',
  },
  {
    id: 'physio-1',
    name: 'Physiotherapist',
    specialization: 'Movement Rehabilitation',
    phone: '+10000000002',
    description: `Assessment and rehabilitation of movement-related issues.
      Consult before resuming exercise after injury or surgery. ${DEMO_NOTICE}`,
    accent: 'blue',
    badge: 'PHYSIO',
  },
  {
    id: 'sports-med-1',
    name: 'Sports Medicine Specialist',
    specialization: 'Sports Medicine',
    phone: '+10000000003',
    description: `Medical assessment for sports-related conditions.
      Injury prevention and return-to-sport protocols. ${DEMO_NOTICE}`,
    accent: 'rose',
    badge: 'MEDICAL',
  },
  {
    id: 'nutrition-1',
    name: 'Sports Nutritionist',
    specialization: 'Sports Nutrition',
    phone: '+10000000004',
    description: `Evidence-based nutrition guidance to support your
      training goals and recovery. ${DEMO_NOTICE}`,
    accent: 'amber',
    badge: 'NUTRITION',
  },
]
