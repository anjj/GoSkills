/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, signIn, logout } from './lib/firebase';
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

function GoogleIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
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
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const response = await fetch('/api/auth/verify-domain', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: currentUser.email })
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

  const handlePlayCourse = (course: Course) => {
    setSelectedCourse(course);
    setCurrentView('player');
  };

  const closeMenu = () => setIsMenuOpen(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-brand/20 border-t-brand rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50/50 px-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-md w-full bg-white p-12 rounded-3xl shadow-2xl shadow-brand/5 border border-gray-100"
          id="login-container"
        >
          <div className="flex justify-center mb-10" id="logo-container">
            <img src="/logo.png" alt="golive" className="h-16 w-auto object-contain" />
          </div>
          <p className="text-gray-500 mb-10 text-lg max-w-sm mx-auto leading-relaxed font-medium">
            making life easier.
          </p>
          <button
            onClick={signIn}
            className="w-full flex items-center justify-center gap-3 bg-gray-900 hover:bg-black text-white py-4 px-6 rounded-xl font-bold transition-all shadow-xl shadow-gray-200 active:scale-[0.98] hover:scale-[1.02]"
          >
            <GoogleIcon />
            Acceso Corporativo
          </button>

          {authError && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-4 p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm font-medium"
            >
              {authError}
            </motion.div>
          )}

          <p className="mt-8 text-xs text-gray-400 uppercase tracking-widest font-medium">
            Solo cuentas corporativas
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar navigation */}
      <aside className="w-72 bg-white border-r border-gray-50 hidden lg:flex flex-col fixed inset-y-0 z-40 shadow-xl shadow-gray-100/50">
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

        <div className="mt-auto p-8 border-t border-gray-50">
          <button 
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2 text-gray-500 hover:text-brand hover:bg-gray-50 rounded-lg transition-colors font-bold text-sm"
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
              className="fixed left-0 top-0 bottom-0 w-80 bg-white z-50 lg:hidden flex flex-col p-8"
            >
              <div className="flex items-center justify-between mb-12">
                <div className="flex items-center gap-3 px-2">
                  <img src="/logo.png" alt="golive" className="h-8 w-auto object-contain" />
                </div>
                <button onClick={closeMenu} className="p-2 text-gray-400 hover:text-gray-900 rounded-lg hover:bg-gray-50">
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

              <div className="mt-auto pt-8 border-t border-gray-50">
                <button
                  onClick={logout}
                  className="w-full flex items-center gap-3 px-4 py-3 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all font-bold"
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
        <header className="h-20 bg-white/80 border-b border-gray-100 flex items-center justify-between px-8 sticky top-0 z-40 backdrop-blur-xl">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsMenuOpen(true)}
              className="lg:hidden p-2 text-gray-400 hover:text-brand transition-colors"
            >
              <Menu size={24} />
            </button>
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] bg-gray-50 px-4 py-2 rounded-lg hidden sm:block border border-gray-100">
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
              className="hidden sm:flex items-center gap-2 text-[10px] font-black text-gray-400 hover:text-brand transition-colors uppercase tracking-[0.2em] px-4 py-2 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-100"
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
              <p className="text-sm font-semibold text-gray-900 leading-none">{user.displayName}</p>
              <p className="text-xs text-gray-500">{user.email}</p>
            </div>
            {user.photoURL && (
              <img src={user.photoURL} alt="User profile" className="w-8 h-8 rounded-full border border-gray-200" />
            )}
            <button
              onClick={logout}
              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
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
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold text-sm ${
        active 
          ? 'bg-brand text-white shadow-xl shadow-brand/10 scale-[1.02]'
          : 'text-gray-400 hover:text-brand hover:bg-brand/5'
      }`}
    >
      <span className={active ? 'text-white' : 'text-gray-400 transition-colors group-hover:text-brand'}>
        {icon}
      </span>
      {label}
    </button>
  );
}
