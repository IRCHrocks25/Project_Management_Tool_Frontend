import { describe, expect, it } from '@jest/globals';
import { isNotesValid, collectAttachments } from './StatusChangeNotesModal';

// Frontend has no @testing-library installed (per "no new packages" rule),
// so this file tests the modal's load-bearing logic at the function level.
//
// Interactive paths NOT covered here (verified manually + via the
// migration gates in the implementation plan):
//   - Cancel button → onClose called, onSave NOT called
//   - Backdrop click → onClose called when not saving
//   - Save button click → invokes onSave with collected values
//   - Reset on re-open
// Per code review: Cancel/X/backdrop all call handleClose(), which calls
// onClose; only the Save button branches into onSave. canSave gates Save.

describe('isNotesValid', () => {
  it('returns true when notesRequired=false regardless of notes content', () => {
    expect(isNotesValid('', false)).toBe(true);
    expect(isNotesValid('   ', false)).toBe(true);
    expect(isNotesValid('actual notes', false)).toBe(true);
  });

  it('returns false when notesRequired=true and notes is empty', () => {
    expect(isNotesValid('', true)).toBe(false);
  });

  it('returns false when notesRequired=true and notes is whitespace-only', () => {
    expect(isNotesValid('   ', true)).toBe(false);
    expect(isNotesValid('\t\n  ', true)).toBe(false);
  });

  it('returns true when notesRequired=true and notes has content', () => {
    expect(isNotesValid('hello', true)).toBe(true);
    expect(isNotesValid('  hi  ', true)).toBe(true); // trimmed length > 0
  });
});

describe('collectAttachments — single mode', () => {
  it('returns empty array when single is empty', () => {
    expect(collectAttachments('single', '', [])).toEqual([]);
  });

  it('returns empty array when single is whitespace-only', () => {
    expect(collectAttachments('single', '   ', [])).toEqual([]);
  });

  it('returns array of length 1 when single has a value', () => {
    expect(collectAttachments('single', 'https://example.com', [])).toEqual(['https://example.com']);
  });

  it('trims surrounding whitespace before returning', () => {
    expect(collectAttachments('single', '  https://example.com  ', [])).toEqual(['https://example.com']);
  });

  it('ignores the multi array entirely in single mode', () => {
    expect(collectAttachments('single', 'https://a.com', ['https://b.com', 'https://c.com'])).toEqual([
      'https://a.com',
    ]);
  });
});

describe('collectAttachments — multi mode', () => {
  it('returns empty array when multi is all empty strings', () => {
    expect(collectAttachments('multi', '', ['', '', ''])).toEqual([]);
  });

  it('filters out empty + whitespace entries, keeps the rest in order', () => {
    expect(collectAttachments('multi', '', ['', 'https://a.com', '   ', 'https://b.com', ''])).toEqual([
      'https://a.com',
      'https://b.com',
    ]);
  });

  it('trims each surviving entry', () => {
    expect(collectAttachments('multi', '', ['  https://a.com  ', 'https://b.com'])).toEqual([
      'https://a.com',
      'https://b.com',
    ]);
  });

  it('ignores the single field entirely in multi mode', () => {
    expect(collectAttachments('multi', 'https://ignored.com', ['https://a.com'])).toEqual([
      'https://a.com',
    ]);
  });
});
