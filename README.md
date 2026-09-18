# @graphile-contrib/pg-order-by-related

[![Package on npm](https://img.shields.io/npm/v/@graphile-contrib/pg-order-by-related.svg)](https://www.npmjs.com/package/@graphile-contrib/pg-order-by-related)

This Graphile Engine plugin adds additional enum values to the `orderBy` argument on connections, allowing you to order by columns in related tables.

> Requires `postgraphile@^4.3.1` or `graphile-build-pg@^4.3.1` for the default
> scalar-subquery mode. Join-backed ordering requires `graphile-build-pg@4.14.0`.

Example:

```graphql
{
  # additional enum values exposed here 👇
  allPosts(orderBy: PERSON_BY_AUTHOR_ID__CREATED_AT_ASC) {
    nodes {
      headline
      personByAuthorId {
        id
        name
        about
      }
    }
  }
}
```

One-to-one and many-to-one relations are supported. For one-to-many relations, `__COUNT_ASC`/`__COUNT_DESC` enums allow ordering by the number of related records.

## Usage

Append this plugin and the additional `orderBy` options will be added to your schema.

### CLI

```bash
yarn add postgraphile
yarn add @graphile-contrib/pg-order-by-related
npx postgraphile --append-plugins @graphile-contrib/pg-order-by-related
```

### Library

```js
const express = require("express");
const { postgraphile } = require("postgraphile");
const PgOrderByRelatedPlugin = require("@graphile-contrib/pg-order-by-related");

const app = express();

app.use(
  postgraphile(process.env.DATABASE_URL, "app_public", {
    appendPlugins: [PgOrderByRelatedPlugin],
    graphiql: true,
  })
);

app.listen(5000);
```

## Inflection

To avoid naming conflicts, this plugin uses a `<TABLE>_BY_<KEY>` naming convention (e.g. `USER_BY_AUTHOR_ID__CREATED_AT_ASC`), similar to how related fields are named by default in PostGraphile v4.

You can override this by adding an inflector plugin. For example, the following plugin shortens the names by dropping the `<TABLE>_BY` portion (producing e.g. `AUTHOR_ID__CREATED_AT_ASC`):

```js
const { makeAddInflectorsPlugin } = require("graphile-utils");

module.exports = makeAddInflectorsPlugin(
  {
    orderByRelatedColumnEnum(attr, ascending, foreignTable, keyAttributes) {
      return `${this.constantCase(
        keyAttributes.map((keyAttr) => this._columnName(keyAttr)).join("-and-")
      )}__${this.orderByColumnEnum(attr, ascending)}`;
    },
  },
  true // Passing true here allows the plugin to overwrite existing inflectors.
);
```

See the [makeAddInflectorsPlugin documentation](https://www.graphile.org/postgraphile/make-add-inflectors-plugin/) for more information.

## Options

When using PostGraphile as a library, the following options can be specified via `graphileBuildOptions`.

### orderByRelatedUseJoins

By default, singular related ordering uses the package's original correlated
scalar subquery. Set `orderByRelatedUseJoins: true` to order singular
relationships through QueryBuilder-scoped `LEFT JOIN`s instead:

```js
postgraphile(pgConfig, schema, {
  appendPlugins: [PgOrderByRelatedPlugin],
  graphileBuildOptions: {
    orderByRelatedUseJoins: true,
  },
});
```

For example, a composite relationship produces SQL in this shape:

```sql
from root
left join related as related_alias
  on root.brand_id = related_alias.brand_id
 and root.account_owner_id = related_alias.user_id
order by related_alias.email
```

Join mode has these constraints:

- It requires `graphile-build-pg@4.14.0`. Access to that version's internal
  QueryBuilder join storage is isolated in a compatibility helper that fails
  clearly if the expected structure changes.
- It applies only when every path segment targets columns covered by a real
  database primary-key or unique constraint. This includes real forward foreign
  keys, real reverse one-to-one relationships, and smart forward relationships
  that target a real unique key. Count, min, max, and other one-to-many
  aggregate ordering continues to use aggregate subqueries.
- Joins are always `LEFT JOIN`s. Missing or RLS-hidden related rows therefore
  leave the root row present with a null ordering value.
- Composite keys add every corresponding key pair to the join condition.
  Nested singular paths add one reusable join per path segment. Join reuse is
  local to one QueryBuilder; relationship filters remain independent.
- Smart `@unique` and `@primaryKey` declarations are not sufficient for join
  eligibility because PostgreSQL does not enforce them. Those paths retain the
  scalar-subquery implementation. Join mode does not use `distinct`, `group by`,
  or `limit 1` to hide duplicate related rows. Smart uniqueness should still
  describe genuinely unique output because PostGraphile exposes the relation as
  singular, but join mode does not rely on that declaration.

Join-backed ordering supports `first`, `offset`, `last`, `before`, `after`,
`totalCount`, and `pageInfo`. PostGraphile 4 reuses cursor values and bounds in
page checks without replaying the outer sorting joins. The plugin scopes those
expressions in scalar SELECTs that carry the same singular LEFT JOINs. Main-query
cursor bounds and ORDER BY use the existing sorting joins directly, avoiding
per-row join subqueries when filtering a page. This relies on QueryBuilder 4.14
requesting both bounds for the main query and at most one for a page check.
Requests without cursor expressions retain their original SQL. Missing and RLS-hidden related records still preserve the root row.

This preserves PostGraphile 4's existing cursor comparison semantics, including
its limitation when traversing null ordering values; it does not replace the
core cursor comparator. Offset pagination and page checks retain null records.

In the consuming application benchmark that motivated this option, the
correlated form took approximately 58 ms and the equivalent set-based join took
7.94 ms. This is workload-specific; the test suite asserts SQL shape and
results, not timing.

### orderByRelatedMaxDepth

Controls the maximum singular relationship path depth. The default is `1`; the
accepted range is `1` through `5`. A table can override the global setting with
an `@orderByRelatedMaxDepth` smart tag.

```js
postgraphile(pgConfig, schema, {
  graphileBuildOptions: {
    orderByRelatedMaxDepth: 3,
  },
});
```

### orderByRelatedColumnAggregates

Adds additional enum values for column aggregates (currently `min` and `max`) for one-to-many relationships.

Example:

```js
postgraphile(pgConfig, schema, {
  graphileBuildOptions: {
    orderByRelatedColumnAggregates: true,
  },
});
```

```graphql
{
  allPersons(orderBy: POSTS_BY_AUTHOR_ID__MAX_CREATED_AT_ASC, first: 10) {
    nodes {
      id
      name
    }
  }
}
```

## Development

To establish a test environment, create an empty PostgreSQL database and set a `TEST_DATABASE_URL` environment variable with your database connection string.

```bash
createdb graphile_test
export TEST_DATABASE_URL=postgres://localhost:5432/graphile_test
yarn
yarn test
```
