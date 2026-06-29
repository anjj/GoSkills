import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LandingPage from '../src/components/LandingPage';

describe('LandingPage', () => {
  it('renders the landing page basic layout', () => {
    const { container } = render(<LandingPage onLogin={() => {}} />);
    // Check if the component renders a main container
    expect(container.firstChild).toBeInTheDocument();
    
    // We expect a skeleton or basic layout for Phase 1
    // Let's check for a specific data-testid to represent the basic layout
    expect(screen.getByTestId('landing-page-container')).toBeInTheDocument();
  });
});
