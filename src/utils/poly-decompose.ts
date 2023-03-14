import { vec2, vec3 } from 'gl-matrix';

import { Edge, Loop, Mesh, Vertex } from '../cd';

import { PriorityQueue } from './priority-queue';

const line = vec3.create();
const normal = vec2.create();
const x = vec2.create();

export namespace Line {
  const p = vec3.create();

  export const create = (): vec3 => {
    return vec3.fromValues(1.0, 0.0, 0.0);
  };

  export const set = (
    out: vec3,
    normal: Readonly<vec2>,
    point: Readonly<vec2>
  ): vec3 => {
    return vec3.set(out, normal[0], normal[1], -vec2.dot(normal, point));
  };

  export const distance = (
    line: Readonly<vec3>,
    point: Readonly<vec2>
  ): number => {
    return vec3.dot(line, vec3.set(p, point[0], point[1], 1));
  };
}

export const getLoops = (mesh: Mesh): Vertex[] => {
  const lookup = new Map<string, [vec2, vec2]>();

  for (const triangle of mesh) {
    const edges: [vec2, vec2][] = [
      [triangle.p0, triangle.p1],
      [triangle.p1, triangle.p2],
      [triangle.p2, triangle.p0],
    ];

    for (const edge of edges) {
      const invId = `${vec2.str(edge[1])}-${vec2.str(edge[0])}`;

      if (lookup.has(invId)) {
        lookup.delete(invId);
      } else {
        const id = `${vec2.str(edge[0])}-${vec2.str(edge[1])}`;
        lookup.set(id, edge);
      }
    }
  }

  const loops: Vertex[] = [];
  let loop: vec2[] = null;

  while (lookup.size > 0) {
    if (loop === null) {
      for (const [id, edge] of lookup) {
        loop = [...edge];
        lookup.delete(id);
        break;
      }
    } else {
      let found = 0;

      for (const [id, edge] of lookup) {
        if (vec2.equals(loop[loop.length - 1], edge[0])) {
          loop.push(edge[1]);
          lookup.delete(id);
          found++;
        } else if (vec2.equals(edge[1], loop[0])) {
          loop.unshift(edge[0]);
          lookup.delete(id);
          found++;
        }

        if (found === 2) {
          break;
        }
      }

      if (found === 0) {
        const vertexLoop = Loop.ofVertices(loop.slice(0, -1));
        Loop.ofEdges(vertexLoop);
        loops.push(vertexLoop);
        loop = null;
      }
    }
  }

  if (loop) {
    const vertexLoop = Loop.ofVertices(loop.slice(0, -1));
    Loop.ofEdges(vertexLoop);
    loops.push(vertexLoop);
  }

  return loops;
};

export const isVisible = (vertex: Vertex, from: Vertex): boolean => {
  vec2.sub(normal, vertex.point, from.point);
  const dist = vec2.length(normal);
  vec2.scale(normal, normal, 1.0 / dist);
  vec2.set(normal, normal[1], -normal[0]);

  Line.set(line, normal, from.point);

  let d0 = 0;
  let d1 = 0;

  for (const curr of Loop.iterator(from.next)) {
    if (curr === vertex || curr === from) {
      d1 = 0;
    } else {
      d1 = Line.distance(line, curr.point);
    }

    // sign is changed means we are intersecting a looking ray
    if (d0 * d1 < 0) {
      const t = Math.abs(d0) / (Math.abs(d0) + Math.abs(d1));
      vec2.lerp(x, curr.prev.point, curr.point, t);

      if (vec2.dist(x, from.point) < dist) {
        return false;
      }
    }

    d0 = d1;
  }

  return true;
};

