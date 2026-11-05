/* eslint-disable no-script-url -- these tests check that such links are refused */
import { isAllowedPageHref, isAutolinkable, normalizeDoc, normalizeLinkInput, shareLabel, sharedWithFrom, taskHref } from './pageUtils';

describe('page links', () => {
  it.each([
    'https://example.com',
    'http://example.com/a?b=c',
    'mailto:julia@example.com',
    '/project/1?task=2&tab=details',
    '/pages',
  ])('allows %s', (url) => expect(isAllowedPageHref(url)).toBe(true));

  it.each([
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    ' javascript:alert(1)',
    'java\tscript:alert(1)',
    'java\nscript:alert(1)',
    '\u0001javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:x',
    'ftp://example.com',
    '//evil.example',
    '/\\evil.example',
    'example.com',
    'https://',
    'mailto:',
    '',
  ])('rejects %j', (url) => expect(isAllowedPageHref(url)).toBe(false));

  it('rejects non-strings', () => {
    expect(isAllowedPageHref(null)).toBe(false);
    expect(isAllowedPageHref(undefined)).toBe(false);
  });

  it('lets autolinks through for bare domains only', () => {
    expect(isAutolinkable('example.com')).toBe(true);
    expect(isAutolinkable('https://example.com')).toBe(true);
    expect(isAutolinkable('javascript:alert(1)')).toBe(false);
    expect(isAutolinkable('ftp://example.com')).toBe(false);
  });

  it('turns what people type into an allowed link, or nothing', () => {
    expect(normalizeLinkInput(' example.com/a ')).toBe('https://example.com/a');
    expect(normalizeLinkInput('www.example.com:8080/a')).toBe('https://www.example.com:8080/a');
    expect(normalizeLinkInput('julia@example.com')).toBe('mailto:julia@example.com');
    expect(normalizeLinkInput('/pages')).toBe('/pages');
    expect(normalizeLinkInput('javascript:alert(1)')).toBeNull();
    expect(normalizeLinkInput('hello')).toBeNull();
    expect(normalizeLinkInput('two words.com')).toBeNull();
    expect(normalizeLinkInput('//evil.example')).toBeNull();
    expect(normalizeLinkInput('')).toBeNull();
  });

  it('builds a task link that passes the check', () => {
    const href = taskHref('p 1', 't/2');
    expect(href).toBe('/project/p%201?task=t%2F2&tab=details');
    expect(isAllowedPageHref(href)).toBe(true);
  });
});

describe('share label', () => {
  const none = { everyone: false, departments: [], userCount: 0 };
  it('names who can see the page', () => {
    expect(shareLabel(none)).toBe('Private');
    expect(shareLabel({ ...none, everyone: true, userCount: 3 })).toBe('Everyone');
    expect(shareLabel({ ...none, departments: ['Designer'] })).toBe('Designer');
    expect(shareLabel({ ...none, departments: ['Designer', 'CRM'] })).toBe('2 departments');
    expect(shareLabel({ ...none, userCount: 1 })).toBe('1 person');
    expect(shareLabel({ ...none, userCount: 2 })).toBe('2 people');
    expect(shareLabel({ ...none, departments: ['Designer'], userCount: 2 })).toBe('Designer + 2 people');
  });
  it('reads the summary from a list of shares', () => {
    expect(
      sharedWithFrom([
        { kind: 'department', target: 'CRM', permission: 'view' },
        { kind: 'user', target: 'u', permission: 'edit' },
      ]),
    ).toEqual({ everyone: false, departments: ['CRM'], userCount: 1 });
  });
});

describe('normalizeDoc', () => {
  it('always leaves somewhere to type', () => {
    const empty = { type: 'doc', content: [{ type: 'paragraph' }] };
    expect(normalizeDoc(null)).toEqual(empty);
    expect(normalizeDoc({ type: 'doc', content: [] })).toEqual(empty);
    expect(normalizeDoc({ type: 'doc' })).toEqual(empty);
    const real = { type: 'doc', content: [{ type: 'horizontalRule' }] };
    expect(normalizeDoc(real)).toBe(real);
  });
});
