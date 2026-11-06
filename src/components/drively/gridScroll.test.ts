import { wheelPixels } from './gridScroll';

const page = { width: 800, height: 600 };

describe('wheelPixels', () => {
  it('uses the real distance, in both directions at once', () => {
    expect(wheelPixels({ deltaX: 3, deltaY: 7, deltaMode: 0 }, page)).toEqual({ x: 3, y: 7 });
  });
  it('converts wheels that report lines or pages', () => {
    expect(wheelPixels({ deltaX: 0, deltaY: 3, deltaMode: 1 }, page)).toEqual({ x: 0, y: 60 });
    expect(wheelPixels({ deltaX: 0, deltaY: 1, deltaMode: 2 }, page)).toEqual({ x: 0, y: 600 });
  });
  it('scrolls sideways with Shift held', () => {
    expect(wheelPixels({ deltaX: 0, deltaY: 100, deltaMode: 0, shiftKey: true }, page)).toEqual({ x: 100, y: 0 });
  });
});
