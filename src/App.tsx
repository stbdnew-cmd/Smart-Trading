import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LangProvider } from './context/LangContext';
import MobileBottomNav from './components/MobileBottomNav';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

function AppContent() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <main className="flex-1 pb-16 md:pb-0">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
      <MobileBottomNav />
    </div>
  );
}

export default function App() {
  return (
    <LangProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </LangProvider>
  );
}
