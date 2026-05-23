
import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import { User, UserRole, CategoryItem, Decision, ClassRoom, Student } from './types';
import Dashboard from './views/Dashboard';
import AdminView from './views/AdminView';
import CategoriesView from './views/CategoriesView';
import AssignmentsView from './views/AssignmentsView';
import DecisionsView from './views/DecisionsView';

import StudentsView from './views/StudentsView';
import RegistrationView from './views/RegistrationView';
import PrintTemplatesView from './views/PrintTemplatesView';
import ExamApprovalView from './views/ExamApprovalView';
import GradeEntryView from './views/GradeEntryView';
import LookupView from './views/LookupView';
import StatisticsView from './views/StatisticsView';
import LoginView from './views/LoginView';

// Auth data is now managed via localStorage and actual backend calls

const App: React.FC = () => {
  const [activePath, setActivePath] = useState(() => {
    const path = window.location.pathname;
    if (path === '/' || path === '') return 'public-register';
    if (path.startsWith('/quantri')) {
      const saved = localStorage.getItem('edumaster_path');
      if (saved && saved !== 'public-register' && saved !== 'login') {
         return saved;
      }
      return 'login';
    }
    return 'public-register';
  });
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [prefilledStudent, setPrefilledStudent] = useState<any>(null);

  // One-time Cleanup of obsolete LocalStorage data
  useEffect(() => {
    const isCleaned = localStorage.getItem('edumaster_v2_cleaned');
    if (!isCleaned) {
      const keysToKeep = ['edumaster_path'];
      const keys = Object.keys(localStorage);
      keys.forEach(k => {
        if (!keysToKeep.includes(k) && k.startsWith('edumaster_')) {
          localStorage.removeItem(k);
        }
      });
      localStorage.setItem('edumaster_v2_cleaned', 'true');
      console.log('Obsolete local data cleaned up.');
    }
  }, []);

  // Sync user state whenever path changes (to catch login/logout)
  useEffect(() => {
    const saved = localStorage.getItem('user');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (JSON.stringify(parsed) !== JSON.stringify(currentUser)) {
        setCurrentUser(parsed);
      }
    } else if (currentUser) {
      setCurrentUser(null);
    }
  }, [activePath]);

  const handleNavigate = (path: string) => {
    setActivePath(path);
    localStorage.setItem('edumaster_path', path);
    
    // Update current user from storage immediately on navigation
    const saved = localStorage.getItem('user');
    if (saved) setCurrentUser(JSON.parse(saved));
    else setCurrentUser(null);

    if (path === 'public-register') {
      window.history.pushState({}, '', '/');
    } else {
      if (!window.location.pathname.startsWith('/quantri')) {
         window.history.pushState({}, '', '/quantri');
      }
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('edumaster_path');
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('user');
    setCurrentUser(null);
    setActivePath('login');
    setPrefilledStudent(null);
    window.history.pushState({}, '', '/quantri');
  };

  const handleRegisterAnother = (student: any) => {
    // Clear first so useEffect in StudentsView always re-fires,
    // even when already on the 'students' page.
    setPrefilledStudent(null);
    setTimeout(() => {
      setPrefilledStudent(student);
      handleNavigate('students');
    }, 0);
  };

  const renderContent = () => {
    switch (activePath) {
      case 'dashboard': return <Dashboard />;
      case 'statistics': return <StatisticsView />;
      case 'admin': return <AdminView />;
      case 'categories': return <CategoriesView />;
      case 'print-templates': return <PrintTemplatesView />;
      case 'students': return <StudentsView prefilledStudent={prefilledStudent} onClearPrefill={() => setPrefilledStudent(null)} onRegisterAnother={handleRegisterAnother} />;
      case 'assignments': return <AssignmentsView />;
      case 'decisions': return <DecisionsView mode="OPENING" currentUser={currentUser} />;
      case 'exam-approval': return <ExamApprovalView />;
      case 'grade-entry': return <GradeEntryView />;
      case 'recognition-decisions': return <DecisionsView mode="RECOGNITION" currentUser={currentUser} />;

      case 'lookup': return <LookupView onRegisterAnother={handleRegisterAnother} />;
      case 'public-register': return <RegistrationView onLoginSuccess={() => handleNavigate('dashboard')} initialData={prefilledStudent} />;
      default: return <Dashboard />;
    }
  };

  if (activePath === 'public-register') {
    return <RegistrationView onLoginSuccess={() => handleNavigate('dashboard')} initialData={prefilledStudent} />;
  }

  if (activePath === 'login') {
    return <LoginView onLoginSuccess={() => handleNavigate('dashboard')} />;
  }

  return (
    <Layout
      activePath={activePath}
      onNavigate={handleNavigate}
      currentUser={currentUser || { id: '0', name: 'Guest', username: 'Guest', email: '', role: UserRole.GUEST }}
      onLogout={handleLogout}
    >
      {renderContent()}
    </Layout>
  );
};

export default App;
