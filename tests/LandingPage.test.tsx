import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LandingPage } from '../src/components/LandingPage';

describe('LandingPage', () => {
  it('renders the landing page basic layout', () => {
    const { container } = render(<LandingPage onLogin={() => {}} />);
    // Check if the component renders a main container
    expect(container.firstChild).toBeInTheDocument();
    
    // We expect a skeleton or basic layout for Phase 1
    // Let's check for a specific data-testid to represent the basic layout
    expect(screen.getByTestId('landing-page-container')).toBeInTheDocument();
  });

  it('renders the Hero section with a welcoming header', () => {
    render(<LandingPage onLogin={() => {}} />);
    expect(screen.getByRole('heading', { name: /Bienvenido a GoSkills/i })).toBeInTheDocument();
    expect(screen.getByText(/La plataforma de conocimiento/i)).toBeInTheDocument();
  });

  it('renders the Product Explanation section', () => {
    render(<LandingPage onLogin={() => {}} />);
    expect(screen.getByText(/El "Udemy" para tus guías corporativas/i)).toBeInTheDocument();
    expect(screen.getByText(/Explora píldoras de video/i)).toBeInTheDocument();
  });

  it('renders the Login Call-to-Action and triggers onLogin', () => {
    const onLoginMock = vi.fn();
    render(<LandingPage onLogin={onLoginMock} />);
    const loginButton = screen.getByRole('button', { name: /Acceso con Microsoft/i });
    expect(loginButton).toBeInTheDocument();
    
    loginButton.click();
    expect(onLoginMock).toHaveBeenCalledTimes(1);
  });
});

