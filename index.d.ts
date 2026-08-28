import type { Plugin } from "graphile-build";

declare module "graphile-build" {
  interface Options {
    /** Enable min/max ordering for columns in one-to-many relationships. */
    orderByRelatedColumnAggregates?: boolean;
    /** Maximum singular relationship path depth, from 1 through 5. */
    orderByRelatedMaxDepth?: number;
    /**
     * Use QueryBuilder-scoped LEFT JOINs for singular relationship ordering.
     * Requires graphile-build-pg 4.14.0. Defaults to false.
     */
    orderByRelatedUseJoins?: boolean;
  }
}

declare const PgOrderByRelatedPlugin: Plugin;
export default PgOrderByRelatedPlugin;
