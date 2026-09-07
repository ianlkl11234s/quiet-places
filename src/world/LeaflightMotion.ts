import * as THREE from 'three';

export interface LeaflightMotion {
  /** `time` is deliberately supplied by the caller: pausing its clock freezes the tree. */
  update(time: number, strength?: number): void;
  dispose(): void;
}

type TreeMesh = THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]>;

const CAMphor_PART = /^STW_Camphor_(?:Trunk|Primary|Secondary|Twigs|Petioles|Leaves_[0-2])$/;

const windVertex = /* glsl */ `
uniform float uLeaflightTime;
uniform float uLeaflightStrength;
uniform float uLeaflightRootY;
uniform float uLeaflightHeight;
uniform float uLeaflightLeaf;
uniform mat4 uLeaflightWorldToLocal;

vec3 leaflightWind(vec3 worldPosition) {
  float h = clamp((worldPosition.y - uLeaflightRootY) / max(uLeaflightHeight, 0.001), 0.0, 1.0);
  // The two long waves have unrelated directions and periods. A very broad
  // spatial phase prevents the whole canopy from reading as a rigid pendulum.
  float t = uLeaflightTime;
  float phaseA = dot(worldPosition.xz, vec2(0.16, -0.11));
  float phaseB = dot(worldPosition.xz, vec2(-0.07, 0.18));
  vec2 gust = vec2(
    sin(t * 0.63 + phaseA) + 0.42 * sin(t * 0.19 + phaseB + 1.7),
    cos(t * 0.51 + phaseB + 0.4) + 0.37 * sin(t * 0.16 + phaseA + 2.4)
  );
  float swell = 0.72 + 0.28 * sin(t * 0.11 + phaseA * 0.35);
  // Cubing pins the trunk at its base while retaining a calm, continuous bend.
  vec3 offset = vec3(gust.x, 0.0, gust.y) * (h * h * h) * swell * 0.105 * uLeaflightStrength;
  if (uLeaflightLeaf > 0.5) {
    float flutter = sin(t * 4.7 + dot(worldPosition.xz, vec2(2.7, 3.9)) + worldPosition.y * 1.8);
    offset += vec3(0.016, 0.006, -0.012) * flutter * h * uLeaflightStrength;
  }
  return offset;
}
`;

interface ShaderUniforms {
  uLeaflightTime: THREE.IUniform<number>;
  uLeaflightStrength: THREE.IUniform<number>;
  uLeaflightRootY: THREE.IUniform<number>;
  uLeaflightHeight: THREE.IUniform<number>;
  uLeaflightLeaf: THREE.IUniform<number>;
  uLeaflightWorldToLocal: THREE.IUniform<THREE.Matrix4>;
}

function injectWind(material: THREE.Material, uniforms: ShaderUniforms): void {
  const previous = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    previous?.(shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
      ${windVertex}
    `).replace('#include <begin_vertex>', `
      #include <begin_vertex>
      vec3 leaflightWorldBase = (modelMatrix * vec4(transformed, 1.0)).xyz;
      vec3 leaflightWorldOffset = leaflightWind(leaflightWorldBase);
      transformed += (uLeaflightWorldToLocal * vec4(leaflightWorldOffset, 0.0)).xyz;
    `);
  };
  material.needsUpdate = true;
}

function shadowMaterial(source: THREE.MeshStandardMaterial, distance: boolean): THREE.Material {
  const shadow = distance
    ? new THREE.MeshDistanceMaterial({alphaTest: source.alphaTest, map: source.map, alphaMap: source.alphaMap})
    : new THREE.MeshDepthMaterial({depthPacking: THREE.RGBADepthPacking, alphaTest: source.alphaTest, map: source.map, alphaMap: source.alphaMap});
  shadow.side = source.side;
  return shadow;
}

/** Adds a shared world-space breeze to the named meshes in leaflight-study.glb. */
export function installLeaflightMotion(root: THREE.Object3D): LeaflightMotion {
  root.updateWorldMatrix(true, true);
  const bounds = new THREE.Box3();
  const meshes: TreeMesh[] = [];
  root.traverse((object) => {
    if (object instanceof THREE.Mesh && CAMphor_PART.test(object.name)) {
      meshes.push(object as TreeMesh);
      bounds.expandByObject(object);
    }
  });

  const rootY = Number.isFinite(bounds.min.y) ? bounds.min.y : root.getWorldPosition(new THREE.Vector3()).y;
  const height = Math.max(bounds.max.y - rootY, 0.001);
  const restores: Array<() => void> = [];
  const bindings: Array<{mesh: TreeMesh; uniforms: ShaderUniforms}> = [];
  const inverse = new THREE.Matrix4();

  for (const mesh of meshes) {
    const originalMaterial = mesh.material;
    const originals = Array.isArray(originalMaterial) ? originalMaterial : [originalMaterial];
    const leaf = /^STW_Camphor_Leaves_[0-2]$/.test(mesh.name) ? 1 : 0;
    const uniforms: ShaderUniforms = {
      uLeaflightTime: {value: 0}, uLeaflightStrength: {value: 1},
      uLeaflightRootY: {value: rootY}, uLeaflightHeight: {value: height},
      uLeaflightLeaf: {value: leaf}, uLeaflightWorldToLocal: {value: new THREE.Matrix4()},
    };
    const clones = originals.map((source) => {
      const clone = source.clone();
      injectWind(clone, uniforms);
      return clone;
    });
    const standard = clones.find((material): material is THREE.MeshStandardMaterial => material instanceof THREE.MeshStandardMaterial);
    if (!standard) {
      clones.forEach((material) => material.dispose());
      continue;
    }

    const originalDepth = mesh.customDepthMaterial;
    const originalDistance = mesh.customDistanceMaterial;
    const depth = originalDepth?.clone() ?? shadowMaterial(standard, false);
    const distance = originalDistance?.clone() ?? shadowMaterial(standard, true);
    injectWind(depth, uniforms);
    injectWind(distance, uniforms);
    mesh.material = Array.isArray(originalMaterial) ? clones : clones[0];
    mesh.customDepthMaterial = depth;
    mesh.customDistanceMaterial = distance;
    bindings.push({mesh, uniforms});
    restores.push(() => {
      mesh.material = originalMaterial;
      mesh.customDepthMaterial = originalDepth;
      mesh.customDistanceMaterial = originalDistance;
      clones.forEach((material) => material.dispose());
      depth.dispose();
      distance.dispose();
    });
  }

  return {
    update(time: number, strength = 1): void {
      root.updateWorldMatrix(true, true);
      for (const {mesh, uniforms} of bindings) {
        inverse.copy(mesh.matrixWorld).invert();
        uniforms.uLeaflightTime.value = time;
        uniforms.uLeaflightStrength.value = strength;
        uniforms.uLeaflightWorldToLocal.value.copy(inverse);
      }
    },
    dispose(): void { restores.splice(0).forEach((restore) => restore()); },
  };
}
