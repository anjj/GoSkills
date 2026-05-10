import { describe, it, expect } from 'vitest';
import { CATEGORIES, Category } from '../src/types';

describe('types module', () => {
  it('exports the expected list of categories', () => {
    expect(CATEGORIES).toEqual(['Ventas', 'Operaciones', 'Onboarding', 'Tecnología', 'RRHH']);
  });

  it('has 5 categories', () => {
    expect(CATEGORIES).toHaveLength(5);
  });

  it('category values are assignable to Category type', () => {
    const ventas: Category = 'Ventas';
    const tech: Category = 'Tecnología';
    expect(ventas).toBe('Ventas');
    expect(tech).toBe('Tecnología');
  });
});
