# FitCoach AI

### AI-Powered Fitness, Posture & Movement Coach

FitCoach AI is a mobile-first AI fitness and posture coaching application that uses computer vision to understand human movement in real time.

The application uses **MediaPipe Pose Landmarker** to track 33 body landmarks, analyze biomechanics and movement phases, compare the user's movement against reference poses, and provide real-time visual and voice coaching.

FitCoach is designed to go beyond simple repetition counting by building a movement profile for the user and providing personalized form feedback.

---

## What FitCoach AI Does

- Real-time human pose tracking
- 33-point body landmark detection
- Exercise-specific movement analysis
- Step-by-step exercise guidance
- Learn First calibration mode
- User movement calibration
- True Reference comparison
- Ghost/reference skeleton synchronization
- Joint-angle analysis
- Movement trajectory tracking
- Repetition tracking
- Form deviation detection
- Real-time visual feedback
- Text-to-speech coaching
- Multiple-person rejection
- Non-human scene rejection
- Scan Your Space
- Workspace/posture analysis
- Personalized progress tracking
- Exercise history
- Streak and overall performance score

---

# System Architecture

```text
                         USER
                          │
                          ▼
                   FITCOACH AI APP
                          │
                          ▼
                    DEVICE CAMERA
                          │
                          ▼
                 HUMAN VALIDATION
                          │
                 ┌────────┴────────┐
                 │                 │
             0 humans           2+ humans
                 │                 │
              REJECT              REJECT
                 │
                 ▼
             1 HUMAN
                 │
                 ▼
        MediaPipe Pose Landmarker
                 │
                 ▼
           33 Body Landmarks
                 │
                 ▼
        Landmark Quality Filter
                 │
                 ▼
          Temporal Smoothing
                 │
                 ▼
       Body-Relative Normalization
                 │
                 ▼
        Movement Phase Detection
                 │
                 ▼
        Biomechanical Analysis
                 │
          ┌──────┴────────┐
          ▼               ▼
   True Reference    User Calibration
          │               │
          └───────┬───────┘
                  ▼
         Movement Comparison
                  │
                  ▼
        Form Deviation Engine
                  │
          ┌───────┴────────┐
          ▼                ▼
   Visual Feedback    Voice Coaching



User taps "Scan Your Space"
          ↓
Front camera opens
          ↓
Live camera preview
          ↓
User does nothing
          ↓
App waits for a suitable frame
          ↓
Automatically captures ONE frame
          ↓
AI analyzes the environment
          ↓
Workspace/posture suggestions
          ↓
Suggestions appear as camera overlays



Learn First & Calibration

Before starting a live exercise session, FitCoach can guide the user through the movement step by step.

USER SELECTS EXERCISE
        ↓
LEARN FIRST
        ↓
STEP 1
        ↓
USER PERFORMS STEP
        ↓
33 LANDMARKS TRACKED
        ↓
MOVEMENT PROFILE CREATED
        ↓
STEP 2
        ↓
...
        ↓
CALIBRATION COMPLETE
        ↓
LIVE PRACTICE

Users can skip individual calibration steps when necessary.

Each calibrated movement can contain:

Joint angles
Landmark relationships
Movement phase
Trajectory
Timing
Stability
Range of motion
Confidence
Body-relative coordinates
True Reference

FitCoach uses a True Reference movement as the ideal movement target.

During a live exercise:

LIVE USER MOVEMENT
        │
        ├───────────────► USER CALIBRATION
        │
        └───────────────► TRUE REFERENCE
                                │
                                ▼
                         DEVIATION ANALYSIS

The system compares movements phase-by-phase instead of simply comparing individual frames.

For example:

LIVE DESCENT
      ↕
REFERENCE DESCENT

LIVE BOTTOM
      ↕
REFERENCE BOTTOM

LIVE ASCENT
      ↕
REFERENCE ASCENT

This allows the reference ghost to remain synchronized with the user's actual movement.

Movement Tracking

FitCoach uses a multi-stage movement tracking pipeline.

33 LANDMARKS
      ↓
CONFIDENCE FILTERING
      ↓
TEMPORAL SMOOTHING
      ↓
BODY NORMALIZATION
      ↓
TRAJECTORY TRACKING
      ↓
JOINT ANGLES
      ↓
MOVEMENT PHASE
      ↓
EXERCISE-SPECIFIC ANALYSIS
