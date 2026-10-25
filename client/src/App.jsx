import { useEffect } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router';
import { useAuth } from './store/auth.js';
import { Toaster, Spinner } from './components/ui.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Setup from './pages/Setup.jsx';
import LessonPlayer from './pages/LessonPlayer.jsx';
import Sandbox from './pages/Sandbox.jsx';
import Dashboard from './pages/teacher/Dashboard.jsx';
import Courses from './pages/teacher/Courses.jsx';
import CourseEditor from './pages/teacher/CourseEditor.jsx';
import LessonStudio from './pages/teacher/LessonStudio.jsx';
import Students from './pages/teacher/Students.jsx';
import StudentDetail from './pages/teacher/StudentDetail.jsx';
import Payments from './pages/teacher/Payments.jsx';
import Questions from './pages/teacher/Questions.jsx';
import Settings from './pages/teacher/Settings.jsx';
import Requests from './pages/teacher/Requests.jsx';
import StudentHome from './pages/student/StudentHome.jsx';
import CourseView from './pages/student/CourseView.jsx';
import MyQuestions from './pages/student/MyQuestions.jsx';
import SkillMap from './pages/student/SkillMap.jsx';

function RequireAuth() {
  const user = useAuth((s) => s.user);
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}

function TeacherOnly({ children }) {
  const user = useAuth((s) => s.user);
  return user.role === 'teacher' ? children : <Navigate to="/" replace />;
}

function ByRole({ teacher, student }) {
  const user = useAuth((s) => s.user);
  return user.role === 'teacher' ? teacher : student;
}

export default function App() {
  const { ready, user, init } = useAuth();

  useEffect(() => {
    init();
  }, [init]);

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="size-8" />
      </div>
    );
  }

  return (
    <>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/setup" element={user ? <Navigate to="/" replace /> : <Setup />} />
        <Route element={<RequireAuth />}>
          <Route path="/lessons/:id" element={<LessonPlayer />} />
          <Route element={<Layout />}>
            <Route index element={<ByRole teacher={<Dashboard />} student={<StudentHome />} />} />
            <Route path="courses" element={<TeacherOnly><Courses /></TeacherOnly>} />
            <Route path="courses/:id" element={<ByRole teacher={<CourseEditor />} student={<CourseView />} />} />
            <Route path="lessons/:id/studio" element={<TeacherOnly><LessonStudio /></TeacherOnly>} />
            <Route path="students" element={<TeacherOnly><Students /></TeacherOnly>} />
            <Route path="students/:id" element={<TeacherOnly><StudentDetail /></TeacherOnly>} />
            <Route path="requests" element={<TeacherOnly><Requests /></TeacherOnly>} />
            <Route path="payments" element={<TeacherOnly><Payments /></TeacherOnly>} />
            <Route path="questions" element={<TeacherOnly><Questions /></TeacherOnly>} />
            <Route path="settings" element={<TeacherOnly><Settings /></TeacherOnly>} />
            <Route path="skills" element={<SkillMap />} />
            <Route path="my-questions" element={<MyQuestions />} />
            <Route path="sandbox" element={<Sandbox />} />
            <Route path="sandbox/:id" element={<Sandbox />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
    </>
  );
}
