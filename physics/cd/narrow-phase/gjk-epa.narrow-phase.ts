import { vec2 } from 'gl-matrix';

import { inverse } from '../../math';
import { PairsRegistry } from '../../dynamics';
import { pairId } from '../../utils';
import { ContactCandidatePair, ContactInfo } from '../contact';
import { Circle, Polygon } from '../shape';
import { distance, epa, mdv } from './gjk-epa';
import {
  getCircleCircleContactManifold,
  getPolyCircleContactManifold,
  getPolyPolyContactManifold,
} from './gjk-epa/manifold';
import { NarrowPhaseInterface } from './narrow-phase.interface';

export class GjkEpaNarrowPhase implements NarrowPhaseInterface {
  private readonly margin = 1.0e-2;
  private readonly relError = 1.0e-6;
  private readonly epsilon = 1.0e-4;
  private readonly maxIterations = 25;
  private readonly mtv = vec2.create();

  private readonly simplex = new Set<vec2>();
  private readonly initialDir = vec2.create();

  constructor(private readonly registry: PairsRegistry) {}

  *detectContacts(
    pairs: Iterable<ContactCandidatePair>
  ): Iterable<ContactInfo> {
    const contact: ContactInfo[] = [];

    for (let [left, right] of pairs) {
      const id = pairId(left.collider.id, right.collider.id);
      const pair = this.registry.getPairById(id);

      pair.updateTransforms();
      contact.length = 0;
      this.simplex.clear();
      vec2.subtract(
        this.initialDir,
        left.collider.body.position,
        right.collider.body.position
      );

      const dist = distance(
        this.simplex,
        left.shape,
        right.shape,
        pair.spacesMapping,
        this.initialDir,
        -this.margin,
        this.relError,
        this.maxIterations
      );

      if (dist < this.epsilon) {
        // inner shapes are intersect - crank a epa algorithm!

        this.simplex.clear();

        distance(
          this.simplex,
          left.shape,
          right.shape,
          pair.spacesMapping,
          this.initialDir,
          0,
          this.relError,
          this.maxIterations
        );

        epa(
          this.mtv,
          this.simplex,
          left.shape,
          right.shape,
          pair.spacesMapping,
          0,
          this.epsilon,
          this.maxIterations
        );

        vec2.negate(this.mtv, this.mtv);
      } else {
        const point0 = vec2.create();
        const point1 = vec2.create();

        mdv(this.mtv, this.simplex);

        pair.spacesMapping.toSecondVector(point1, this.mtv);
        right.shape.support(point1, point1);
        pair.spacesMapping.fromSecondPoint(point1, point1);

        vec2.negate(this.mtv, this.mtv);

        pair.spacesMapping.toFirstVector(point0, this.mtv);
        left.shape.support(point0, point0);
        pair.spacesMapping.fromFirstPoint(point0, point0);

        vec2.negate(this.mtv, this.mtv);

        const proj1 = vec2.dot(this.mtv, point1);
        const proj0 = vec2.dot(this.mtv, point0);

        // bodies are not intersecting
        if (proj0 >= proj1) {
          continue;
        }
      }

      //
      if (left.shape instanceof Polygon && right.shape instanceof Polygon) {
        yield* getPolyPolyContactManifold(
          contact,
          left.collider,
          left.shape,
          right.collider,
          right.shape,
          pair.spacesMapping,
          this.mtv
        );
      } else if (
        left.shape instanceof Polygon &&
        right.shape instanceof Circle
      ) {
        yield* getPolyCircleContactManifold(
          contact,
          left.collider,
          left.shape,
          right.collider,
          right.shape,
          pair.spacesMapping,
          this.mtv
        );
      } else if (
        left.shape instanceof Circle &&
        right.shape instanceof Polygon
      ) {
        yield* getPolyCircleContactManifold(
          contact,
          right.collider,
          right.shape,
          left.collider,
          left.shape,
          inverse(pair.spacesMapping),
          vec2.fromValues(-this.mtv[0], -this.mtv[1])
        );
      } else if (
        left.shape instanceof Circle &&
        right.shape instanceof Circle
      ) {
        yield* getCircleCircleContactManifold(
          contact,
          right.collider,
          right.shape,
          left.collider,
          left.shape,
          pair.spacesMapping,
          this.mtv
        );
      }
    }
  }
}
