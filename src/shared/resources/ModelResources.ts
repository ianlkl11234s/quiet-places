import * as THREE from 'three';

export type ModelResourceKind = 'skeletons' | 'geometries' | 'materials' | 'textures';

/** Resources owned by an Object3D model. Shader uniforms are deliberately excluded. */
export type ModelResources = {
  skeletons: Set<THREE.Skeleton>;
  geometries: Set<THREE.BufferGeometry>;
  materials: Set<THREE.Material>;
  textures: Set<THREE.Texture>;
};

const disposed = new WeakSet<object>();

function materialsOf(mesh: THREE.Mesh) {
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material];
}

/**
 * Collects mesh-owned GLTF-style resources without following ShaderMaterial
 * uniforms. Uniform values may be borrowed from another subsystem and must be
 * released by that subsystem's explicit owner.
 */
export function collectModelResources(root: THREE.Object3D): ModelResources {
  const resources: ModelResources = {
    skeletons: new Set(), geometries: new Set(), materials: new Set(), textures: new Set(),
  };
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    resources.geometries.add(object.geometry);
    if (object instanceof THREE.SkinnedMesh) resources.skeletons.add(object.skeleton);
    for (const material of materialsOf(object)) {
      resources.materials.add(material);
      // GLTF texture slots live directly on the material. Do not inspect
      // uniforms: PhotonMap's textures and Stingray's volume are borrowed.
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) resources.textures.add(value);
    }
  });
  return resources;
}

/** Releases only supplied, owned resources; overlapping calls remain safe. */
export function disposeModelResources(
  resources: Partial<ModelResources>,
  order: readonly ModelResourceKind[] = ['textures', 'materials', 'geometries', 'skeletons'],
) {
  for (const kind of order) resources[kind]?.forEach(resource => {
    if (disposed.has(resource)) return;
    disposed.add(resource);
    resource.dispose();
  });
}
