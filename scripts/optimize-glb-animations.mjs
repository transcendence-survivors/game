import fs from 'node:fs';
import path from 'node:path';

const JSON_CHUNK = 0x4e4f534a;
const FLOAT = 5126;
const EPSILON = 1e-6;
const COMPONENTS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
const DEFAULT_TRANSFORMS = {
	translation: [0, 0, 0],
	rotation: [0, 0, 0, 1],
	scale: [1, 1, 1],
};
const NODE_PROPERTIES = {
	translation: 'translation',
	rotation: 'rotation',
	scale: 'scale',
};

function collectGlbs(directory, output = []) {
	for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
		const file = path.join(directory, entry.name);
		if (entry.isDirectory()) collectGlbs(file, output);
		else if (entry.name.endsWith('.glb')) output.push(file);
	}
	return output;
}

function decodeGlb(buffer) {
	if (buffer.readUInt32LE(0) !== 0x46546c67)
		throw new Error('Invalid GLB header');
	const chunks = [];
	for (let offset = 12; offset < buffer.length;) {
		const length = buffer.readUInt32LE(offset);
		const type = buffer.readUInt32LE(offset + 4);
		const end = offset + 8 + length;
		chunks.push({ type, data: buffer.subarray(offset + 8, end) });
		offset = end;
	}
	if (chunks[0]?.type !== JSON_CHUNK) throw new Error('Missing JSON chunk');
	return {
		json: JSON.parse(chunks[0].data.toString('utf8')),
		chunks: chunks.slice(1),
	};
}

function encodeGlb(json, chunks) {
	const source = Buffer.from(JSON.stringify(json));
	const padding = (4 - (source.length % 4)) % 4;
	const jsonData = Buffer.alloc(source.length + padding, 0x20);
	source.copy(jsonData);
	const encodedChunks = [{ type: JSON_CHUNK, data: jsonData }, ...chunks].map(
		({ type, data }) => {
			const encoded = Buffer.alloc(8 + data.length);
			encoded.writeUInt32LE(data.length, 0);
			encoded.writeUInt32LE(type, 4);
			data.copy(encoded, 8);
			return encoded;
		},
	);
	const totalLength =
		12 + encodedChunks.reduce((total, chunk) => total + chunk.length, 0);
	const header = Buffer.alloc(12);
	header.writeUInt32LE(0x46546c67, 0);
	header.writeUInt32LE(2, 4);
	header.writeUInt32LE(totalLength, 8);
	return Buffer.concat([header, ...encodedChunks], totalLength);
}

function accessorValues(json, binary, accessorIndex) {
	const accessor = json.accessors[accessorIndex];
	const view = json.bufferViews[accessor?.bufferView];
	const components = COMPONENTS[accessor?.type];
	if (
		!accessor ||
		!view ||
		accessor.componentType !== FLOAT ||
		!components ||
		accessor.sparse
	)
		return null;
	const stride = view.byteStride ?? components * 4;
	const offset = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
	return { accessor, components, offset, stride, binary };
}

function isBaseTransformChannel(json, binary, channel, sampler) {
	const defaults = DEFAULT_TRANSFORMS[channel.target.path];
	if (!defaults || sampler.interpolation === 'CUBICSPLINE') return false;
	const values = accessorValues(json, binary, sampler.output);
	if (!values) return false;
	const node = json.nodes[channel.target.node];
	const property = NODE_PROPERTIES[channel.target.path];
	const base = node?.[property] ?? defaults;
	for (let row = 0; row < values.accessor.count; row++)
		for (let component = 0; component < values.components; component++) {
			const value = values.binary.readFloatLE(
				values.offset + row * values.stride + component * 4,
			);
			if (Math.abs(value - base[component]) > EPSILON) return false;
		}
	return true;
}

function removeGloballyRedundantChannels(json, binary) {
	const properties = new Map();
	for (const animation of json.animations ?? [])
		for (const channel of animation.channels) {
			const key = `${channel.target.node}:${channel.target.path}`;
			let usage = properties.get(key);
			if (!usage)
				properties.set(
					key,
					(usage = { required: false, channels: [] }),
				);
			const redundant = isBaseTransformChannel(
				json,
				binary,
				channel,
				animation.samplers[channel.sampler],
			);
			usage.channels.push({ animation, channel, redundant });
			if (!redundant) usage.required = true;
		}

	let removed = 0;
	for (const usage of properties.values()) {
		if (usage.required) continue;
		for (const item of usage.channels) item.remove = true;
	}
	for (const animation of json.animations ?? []) {
		const removable = new Set();
		for (const usage of properties.values())
			for (const item of usage.channels)
				if (item.animation === animation && item.remove)
					removable.add(item.channel);
		if (!removable.size) continue;
		animation.channels = animation.channels.filter(
			(channel) => !removable.has(channel),
		);
		removed += removable.size;
		const usedSamplers = [
			...new Set(animation.channels.map((c) => c.sampler)),
		];
		const remap = new Map(usedSamplers.map((old, index) => [old, index]));
		animation.samplers = usedSamplers.map(
			(index) => animation.samplers[index],
		);
		for (const channel of animation.channels)
			channel.sampler = remap.get(channel.sampler);
	}
	return removed;
}

const write = process.argv.includes('--write');
const check = process.argv.includes('--check');
const root = path.resolve('src/assets/models');
let totalRemoved = 0;
for (const file of collectGlbs(root).sort()) {
	const original = fs.readFileSync(file);
	const { json, chunks } = decodeGlb(original);
	const binary = chunks.find((chunk) => chunk.type === 0x004e4942)?.data;
	if (!binary) continue;
	const removed = removeGloballyRedundantChannels(json, binary);
	if (!removed) continue;
	totalRemoved += removed;
	const optimized = encodeGlb(json, chunks);
	console.log(
		`${path.relative(root, file)}: -${removed} channels, ${original.length} -> ${optimized.length} bytes`,
	);
	if (write) {
		const temporary = `${file}.optimized`;
		fs.writeFileSync(temporary, optimized);
		decodeGlb(fs.readFileSync(temporary));
		fs.renameSync(temporary, file);
	}
}
console.log(`${write ? 'Removed' : 'Can remove'} ${totalRemoved} channels.`);
if (check && totalRemoved) process.exitCode = 1;
