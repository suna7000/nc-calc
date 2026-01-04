import { calculateShape } from './src/calculators/shape';
import { defaultMachineSettings } from './src/models/settings';

const testShape = {
  points: [
    { x: 20, z: 0, corner: { type: 'none', size: 0 }, id: '1' },
    { x: 40, z: -10, corner: { type: 'none', size: 0 }, id: '2' },
    { x: 40, z: -20, corner: { type: 'none', size: 0 }, id: '3' }
  ]
};

const settings = {
  ...defaultMachineSettings,
  activeToolId: 'outer-finish',
  toolLibrary: [
    {
      id: 'outer-finish',
      name: '外径仕上',
      type: 'external',
      noseRadius: 0.4,
      toolTipNumber: 3,
      hand: 'right'
    }
  ],
  noseRCompensation: { enabled: true }
};

const result = calculateShape(testShape, settings as any);
console.log(JSON.stringify(result.segments, null, 2));
