/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, signInWithMicrosoft, getMicrosoftRedirectResult, logout } from './lib/firebase';
import { LogIn, LogOut, LayoutDashboard, User as UserIcon, Settings, Search, CheckCircle, Clock, Plus, Menu, X, BarChart3 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Dashboard from './components/Dashboard';
import ProfileView from './components/ProfileView';
import AdminPanel from './components/AdminPanel';
import VideoPlayer from './components/VideoPlayer';
import { Course } from './types';

type View = 'dashboard' | 'profile' | 'admin' | 'player';

function Logo({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 100 100" 
      className={className}
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Dynamic Arrow Motif - Symbolizing progress and innovation */}
      <path 
        d="M20 80L80 20M80 20H45M80 20V55"
        className="stroke-brand"
        strokeWidth="12"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Abstract 'G' curve */}
      <path 
        d="M20 40C20 28.9543 28.9543 20 40 20"
        className="stroke-brand/30"
        strokeWidth="12"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MicrosoftIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 21 21" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
      <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
      <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
    </svg>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminView, setAdminView] = useState<'list' | 'create' | 'stats'>('list');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    // Complete any pending Microsoft redirect sign-in. If the redirect flow
    // failed (e.g. token exchange / credential error), surface the real error
    // code instead of the misleading auth/popup-closed-by-user.
    getMicrosoftRedirectResult().catch((error: any) => {
      console.error("Microsoft redirect sign-in failed:", error?.code, error);
      setAuthError(`${error?.code ?? 'auth/error'}: ${error?.message ?? 'Error al iniciar sesión con Microsoft.'}`);
    });

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          // Some federated providers (e.g. a single-tenant Microsoft Entra app)
          // don't return an email claim. Send the providerId so the server can
          // trust an org-restricted provider when no email is present.
          const providerId = currentUser.providerData?.[0]?.providerId ?? null;
          const response = await fetch('/api/auth/verify-domain', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: currentUser.email, providerId })
          });

          const result = await response.json();

          if (result.allowed) {
            setUser(currentUser);
            setAuthError(null);
          } else {
            await logout();
            setAuthError('Tu dominio de correo no tiene acceso a esta plataforma.');
          }
        } catch (error) {
          console.error("Domain verification failed:", error);
          // In case of error, default to allow but log it
          setUser(currentUser);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleMicrosoftSignIn = async () => {
    try {
      setAuthError(null);
      await signInWithMicrosoft();
    } catch (err: any) {
      console.error("Sign in failed:", err);
      setAuthError(err.message || 'Error al iniciar sesión con Microsoft.');
    }
  };

  const handlePlayCourse = (course: Course) => {
    setSelectedCourse(course);
    setCurrentView('player');
  };

  const closeMenu = () => setIsMenuOpen(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-alt flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-brand/20 border-t-brand rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-bg-alt/50 px-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-md w-full bg-bg p-12 rounded-3xl shadow-2xl shadow-brand/5 border border-rule"
          id="login-container"
        >
          <div className="flex justify-center mb-10" id="logo-container">
            <img src="/logo.png" alt="golive" className="h-16 w-auto object-contain" />
          </div>
          <p className="text-ink-soft mb-10 text-lg max-w-sm mx-auto leading-relaxed font-medium">
            making life easier.
          </p>
          <div className="space-y-4">
            <button
              onClick={handleMicrosoftSignIn}
              className="w-full flex items-center justify-center gap-3 bg-ink-strong hover:bg-black text-white py-4 px-6 rounded-[3px] font-bold transition-all shadow-xl shadow-ink/10 active:scale-[0.98] hover:scale-[1.02]"
            >
              <MicrosoftIcon />
              Acceso con Microsoft
            </button>
          </div>

          {authError && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-4 p-4 bg-red-50 border border-red-100 rounded-[3px] text-red-600 text-sm font-medium"
            >
              {authError}
            </motion.div>
          )}

          <p className="mt-8 text-xs text-ink-mute uppercase tracking-widest font-medium">
            Solo cuentas corporativas
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-alt flex">
      {/* Sidebar navigation */}
      <aside className="w-72 bg-bg border-r border-rule-soft hidden lg:flex flex-col fixed inset-y-0 z-40 shadow-xl shadow-ink/5/50">
        <div className="p-8">
          <div className="flex items-center gap-3 mb-16 px-2">
            <img src="/logo.png" alt="golive" className="h-8 w-auto object-contain" />
          </div>

          <nav className="space-y-2">
            <NavItem 
              active={currentView === 'dashboard'} 
              onClick={() => { setCurrentView('dashboard'); setSelectedCourse(null); }}
              icon={<LayoutDashboard size={20} />}
              label="Dashboard"
            />
            <NavItem 
              active={currentView === 'profile'} 
              onClick={() => setCurrentView('profile')}
              icon={<UserIcon size={20} />}
              label="Mi Perfil"
            />
            <NavItem 
              active={currentView === 'admin' && adminView === 'list'}
              onClick={() => {
                setCurrentView('admin');
                setAdminView('list');
              }}
              icon={<Settings size={20} />}
              label="Administración"
            />
            {isAdmin && (
              <>
                <NavItem
                  active={currentView === 'admin' && adminView === 'create'}
                  onClick={() => {
                    setCurrentView('admin');
                    setAdminView('create');
                  }}
                  icon={<Plus size={20} />}
                  label="Crear Nuevo Curso"
                />
                <NavItem
                  active={currentView === 'admin' && adminView === 'stats'}
                  onClick={() => {
                    setCurrentView('admin');
                    setAdminView('stats');
                  }}
                  icon={<BarChart3 size={20} />}
                  label="Estadísticas"
                />
              </>
            )}
          </nav>
        </div>

        <div className="mt-auto p-8 border-t border-rule-soft">
          <button 
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2 text-ink-soft hover:text-brand hover:bg-bg-alt rounded-[3px] transition-colors font-bold text-sm"
          >
            <LogOut size={18} />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeMenu}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 lg:hidden"
            />
            <motion.aside 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 bottom-0 w-80 bg-bg z-50 lg:hidden flex flex-col p-8"
            >
              <div className="flex items-center justify-between mb-12">
                <div className="flex items-center gap-3 px-2">
                  <img src="/logo.png" alt="golive" className="h-8 w-auto object-contain" />
                </div>
                <button onClick={closeMenu} className="p-2 text-ink-mute hover:text-ink-strong rounded-[3px] hover:bg-bg-alt">
                  <X size={24} />
                </button>
              </div>

              <nav className="space-y-2 flex-1">
                <NavItem 
                  active={currentView === 'dashboard'} 
                  onClick={() => { setCurrentView('dashboard'); closeMenu(); }}
                  icon={<LayoutDashboard size={20} />} 
                  label="Dashboard" 
                />
                <NavItem 
                  active={currentView === 'profile'} 
                  onClick={() => { setCurrentView('profile'); closeMenu(); }}
                  icon={<UserIcon size={20} />} 
                  label="Mi Perfil" 
                />
                <NavItem 
                  active={currentView === 'admin'} 
                  onClick={() => { 
                    setCurrentView('admin'); 
                    if (isAdmin) setAdminView('list');
                    closeMenu(); 
                  }}
                  icon={<Settings size={20} />} 
                  label="Panel de Control" 
                />
                {isAdmin && (
                  <>
                    <NavItem
                      active={currentView === 'admin' && adminView === 'create'}
                      onClick={() => {
                        setCurrentView('admin');
                        setAdminView('create');
                        closeMenu();
                      }}
                      icon={<Plus size={20} />}
                      label="Crear Nuevo Curso"
                    />
                    <NavItem
                      active={currentView === 'admin' && adminView === 'stats'}
                      onClick={() => {
                        setCurrentView('admin');
                        setAdminView('stats');
                        closeMenu();
                      }}
                      icon={<BarChart3 size={20} />}
                      label="Estadísticas"
                    />
                  </>
                )}
              </nav>

              <div className="mt-auto pt-8 border-t border-rule-soft">
                <button
                  onClick={logout}
                  className="w-full flex items-center gap-3 px-4 py-3 text-ink-soft hover:text-red-500 hover:bg-red-50 rounded-[3px] transition-all font-bold"
                >
                  <LogOut size={20} />
                  Cerrar Sesión
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <main className="flex-1 lg:ml-72 min-h-screen">
        <header className="h-20 bg-bg/80 border-b border-rule flex items-center justify-between px-8 sticky top-0 z-40 backdrop-blur-xl">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsMenuOpen(true)}
              className="lg:hidden p-2 text-ink-mute hover:text-brand transition-colors"
            >
              <Menu size={24} />
            </button>
            <h2 className="text-[10px] font-black text-ink-mute uppercase tracking-[0.2em] bg-bg-alt px-4 py-2 rounded-[3px] hidden sm:block border border-rule">
              {currentView === 'dashboard' && 'Explorar Cursos'}
              {currentView === 'profile' && 'Tu Actividad'}
              {currentView === 'admin' && 'Gestión de Contenido'}
              {currentView === 'player' && 'Reproductor'}
            </h2>
          </div>
            <div className="flex items-center gap-6">
            <button 
              onClick={() => {
                setCurrentView('admin');
                if (isAdmin) setAdminView('create');
              }}
              className="hidden sm:flex items-center gap-2 text-[10px] font-black text-ink-mute hover:text-brand transition-colors uppercase tracking-[0.2em] px-4 py-2 rounded-[3px] hover:bg-bg-alt border border-transparent hover:border-rule"
            >
              {isAdmin ? (
                <>
                  <Plus size={14} />
                  Crear Curso
                </>
              ) : (
                <>
                  <Settings size={14} />
                  Acceso Admin
                </>
              )}
            </button>
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-ink-strong leading-none">{user.displayName}</p>
              <p className="text-xs text-ink-soft">{user.email}</p>
            </div>
            {user.photoURL && (
              <img src={user.photoURL} alt="User profile" className="w-8 h-8 rounded-full border border-rule" />
            )}
            <button
              onClick={logout}
              className="p-2 text-ink-mute hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
              title="Cerrar Sesión"
            >
              <LogOut size={20} />
            </button>
          </div>
        </header>

        <div className="p-6 max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentView + (selectedCourse?.id || '')}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {currentView === 'dashboard' && <Dashboard onPlay={handlePlayCourse} />}
              {currentView === 'profile' && <ProfileView userId={user.uid} />}
              {currentView === 'admin' && (
                <AdminPanel 
                  isAdmin={isAdmin} 
                  setIsAdmin={setIsAdmin} 
                  view={adminView}
                  onViewChange={setAdminView}
                />
              )}
              {currentView === 'player' && selectedCourse && (
                <VideoPlayer 
                  course={selectedCourse} 
                  onBack={() => setCurrentView('dashboard')} 
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

function NavItem({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: ReactNode, label: string }) {
  return (
    <button
      id="nav-item-button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-[3px] transition-all font-bold text-sm ${
        active 
          ? 'bg-brand text-white shadow-xl shadow-brand/10 scale-[1.02]'
          : 'text-ink-mute hover:text-brand hover:bg-brand/5'
      }`}
    >
      <span className={active ? 'text-white' : 'text-ink-mute transition-colors group-hover:text-brand'}>
        {icon}
      </span>
      {label}
    </button>
  );
}
