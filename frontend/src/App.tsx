import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/layout/Layout'
import HomePage from './pages/HomePage'
import ExerciseSelectionPage from './pages/ExerciseSelectionPage'
import LiveWorkoutPage from './pages/LiveWorkoutPage'
import SessionSummaryPage from './pages/SessionSummaryPage'
import ProgressPage from './pages/ProgressPage'
import ProfilePage from './pages/ProfilePage'
import { ExerciseProvider } from './hooks/useSelectedExercise'

export default function App() {
  return (
    <ExerciseProvider>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/exercises" element={<ExerciseSelectionPage />} />
          <Route path="/workout" element={<LiveWorkoutPage />} />
          <Route path="/session-summary" element={<SessionSummaryPage />} />
          <Route path="/progress" element={<ProgressPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          {/* Catch-all: redirect unknown routes to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
    </ExerciseProvider>
  )
}
