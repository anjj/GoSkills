import React from 'react';
import { motion } from 'motion/react';

function MicrosoftIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 21 21" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
      <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
      <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
    </svg>
  );
}

export function LandingPage({ onLogin, authError }: { onLogin: () => void, authError?: string | null }) {
  return (
    <div data-testid="landing-page-container" className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 space-y-16 overflow-hidden relative">
      {/* Background decoration */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-brand/5 blur-3xl rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-500/5 blur-3xl rounded-full pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-4xl text-center space-y-6 z-10"
      >
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.5, ease: "easeOut" }}
          className="flex justify-center mb-8"
        >
          <img src="/logo.png" alt="golive" className="h-16 md:h-20 w-auto object-contain drop-shadow-sm" />
        </motion.div>
        <h1 className="text-5xl md:text-7xl font-black text-gray-900 tracking-tight leading-[1.1]">
          Bienvenido a <span className="text-brand">GoSkills</span>
        </h1>
        <p className="text-xl md:text-2xl text-gray-600 font-medium max-w-2xl mx-auto leading-relaxed">
          La plataforma de conocimiento de nuestra empresa.
        </p>
      </motion.div>
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-3xl text-center space-y-6 z-10 bg-white/50 backdrop-blur-sm p-8 md:p-12 rounded-3xl border border-white/20 shadow-xl shadow-gray-200/50"
      >
        <h2 className="text-2xl md:text-3xl font-bold text-gray-800 tracking-tight">
          El "Udemy" para tus guías corporativas
        </h2>
        <p className="text-lg md:text-xl text-gray-500 leading-relaxed">
          Explora píldoras de video creadas por expertos internos para ayudarte en tu desarrollo profesional y procesos de onboarding.
        </p>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="pt-8 z-10"
      >
        <button
          onClick={onLogin}
          className="group flex items-center justify-center gap-4 bg-gray-900 hover:bg-black text-white py-4 px-10 rounded-2xl font-bold transition-all duration-300 shadow-2xl shadow-gray-900/20 hover:shadow-gray-900/40 active:scale-[0.98] hover:-translate-y-1"
        >
          <MicrosoftIcon className="w-6 h-6 group-hover:scale-110 transition-transform duration-300" />
          <span className="text-lg">Acceso con Microsoft</span>
        </button>
      </motion.div>

      {authError && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mt-8 px-6 py-4 bg-red-50 text-red-600 font-medium rounded-xl border border-red-100 shadow-sm z-10"
        >
          {authError}
        </motion.div>
      )}
    </div>
  );
}
