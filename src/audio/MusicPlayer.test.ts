import { describe, expect, it, vi } from 'vitest';
import { MusicPlayer } from './MusicPlayer';

class FakeAudio extends EventTarget {
	src = '';
	preload = '';
	volume = 1;
	loop = false;
	currentTime = 0;
	play = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
	pause = vi.fn();
	load = vi.fn();
}

describe('MusicPlayer', () => {
	it('uses native looping for a single track', () => {
		const audio = new FakeAudio();
		const player = new MusicPlayer(
			[{ id: 'theme', src: '/theme.wav', volume: 0.4 }],
			() => audio,
			new EventTarget(),
		);

		player.play();

		expect(audio.src).toBe('/theme.wav');
		expect(audio.volume).toBe(0.4);
		expect(audio.loop).toBe(true);
		expect(audio.play).toHaveBeenCalledOnce();
	});

	it('cycles through several tracks and loops the playlist', () => {
		const audio = new FakeAudio();
		const player = new MusicPlayer(
			[
				{ id: 'first', src: '/first.wav' },
				{ id: 'second', src: '/second.wav' },
			],
			() => audio,
			new EventTarget(),
		);
		player.play();

		audio.dispatchEvent(new Event('ended'));
		expect(audio.src).toBe('/second.wav');
		audio.dispatchEvent(new Event('ended'));
		expect(audio.src).toBe('/first.wav');
		expect(audio.loop).toBe(false);
	});

	it('releases its audio channel when disposed', () => {
		const audio = new FakeAudio();
		const player = new MusicPlayer(
			[{ id: 'theme', src: '/theme.wav' }],
			() => audio,
			new EventTarget(),
		);

		player.dispose();

		expect(audio.pause).toHaveBeenCalledOnce();
		expect(audio.currentTime).toBe(0);
		expect(audio.src).toBe('');
	});
});
