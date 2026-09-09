import geometry from '../../../assets/config/afterlight-geometry.json' with {type:'json'};
import {createDrainGeometry} from '../../shared/geometry/DrainGeometry.ts';

// Metres, Three Y-up. Blender and the studio consume the same JSON contract.
export const drainGeometry=createDrainGeometry(geometry);
export const {corridor,opening:drainOpening,secondary:oppositeDrainOpening,slats:drainSlats,braces:drainBraces}=drainGeometry;
export const drainIsOpen=drainGeometry.isOpen;
export const drainRainOrigin=drainGeometry.rainOrigin;
