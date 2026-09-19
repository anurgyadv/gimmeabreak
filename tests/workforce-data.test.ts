import {it,expect} from 'vitest';
import workforce from '../src/data/workforce.json';
import policies from '../src/data/policies.json';
import {findSwaps,mine} from '../src/lib/workforce-engine';
import type {Workforce,PolicyIndex} from '../src/lib/workforce-types';
it('evaluates actual imported fortnight',()=>{const w=workforce as Workforce;const p=policies as unknown as PolicyIndex;expect(findSwaps(w,p,['2026-09-21']).length).toBeGreaterThan(0);expect(mine(w).length).toBe(9)});
