import { mat3, mat4 } from 'gl-matrix';
import { Loop, Vertex, loadObj } from 'rb-phys2d';

// import MECH from './objects/mech.obj';
import MESH from './objects/mesh.obj';
import { GeometryData } from './services';

export const collection = loadObj(MESH);

export const createGometry = (loop: Vertex): GeometryData => {
  const vertices = [];
  const indices = [];

  let index = 0;

  for (const vertex of Loop.iterator(loop)) {
    indices.push(index++, index++);
    vertices.push(...vertex.point, ...vertex.next.point);
  }

  return {
    vertexFormat: [
      {
        semantics: 'position',
        size: 2,
        type: WebGL2RenderingContext.FLOAT,
        slot: 0,
        offset: 0,
        stride: 8,
      },
    ],
    vertexData: Float32Array.from(vertices),
    indexData: Uint16Array.from(indices),
  };
};

export const toMat4 = (out: mat4, m: Readonly<mat3>): mat4 => {
  out.fill(0.0);

  out[0] = m[0];
  out[1] = m[1];

  out[4] = m[3];
  out[5] = m[4];

  out[12] = m[6];
  out[13] = m[7];
  out[15] = m[8];

  return out;
};
