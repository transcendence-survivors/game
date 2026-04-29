export interface IVec3 {
	x: number;
	y: number;
	z: number;
}

const of = (x: number, y: number, z: number): IVec3 => ({ x, y, z });

const zero = (): IVec3 => ({ x: 0, y: 0, z: 0 });

const add = (a: IVec3, b: IVec3): IVec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });

const subtract = (a: IVec3, b: IVec3): IVec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });

const scale = (v: IVec3, s: number): IVec3 => ({ x: v.x * s, y: v.y * s, z: v.z * s });

const lengthSquared = (v: IVec3): number => v.x * v.x + v.y * v.y + v.z * v.z;

const length = (v: IVec3): number => Math.sqrt(lengthSquared(v));

const normalize = (v: IVec3): IVec3 => {
	const len = length(v);
	if (len === 0) return zero();
	return { x: v.x / len, y: v.y / len, z: v.z / len };
};

const flattenY = (v: IVec3): IVec3 => ({ x: v.x, y: 0, z: v.z });

export const Vec3 = {
	of,
	zero,
	add,
	subtract,
	scale,
	length,
	lengthSquared,
	normalize,
	flattenY,
};
