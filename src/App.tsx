import React, { useState } from 'react';
import { AuthProvider, useAuth } from './components/AuthProvider';
import { ErrorBoundary } from './components/ErrorBoundary';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import ProjectDetail from './components/ProjectDetail';
import BackgroundAnimation from './components/BackgroundAnimation';
import { Calendar, LogOut, ChevronDown, User } from 'lucide-react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import clsx from 'clsx';

interface SharedCalendar {
  id: string;
  ownerId: string;
  ownerEmail: string;
  ownerName: string;
}

function AppContent() {
  const { user, loading, signOut } = useAuth();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [sharedCalendars, setSharedCalendars] = useState<SharedCalendar[]>([]);
  const [viewingPersonalUid, setViewingPersonalUid] = useState<string | null>(null);
  const [isCalendarMenuOpen, setIsCalendarMenuOpen] = useState(false);

  React.useEffect(() => {
    if (!user || !user.email) return;

    const q = query(
      collection(db, 'calendar_shares'),
      where('sharedWithEmail', '==', user.email.toLowerCase())
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const shareData: SharedCalendar[] = [];
      snapshot.forEach((doc) => {
        shareData.push({ id: doc.id, ...doc.data() } as SharedCalendar);
      });
      setSharedCalendars(shareData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'calendar_shares');
    });

    return () => unsubscribe();
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="min-h-screen flex flex-col relative">
      <header className="sticky top-0 z-50 bg-white/10 backdrop-blur-xl border-b border-white/20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center cursor-pointer" onClick={() => setSelectedProjectId(null)}>
              <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-widest uppercase">Project Management</h1>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4">
              <span className="hidden sm:inline text-sm text-slate-500 font-medium">{user.email}</span>
              <button
                onClick={signOut}
                className="inline-flex items-center px-3 py-1.5 border border-white/20 text-sm leading-4 font-medium rounded-lg text-slate-600 hover:bg-white/20 hover:text-slate-900 focus:outline-none transition-all"
              >
                <LogOut className="h-4 w-4 mr-2" />
                <span className="hidden xs:inline">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {selectedProjectId === 'personal' ? (
          <div className="space-y-6">
            {(sharedCalendars.length > 0) && (
              <div className="flex justify-end mb-4">
                <div className="relative">
                  <button
                    onClick={() => setIsCalendarMenuOpen(!isCalendarMenuOpen)}
                    className="inline-flex items-center px-4 py-2 glass rounded-xl border border-white/20 text-sm font-bold text-slate-700 hover:bg-white/20 transition-all shadow-sm"
                  >
                    <User className="h-4 w-4 mr-2 text-indigo-500" />
                    {viewingPersonalUid ? (
                      <span>Viewing: {sharedCalendars.find(c => c.ownerId === viewingPersonalUid)?.ownerName}'s Calendar</span>
                    ) : (
                      <span>Viewing: My Calendar</span>
                    )}
                    <ChevronDown className={clsx("ml-2 h-4 w-4 transition-transform", isCalendarMenuOpen && "rotate-180")} />
                  </button>

                  {isCalendarMenuOpen && (
                    <div className="absolute right-0 mt-2 w-64 glass-card rounded-2xl shadow-2xl border border-white/20 overflow-hidden z-50 animate-in slide-in-from-top-2 duration-200 origin-top-right">
                      <div className="p-2 space-y-1">
                        <button
                          onClick={() => {
                            setViewingPersonalUid(null);
                            setIsCalendarMenuOpen(false);
                          }}
                          className={clsx(
                            "w-full text-left px-4 py-2.5 rounded-xl text-sm font-semibold transition-all",
                            !viewingPersonalUid ? "bg-indigo-500/10 text-indigo-600" : "text-slate-600 hover:bg-white/10"
                          )}
                        >
                          My Calendar
                        </button>
                        <div className="h-px bg-white/10 my-1 mx-2"></div>
                        <div className="px-4 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Shared with me</div>
                        {sharedCalendars.map((cal) => (
                          <button
                            key={cal.id}
                            onClick={() => {
                              setViewingPersonalUid(cal.ownerId);
                              setIsCalendarMenuOpen(false);
                            }}
                            className={clsx(
                              "w-full text-left px-4 py-2.5 rounded-xl text-sm font-semibold transition-all",
                              viewingPersonalUid === cal.ownerId ? "bg-indigo-500/10 text-indigo-600" : "text-slate-600 hover:bg-white/10"
                            )}
                          >
                            {cal.ownerName}'s Calendar
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            <ProjectDetail 
              projectId={`personal_${viewingPersonalUid || user.uid}`} 
              isPersonal={true}
              onBack={() => {
                setSelectedProjectId(null);
                setViewingPersonalUid(null);
              }} 
            />
          </div>
        ) : selectedProjectId ? (
          <ProjectDetail 
            projectId={selectedProjectId} 
            onBack={() => setSelectedProjectId(null)} 
          />
        ) : (
          <Dashboard onSelectProject={setSelectedProjectId} />
        )}
      </main>
    </div>
  );
}

export default function App() {
  const path = window.location.pathname;
  if (path.startsWith('/shared/')) {
    const projectId = path.split('/')[2];
    return (
      <ErrorBoundary>
        <BackgroundAnimation />
        <div className="min-h-screen flex flex-col relative">
          <header className="sticky top-0 z-50 bg-white/10 backdrop-blur-xl border-b border-white/20 shadow-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between h-16">
                <div className="flex items-center">
                  <a href="/" className="flex items-center hover:opacity-80 transition-opacity">
                    <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-widest uppercase">Project Management</h1>
                  </a>
                </div>
              </div>
            </div>
          </header>
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
            <ProjectDetail projectId={projectId} readOnly={true} />
          </main>
        </div>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <BackgroundAnimation />
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}

