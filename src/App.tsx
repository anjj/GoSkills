/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, signIn, logout } from './lib/firebase';
import { LogIn, LogOut, LayoutDashboard, User as UserIcon, Settings, Search, CheckCircle, Clock, Plus, Menu, X } from 'lucide-react';
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
      {/* Mortarboard Cap Top - Shifted slightly right to balance tassel */}
      <path 
        d="M51 10L11 35L51 60L91 35L51 10Z" 
        className="fill-brand"
      />
      {/* Tassel */}
      <path 
        d="M16 38V55C16 55 13 58 13 62C13 66 16 68 16 68C16 68 19 66 19 62C19 58 16 55 16 55" 
        className="fill-brand"
      />
      {/* Bottom Square/Book Part */}
      <path 
        d="M26 45V80C26 85 31 90 36 90H66C71 90 76 85 76 80V45" 
        className="stroke-brand"
        strokeWidth="8"
        strokeLinejoin="round"
      />
      {/* Play Button Triangle */}
      <path 
        d="M43 55L63 65L43 75V55Z" 
        className="fill-brand"
      />
    </svg>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminView, setAdminView] = useState<'list' | 'create'>('list');
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
      <div className="min-h-screen flex flex-col items-center justify-center bg-white px-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-md w-full"
          id="login-container"
        >
          <div className="flex justify-center mb-6" id="logo-container">
            <Logo className="w-24 h-24" />
          </div>
          <h1 className="text-5xl font-display font-bold mb-6 tracking-tighter">
            <span className="text-brand">Go</span>
            <span className="text-black">Skills</span>
          </h1>
          <p className="text-gray-600 mb-10 text-lg max-w-md mx-auto leading-relaxed">
            La plataforma interna de formación para equipos de alto rendimiento.
          </p>
          <button
            onClick={signIn}
            className="w-full flex items-center justify-center gap-3 bg-brand hover:bg-brand/90 text-white py-4 px-6 rounded-lg font-bold transition-all shadow-xl shadow-brand/20 active:scale-[0.98] hover:scale-[1.02]"
          >
            <LogIn size={20} />
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
      <aside className="w-72 bg-white border-r border-gray-100 hidden lg:flex flex-col fixed inset-y-0 z-40">
        <div className="p-8">
          <div className="flex items-center gap-3 mb-12">
            <Logo className="w-10 h-10" />
            <span className="text-2xl font-display font-bold tracking-tighter">
              <span className="text-brand">Go</span>
              <span className="text-black">Skills</span>
            </span>
          </div>

          <nav className="space-y-1">
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
              active={currentView === 'admin'} 
              onClick={() => setCurrentView('admin')}
              icon={<Settings size={20} />}
              label="Administración"
            />
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
                <div className="flex items-center gap-3">
                  <Logo className="w-10 h-10" />
                  <span className="text-2xl font-display font-bold tracking-tighter">
                    <span className="text-brand">Go</span>
                    <span className="text-black">Skills</span>
                  </span>
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
        <header className="h-16 bg-white/80 border-b border-gray-200 flex items-center justify-between px-6 sticky top-0 z-40 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsMenuOpen(true)}
              className="lg:hidden p-2 text-gray-600 hover:text-brand transition-colors"
            >
              <Menu size={24} />
            </button>
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest bg-gray-100 px-4 py-1.5 rounded-full hidden sm:block">
              {currentView === 'dashboard' && 'Explorar Cursos'}
              {currentView === 'profile' && 'Tu Actividad'}
              {currentView === 'admin' && 'Gestión de Contenido'}
              {currentView === 'player' && 'Reproductor'}
            </h2>
          </div>
            <div className="flex items-center gap-4">
            <button 
              onClick={() => {
                setCurrentView('admin');
                if (isAdmin) setAdminView('create');
              }}
              className="hidden sm:flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-brand transition-colors uppercase tracking-widest px-4 py-2 rounded-lg hover:bg-gray-100"
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
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all font-bold text-sm ${
        active 
          ? 'bg-brand text-white shadow-lg shadow-brand/20 scale-[1.02]' 
          : 'text-gray-500 hover:text-brand hover:bg-brand/5'
      }`}
    >
      <span className={active ? 'text-white' : 'text-gray-400'}>
        {icon}
      </span>
      {label}
    </button>
  );
}
