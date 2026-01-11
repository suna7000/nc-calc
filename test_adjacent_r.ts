import { Point, createPoint, noCorner } from './src/models/shape';
import { calculateShape } from './src/calculators/shape';
import { defaultMachineSettings } from './src/models/settings';

const p1 = createPoint(90, 0, noCorner());
const p2 = createPoint(90, -30, { type: 'sumi-r', size: 20 });
const p3 = createPoint(100, -30, { type: 'kaku-r', size: 1 });
const p4 = createPoint(100, -40, noCorner());

const shape = { points: [p1, p2, p3, p4] };
const result = calculateShape(shape, defaultMachineSettings);

console.log(JSON.stringify(result, null, 2));
