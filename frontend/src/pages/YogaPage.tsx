import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  Clock3,
  Play,
  RotateCcw,
  Sparkles,
  Trophy,
  XCircle,
} from 'lucide-react'
import CameraView from '../components/workout/CameraView'
import PoseOverlay from '../components/workout/PoseOverlay'
import { YOGA_POSES, type YogaPoseId } from '../features/yoga/yogaPoseDefinitions'
import { evaluateYogaPose } from '../features/yoga/yogaEvaluator'
import { useCamera } from '../hooks/useCamera'
import { usePoseLandmarker } from '../hooks/usePoseLandmarker'

function formatHoldTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export default function YogaPage() {
  const navigate = useNavigate()
  const { videoRef, status, error, facing, isActive, start, stop, switchCamera } = useCamera()
  const { modelStatus, poses, startLoop, stopLoop } = usePoseLandmarker()
  const canvasRef = useRef<HTMLCanvasElement>(null!)

  const [selectedPoseId, setSelectedPoseId] = useState<YogaPoseId>('tree-pose')
  const [isSessionRunning, setIsSessionRunning] = useState(false)
  const [holdSeconds, setHoldSeconds] = useState(0)
  const [holdActive, setHoldActive] = useState(false)
  const [sessionScore, setSessionScore] = useState(0)

  const selectedPose = useMemo(
    () => YOGA_POSES.find((pose) => pose.id === selectedPoseId) ?? YOGA_POSES[0],
    [selectedPoseId],
  )

  const evaluation = useMemo(
    () => evaluateYogaPose(poses[0]?.landmarks ?? [], selectedPoseId),
    [poses, selectedPoseId],
  )

  const correctStreakRef = useRef(0)

  useEffect(() => {
    if (!isSessionRunning || !isActive) return

    if (evaluation.isCorrect) {
      correctStreakRef.current += 1
      if (correctStreakRef.current >= 3) {
        setHoldActive(true)
      }
    } else {
      correctStreakRef.current = 0
      setHoldActive(false)
    }
  }, [evaluation.isCorrect, isActive, isSessionRunning])

  useEffect(() => {
    if (!isSessionRunning || !isActive || !holdActive) return

    const timer = window.setInterval(() => {
      setHoldSeconds((prev) => prev + 1)
    }, 1000)

    return () => window.clearInterval(timer)
  }, [holdActive, isActive, isSessionRunning])

  useEffect(() => {
    if (!isSessionRunning) return

    const nextScore = Math.min(
      100,
      Math.round((evaluation.confidence * 0.75) + (evaluation.isCorrect ? 20 : 0) + (holdActive ? 5 : 0)),
    )
    setSessionScore(nextScore)
  }, [evaluation.confidence, evaluation.isCorrect, holdActive, isSessionRunning])

  const handleStartCamera = async () => {
    setIsSessionRunning(true)
    if (!isActive) {
      await start('user')
    }
  }

  const handleEndSession = () => {
    setIsSessionRunning(false)
    setHoldActive(false)
    correctStreakRef.current = 0
    setHoldSeconds(0)
    setSessionScore(0)
    stop()
    stopLoop()
  }

  const handleFlipCamera = async () => {
    if (isActive) {
      await switchCamera()
    }
  }

  const handlePoseSelect = (poseId: YogaPoseId) => {
    setSelectedPoseId(poseId)
    setHoldSeconds(0)
    setHoldActive(false)
    correctStreakRef.current = 0
    setSessionScore(0)
  }

  return (
    <div className="space-y-4 pb-6">
      <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface p-3 shadow-card">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-3 py-2 text-xs font-semibold text-slate-600"
        >
          <ArrowLeft size={14} />
          Back
        </button>
        <div className="flex items-center gap-2 text-right">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Sparkles size={18} className="text-primary" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">AI Posture Sense</p>
            <p className="text-sm font-bold text-slate-800">Yoga Detection</p>
          </div>
        </div>
      </div>

      <div className="rounded-3xl bg-surface p-3 shadow-card border border-border">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="text-base font-bold text-slate-800">Choose Your Pose</h2>
          <span className="text-[10px] uppercase tracking-[0.18em] text-slate-400">7 poses</span>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {YOGA_POSES.map((pose) => {
            const isSelected = pose.id === selectedPoseId
            return (
              <button
                key={pose.id}
                type="button"
                onClick={() => handlePoseSelect(pose.id)}
                className={[
                  'rounded-2xl border p-3 text-left transition-all',
                  isSelected
                    ? 'border-primary bg-primary-light shadow-sm'
                    : 'border-border bg-white hover:border-slate-300',
                ].join(' ')}
              >
                <div className="text-2xl mb-2">{pose.image}</div>
                <p className="text-xs font-bold text-slate-800">{pose.name}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{pose.sanskrit}</p>
              </button>
            )
          })}
        </div>
      </div>

      <div className="rounded-3xl bg-surface p-3 shadow-card border border-border">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Selected Pose</p>
            <h3 className="text-lg font-bold text-slate-900">{selectedPose.name}</h3>
          </div>
          <div className="rounded-full bg-primary-light px-2.5 py-1 text-[10px] font-semibold text-primary">
            {selectedPose.sanskrit}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-slate-950">
          <CameraView
            videoRef={videoRef}
            status={status}
            error={error}
            facing={facing}
          >
            <PoseOverlay
              canvasRef={canvasRef}
              videoRef={videoRef}
              facing={facing}
              modelStatus={modelStatus}
              poses={poses}
              startLoop={startLoop}
              stopLoop={stopLoop}
              isActive={isActive}
            />
          </CameraView>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-3">
          <div className="rounded-2xl bg-white p-3 border border-border">
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Confidence</p>
            <p className="mt-1 text-xl font-black text-slate-900">{evaluation.confidence}%</p>
          </div>
          <div className="rounded-2xl bg-white p-3 border border-border">
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Status</p>
            <p className={`mt-1 text-lg font-bold ${evaluation.isCorrect ? 'text-emerald-600' : 'text-amber-600'}`}>
              {evaluation.status}
            </p>
          </div>
          <div className="rounded-2xl bg-white p-3 border border-border">
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Hold Time</p>
            <p className="mt-1 text-xl font-black text-slate-900 tabular-nums">{formatHoldTime(holdSeconds)}</p>
          </div>
        </div>

        <div className="mt-3 rounded-2xl bg-slate-50 border border-border p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Session Score</p>
            <div className="flex items-center gap-1 text-primary">
              <Trophy size={14} />
              <span className="text-sm font-bold text-slate-800">{sessionScore}/100</span>
            </div>
          </div>
          <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-primary transition-all"
              style={{ width: `${sessionScore}%` }}
            />
          </div>
        </div>

        <div className="mt-3 rounded-2xl border border-border bg-white p-3">
          <div className="flex items-center gap-2 mb-2">
            {evaluation.isCorrect ? (
              <CheckCircle2 size={18} className="text-emerald-600" />
            ) : (
              <XCircle size={18} className="text-amber-600" />
            )}
            <p className="text-sm font-bold text-slate-800">Feedback</p>
          </div>
          <p className="text-sm leading-relaxed text-slate-600">{evaluation.feedback}</p>
        </div>

        <div className="flex flex-wrap gap-2 mt-3">
          <button
            type="button"
            onClick={handleStartCamera}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm"
          >
            <Camera size={16} />
            {isActive ? 'Camera Active' : 'Start Camera'}
          </button>
          <button
            type="button"
            onClick={handleFlipCamera}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
          >
            <RotateCcw size={16} />
            Flip
          </button>
          <button
            type="button"
            onClick={handleEndSession}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
          >
            <Clock3 size={16} />
            End Session
          </button>
        </div>
      </div>

      <div className="rounded-3xl bg-surface p-3 shadow-card border border-border">
        <div className="flex items-center gap-2 mb-2">
          <Play size={16} className="text-primary" />
          <h3 className="text-base font-bold text-slate-800">Pose Guidance</h3>
        </div>
        <ul className="space-y-2 text-sm text-slate-600">
          {selectedPose.instructions.map((instruction) => (
            <li key={instruction} className="flex gap-2">
              <span className="mt-1 h-2 w-2 rounded-full bg-primary shrink-0" />
              <span>{instruction}</span>
            </li>
          ))}
        </ul>

        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Common Mistakes</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {selectedPose.commonMistakes.map((mistake) => (
              <li key={mistake} className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                {mistake}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
