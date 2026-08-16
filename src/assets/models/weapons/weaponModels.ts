import { models } from '..';

export type WeaponModel = 'arrow' | 'axe' | 'bow' | 'staff' | 'sword';

export type WeaponModelTransform = Readonly<{
	position: readonly [number, number, number];
	rotation: readonly [number, number, number];
	scale: number;
}>;

export const weaponModels: Record<
	WeaponModel,
	Readonly<{
		url: string;
		source: string;
		dimensions: readonly [number, number, number];
		origin: readonly [number, number, number];
		longAxis: 'y' | 'z';
		attachment: WeaponModelTransform | null;
		combat: WeaponModelTransform | null;
	}>
> = {
	arrow: {
		url: models.arrow,
		source: 'Arrow by Quaternius',
		dimensions: [0.127, 1.456, 0.146],
		origin: [0, 0, 0],
		longAxis: 'z',
		attachment: null,
		combat: { position: [0, 0, 0], rotation: [Math.PI / 2, 0, 0], scale: 0.82 },
	},
	axe: {
		url: models.axe,
		source: 'Axe Double by Quaternius',
		dimensions: [0.871, 2.151, 0.136],
		origin: [0, 0, 0],
		longAxis: 'y',
		attachment: null,
		combat: {
			position: [0, 0, 0],
			rotation: [Math.PI / 2, 0, 0],
			scale: 2,
		},
	},
	bow: {
		url: models.bow,
		source: 'Wooden Bow by Quaternius',
		dimensions: [0.533, 1.974, 0.088],
		origin: [0, 0, 0],
		longAxis: 'y',
		attachment: {
			// Le modele enfant est couche dans WeaponAttachmentRenderer : branches
			// de gauche a droite et courbure dirigee vers +Z.
			position: [0, 1.05, 0.95],
			rotation: [0, 0, 0],
			scale: 1,
		},
		combat: null,
	},
	staff: {
		url: models.staff,
		source: 'Staff by Quaternius',
		dimensions: [0.144, 2.683, 0.649],
		origin: [0, 0, 0],
		longAxis: 'y',
		attachment: {
			position: [-0.55, 0.95, 0.15],
			rotation: [0, 0, Math.PI / 14],
			scale: 0.65,
		},
		combat: null,
	},
	sword: {
		url: models.sword,
		source: 'Sword by Quaternius',
		dimensions: [0.534, 2.302, 0.122],
		origin: [0, 0, 0],
		longAxis: 'z',
		attachment: {
			// +Z est l'avant autoritaire du joueur : le pommeau reste centre devant
			// le torse pendant que la lame balaie autour de ce point fixe.
			position: [0, 1.05, 0.9],
			rotation: [0, 0, -Math.PI / 7],
			scale: 1.875,
		},
		combat: null,
	},
};
