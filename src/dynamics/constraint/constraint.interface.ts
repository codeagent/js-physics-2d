import { Body } from '../body';

export interface ConstraintClamping {
  min: number;
  max: number;
}

export interface ConstraintInterface {
  readonly bodyA: Body | null;
  readonly bodyB: Body | null;
  getJacobian(out: Float32Array): void;
  getDotJacobian(out: Float32Array): void;
  getValue(): number;
  getSpeed(): number;
  getPushFactor(dt: number, strength: number): number;
  getClamping(): ConstraintClamping;
  getCache(id: 0 | 1): number;
  setCache(id: 0 | 1, value: number): void;
}
