import { describe, it, expect } from 'vitest';
import { SwingAnimation } from './SwingAnimation';

describe('SwingAnimation', () => {
	it('starts at fromAngle when progress = 0', () => {
		const swing = new SwingAnimation({ fromAngle: 0, toAngle: Math.PI, durationMs: 300 });
		swing.start(1000);
		expect(swing.angleAt(1000)).toBeCloseTo(0);
	});

	it('ends at toAngle when progress = 1', () => {
		const swing = new SwingAnimation({ fromAngle: 0, toAngle: Math.PI, durationMs: 300 });
		swing.start(1000);
		expect(swing.angleAt(1300)).toBeCloseTo(Math.PI);
	});

	it('clamps angle to toAngle past the duration', () => {
		const swing = new SwingAnimation({ fromAngle: 0, toAngle: Math.PI, durationMs: 300 });
		swing.start(1000);
		expect(swing.angleAt(5000)).toBeCloseTo(Math.PI);
	});

	it('isDone returns true after duration', () => {
		const swing = new SwingAnimation({ fromAngle: 0, toAngle: Math.PI, durationMs: 300 });
		swing.start(1000);
		expect(swing.isDone(1500)).toBe(true);
	});

	it('isDone returns false during animation', () => {
		const swing = new SwingAnimation({ fromAngle: 0, toAngle: Math.PI, durationMs: 300 });
		swing.start(1000);
		expect(swing.isDone(1100)).toBe(false);
	});

	it('isActive returns false before start', () => {
		const swing = new SwingAnimation({ fromAngle: 0, toAngle: Math.PI, durationMs: 300 });
		expect(swing.isActive(0)).toBe(false);
	});

	it('isActive returns true during animation', () => {
		const swing = new SwingAnimation({ fromAngle: 0, toAngle: Math.PI, durationMs: 300 });
		swing.start(1000);
		expect(swing.isActive(1100)).toBe(true);
	});

	it('hit window covers the middle of the swing', () => {
		const swing = new SwingAnimation({
			fromAngle: 0, toAngle: Math.PI, durationMs: 300,
			hitWindowStart: 0.2, hitWindowEnd: 0.6,
		});
		swing.start(1000);
		expect(swing.isInHitWindow(1050)).toBe(false);
		expect(swing.isInHitWindow(1100)).toBe(true);
		expect(swing.isInHitWindow(1200)).toBe(false);
	});

	it('hit window can only fire once per swing (consume)', () => {
		const swing = new SwingAnimation({
			fromAngle: 0, toAngle: Math.PI, durationMs: 300,
			hitWindowStart: 0.2, hitWindowEnd: 0.6,
		});
		swing.start(1000);
		expect(swing.consumeHitFrame(1100)).toBe(true);
		expect(swing.consumeHitFrame(1110)).toBe(false);
	});

	it('cannot start a new swing while one is active', () => {
		const swing = new SwingAnimation({ fromAngle: 0, toAngle: Math.PI, durationMs: 300 });
		expect(swing.start(1000)).toBe(true);
		expect(swing.start(1100)).toBe(false);
		expect(swing.start(1500)).toBe(true);
	});
});