export const polyDecompose = (loop: Vertex): Vertex[] => {
  if (Loop.isConvex(loop)) {
    return [loop];
  }

  const polygons: Vertex[] = [];

  const queue = new PriorityQueue<Vertex>(
    (a, b) => -(Loop.angle(a) - Loop.angle(b))
  );

  for (const vertex of Loop.iterator(loop)) {
    if (Loop.isReflex(vertex)) {
      queue.enqueue(vertex);
    }
  }

  const line0 = Line.create();
  const line1 = Line.create();

  let depth = 0;

  while (queue.size && ++depth) {
    const reflex = queue.dequeue();

    // viewing cone
    Line.set(line0, reflex.edge0.normal, reflex.point);
    Line.set(line1, reflex.edge1.normal, reflex.point);

    // list of visible vervices ordered by distance from current reflex vertex
    const candidates: Vertex[] = [];

    for (const vertex of Loop.iterator(reflex)) {
      // if in viewing cone and is visble
      if (
        vertex !== reflex.prev &&
        vertex !== reflex &&
        vertex !== reflex.next &&
        Line.distance(line0, vertex.point) < 0 &&
        Line.distance(line1, vertex.point) < 0 &&
        isVisible(vertex, reflex)
      ) {
        // submerge vertex
        let i = candidates.length - 1;
        let dist = vec2.sqrDist(reflex.point, vertex.point);

        while (
          i >= 0 &&
          dist < vec2.sqrDist(reflex.point, candidates[i].point)
        ) {
          i--;
        }

        candidates.splice(i + 1, 0, vertex);
      }
    }

    let best: Vertex = null;

    if (candidates.length === 0) {
      // find best edge and split it
      let min = Number.POSITIVE_INFINITY;
      let edge: Edge = null;
      let t = 0;

      Loop.check(reflex);

      vec2.set(normal, reflex.normal[1], -reflex.normal[0]);
      vec2.normalize(normal, normal);
      Line.set(line, normal, reflex.point);

      let d0 = 0;
      let d1 = 0;

      // loop all edges and find crossing with inverse reflex normal
      for (const vertex of Loop.iterator(reflex)) {
        if (vertex === reflex) {
          d1 = 0;
        } else {
          d1 = Line.distance(line, vertex.point);
        }

        // intersection occured
        if (
          vertex !== reflex.prev &&
          vertex !== reflex &&
          vertex !== reflex.next &&
          d0 * d1 < 0
        ) {
          // find intersection point x
          const s = Math.abs(d0) / (Math.abs(d0) + Math.abs(d1));
          vec2.lerp(x, vertex.prev.point, vertex.point, s);
          vec2.subtract(x, x, reflex.point);

          let dot = -vec2.dot(x, reflex.normal);

          // minimal projection picking
          if (dot > 0 && dot < min) {
            min = dot;
            edge = vertex.edge0;
            t = s;
          }
        }

        d0 = d1;
      }

      if (edge) {
        best = Loop.split(edge, t);
      }
    } else {
      // find best vertex using some heuristics

      for (const vertex of candidates) {
        if (!best) {
          best = vertex;
        }

        if (Loop.isReflex(vertex)) {
          if (!Loop.isReflex(best)) {
            best = vertex;
          }

          // viewing cone
          Line.set(line0, vertex.edge0.normal, vertex.point);
          Line.set(line1, vertex.edge1.normal, vertex.point);

          if (
            Line.distance(line0, reflex.point) < 0 &&
            Line.distance(line1, reflex.point) < 0
          ) {
            best = vertex;
            break;
          }
        }
      }
    }

    if (!best) {
      throw new Error('polyDecompose: Some misleading occurred');
    }

    queue.remove(best);

    // split loop
    for (const edge of Loop.cut(reflex, best)) {
      if (Loop.isConvex(edge.v0)) {
        polygons.push(edge.v0);
      } else {
        if (Loop.isReflex(edge.v0)) {
          queue.enqueue(edge.v0);
        }

        if (Loop.isReflex(edge.v1)) {
          queue.enqueue(edge.v1);
        }
      }

      Loop.check(edge.v0);
    }
  }

  return polygons;
};
