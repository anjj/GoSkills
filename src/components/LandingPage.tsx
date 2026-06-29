import React from 'react';

export default function LandingPage({ onLogin, authError }: { onLogin: () => void, authError?: string | null }) {
  return (
    <div data-testid="landing-page-container" className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 space-y-12">
      <div className="max-w-4xl text-center space-y-6">
        <h1 className="text-4xl md:text-6xl font-black text-gray-900 tracking-tight">
          Bienvenido a <span className="text-brand">GoSkills</span>
        </h1>
        <p className="text-xl text-gray-600 font-medium">
          La plataforma de conocimiento de nuestra empresa.
        </p>
      </div>
      
      <div className="max-w-3xl text-center space-y-4">
        <h2 className="text-2xl md:text-3xl font-bold text-gray-800">
          El "Udemy" para tus guías corporativas
        </h2>
        <p className="text-lg text-gray-500">
          Explora píldoras de video creadas por expertos internos para ayudarte en tu desarrollo profesional y procesos de onboarding.
        </p>
      </div>

      {authError && <div className="mt-8 text-red-500 font-medium">{authError}</div>}
    </div>
  );
}
