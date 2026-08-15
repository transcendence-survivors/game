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
		combat: { position: [0, 0, 0], rotation: [0, 0, Math.PI / 2], scale: 0.65 },
	},
	axe: {
		url: models.axe,
		source: 'Axe Double by Quaternius',
		dimensions: [0.871, 2.151, 0.136],
		origin: [0, 0, 0],
		longAxis: 'z',
		attachment: null,
		combat: { position: [0, 0, 0], rotation: [0, 0, 0], scale: 0.65 },
	},
	bow: {
		url: models.bow,
		source: 'Wooden Bow by Quaternius',
		dimensions: [0.533, 1.974, 0.088],
		origin: [0, 0, 0],
		longAxis: 'z',
		attachment: {
			position: [0.55, 0.9, -0.2],
			rotation: [0, Math.PI / 2, -Math.PI / 14],
			scale: 0.65,
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
			position: [0.55, 1.05, 0.15],
			rotation: [0, 0, -Math.PI / 7],
			scale: 0.65,
		},
		combat: null,
	},
};
