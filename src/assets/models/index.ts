export const models = {
	player: new URL('./Player.glb', import.meta.url).href,
	sword: new URL('./Sword.glb', import.meta.url).href,
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

export type MonsterModel = keyof typeof models.monster;
