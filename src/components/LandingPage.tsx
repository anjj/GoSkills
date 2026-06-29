import React from 'react';

export default function LandingPage({ onLogin, authError }: { onLogin: () => void, authError?: string | null }) {
  return (
    <div data-testid="landing-page-container" className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
      {/* Skeleton / Basic layout for Phase 1 */}
      <h1>Landing Page</h1>
      {authError && <div className="text-red-500">{authError}</div>}
    </div>
  );
}
