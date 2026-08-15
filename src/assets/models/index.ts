export const models = {
	player: new URL('./players/player.glb', import.meta.url).href,
	sword: new URL('./weapons/quaternius/sword.glb', import.meta.url).href,
	axe: new URL('./weapons/quaternius/double-axe.glb', import.meta.url).href,
	staff: new URL('./weapons/quaternius/staff.glb', import.meta.url).href,
	bow: new URL('./weapons/quaternius/wooden-bow.glb', import.meta.url).href,
	arrow: new URL('./weapons/quaternius/arrow.glb', import.meta.url).href,
	monster: {
		grunt: new URL('./monster/grunt/grunt.glb', import.meta.url).href,
		kraklet: new URL('./monster/kraklet/kraklet.glb', import.meta.url).href,
		ravager: new URL('./monster/ravager/ravager.glb', import.meta.url).href,
		skitter: new URL('./monster/skitter/skitter.glb', import.meta.url).href,
		venomweb: new URL('./monster/venomweb/venomweb.glb', import.meta.url)
			.href,
		abyssor: new URL('./boss/abyssor/abyssor.glb', import.meta.url).href,
		arakhnos: new URL('./boss/arakhnos/arakhnos.glb', import.meta.url).href,
		gorvath: new URL('./boss/gorvath/gorvath.glb', import.meta.url).href,
		khimaera: new URL('./boss/khimaera/khimaera.glb', import.meta.url).href,
	},
} as const;

export type MonsterGLB = keyof typeof models.monster;
