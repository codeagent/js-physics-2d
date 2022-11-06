import { MeshOBBNode, MeshShape } from '../shape';
import { ContactCandidatePair, ContactCandidate } from '../contact';
import { testAABBOBBTree, testOBBOBBTrees } from './tests';
import { MidPhaseInterface } from './mid-phase.interface';

export class DefaultMidPhase implements MidPhaseInterface {
  *detectCandidates(
    pairs: Iterable<ContactCandidatePair>
  ): Iterable<ContactCandidatePair> {
    for (const pair of pairs) {
      const [left, right] = pair;

      if (left.shape instanceof MeshShape && right.shape instanceof MeshShape) {
        const nodes = new Set<[MeshOBBNode, MeshOBBNode]>();

        if (
          testOBBOBBTrees(
            nodes,
            left.shape.obbTree,
            left.collider.transform,
            right.shape.obbTree,
            right.collider.transform
          )
        ) {
          for (const [leftNode, rightNode] of nodes) {
            yield [
              new ContactCandidate(
                right.collider,
                rightNode.payload.triangleShape,
                right.aabb
              ),
              new ContactCandidate(
                left.collider,
                leftNode.payload.triangleShape,
                left.aabb
              ),
            ];
          }
        }
      } else if (left.shape instanceof MeshShape) {
        const nodes = new Set<MeshOBBNode>();

        if (
          testAABBOBBTree(
            nodes,
            right.aabb,
            left.shape.obbTree,
            left.collider.transform
          )
        ) {
          for (const node of nodes) {
            yield [
              new ContactCandidate(
                left.collider,
                node.payload.triangleShape,
                left.aabb
              ),
              right,
            ];
          }
        }
      } else if (right.shape instanceof MeshShape) {
        const nodes = new Set<MeshOBBNode>();

        if (
          testAABBOBBTree(
            nodes,
            left.aabb,
            right.shape.obbTree,
            right.collider.transform
          )
        ) {
          for (const node of nodes) {
            yield [
              left,
              new ContactCandidate(
                right.collider,
                node.payload.triangleShape,
                right.aabb
              ),
            ];
          }
        }
      } else {
        yield pair;
      }
    }
  }
}
