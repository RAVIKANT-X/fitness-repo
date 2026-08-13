export type { CameraFacing, CameraStatus, CameraError, StartCameraResult } from './cameraTypes'
export { isCameraSupported, startCamera, stopCamera, switchCamera } from './cameraService'
export type { HumanDetectionState, HumanDetectionResult } from './humanDetection'
export { detectHuman, validateExerciseLandmarks } from './humanDetection'
export type { HumanSceneStatus, HumanSceneValidation } from './humanValidation'
export {
  validateHumanScene,
  ValidationSmoother,
  getValidationTtsMessage,
  EXERCISE_LANDMARKS,
  STABLE_FRAMES,
} from './humanValidation'
