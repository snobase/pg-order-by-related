const { readFile } = require("fs").promises;
const { graphql } = require("graphql");
const { createPostGraphileSchema } = require("postgraphile-core");
const { withPgClient } = require("../helpers");

const plugin = require("../../index.js");

const joinOptions = {
  appendPlugins: [plugin],
  disableDefaultMutations: true,
  graphileBuildOptions: {
    orderByRelatedColumnAggregates: true,
    orderByRelatedMaxDepth: 3,
    orderByRelatedUseJoins: true,
  },
};

const scalarOptions = {
  ...joinOptions,
  graphileBuildOptions: {
    ...joinOptions.graphileBuildOptions,
    orderByRelatedUseJoins: false,
  },
};

const compactSql = (text) => text.replace(/\s+/g, " ").trim();
const leftJoinCount = (text) => (text.match(/\bleft join\b/gi) || []).length;

let fixtures;

beforeAll(async () => {
  fixtures = await withPgClient(async (pgClient) => {
    await pgClient.query(
      await readFile(`${__dirname}/../p-data.sql`, { encoding: "utf8" })
    );

    const scalarSchema = await createPostGraphileSchema(
      pgClient,
      ["j"],
      scalarOptions
    );
    const joinSchema = await createPostGraphileSchema(
      pgClient,
      ["j"],
      joinOptions
    );

    const execute = async (schema, source) => {
      const statements = [];
      const query = pgClient.query;
      pgClient.query = function recordedQuery(config, values, callback) {
        const text = typeof config === "string" ? config : config.text;
        statements.push(compactSql(text));
        return query.call(this, config, values, callback);
      };
      try {
        const result = await graphql(schema, source, null, { pgClient });
        if (result.errors) {
          throw result.errors[0];
        }
        return {
          data: JSON.parse(JSON.stringify(result.data)),
          sql: statements.join("\n"),
        };
      } finally {
        pgClient.query = query;
      }
    };

    const orderByEmail =
      "RELATED_ACCOUNT_BY_BRAND_ID_AND_OWNER_USER_ID__EMAIL_ASC";

    return {
      scalarSchema,
      joinSchema,
      scalar: await execute(
        scalarSchema,
        `{ allRoots(orderBy: ${orderByEmail}) { nodes { id } } }`
      ),
      forwardAsc: await execute(
        joinSchema,
        `{ allRoots(orderBy: ${orderByEmail}) { nodes { id } totalCount } }`
      ),
      forwardDesc: await execute(
        joinSchema,
        `{ allRoots(orderBy: RELATED_ACCOUNT_BY_BRAND_ID_AND_OWNER_USER_ID__EMAIL_DESC) { nodes { id } } }`
      ),
      oneHopForward: await execute(
        joinSchema,
        `{ allRelatedAccounts(orderBy: TEAM_BY_TEAM_ID__NAME_ASC) { nodes { brandId userId } } }`
      ),
      reverse: await execute(
        joinSchema,
        `{ allRoots(orderBy: ROOT_PROFILE_BY_ROOT_ID__LABEL_ASC) { nodes { id } } }`
      ),
      virtualComposite: await execute(
        joinSchema,
        `{ allVirtualRoots(orderBy: ${orderByEmail}) { nodes { id } } }`
      ),
      smartUniqueFallback: await execute(
        joinSchema,
        `{ allRoots(orderBy: VIRTUAL_PROFILE_BY_ROOT_ID__LABEL_ASC) { nodes { id } } }`
      ),
      samePath: await execute(
        joinSchema,
        `{ allRoots(orderBy: [${orderByEmail}, RELATED_ACCOUNT_BY_BRAND_ID_AND_OWNER_USER_ID__SCORE_ASC]) { nodes { id } } }`
      ),
      nestedSamePath: await execute(
        joinSchema,
        `{ allRoots(orderBy: [TEAM_BY_TEAM_ID__NAME_ASC, TEAM_BY_TEAM_ID__ID_ASC]) { nodes { id } } }`
      ),
      sharedPrefix: await execute(
        joinSchema,
        `{ allRoots(orderBy: [TEAM_BY_TEAM_ID__NAME_ASC, REGION_BY_REGION_ID__NAME_ASC]) { nodes { id } } }`
      ),
      distinctRelations: await execute(
        joinSchema,
        `{ allDualRoots(orderBy: [RELATED_ACCOUNT_BY_OWNER_BRAND_ID_AND_OWNER_USER_ID__EMAIL_ASC, RELATED_ACCOUNT_BY_REVIEWER_BRAND_ID_AND_REVIEWER_USER_ID__EMAIL_ASC]) { nodes { id } } }`
      ),
      selfRelation: await execute(
        joinSchema,
        `{ allEmployees(orderBy: EMPLOYEE_BY_MANAGER_ID__NAME_ASC) { nodes { id } } }`
      ),
      computed: await execute(
        joinSchema,
        `{ allRoots(orderBy: RELATED_ACCOUNT_BY_BRAND_ID_AND_OWNER_USER_ID__SORT_KEY_ASC) { nodes { id } } }`
      ),
      filtered: await execute(
        joinSchema,
        `{ allRoots(condition: { name: "root three" }, orderBy: ${orderByEmail}) { nodes { id } totalCount } }`
      ),
      pageOne: await execute(
        joinSchema,
        `{ allRoots(first: 2, offset: 1, orderBy: ${orderByEmail}) { nodes { id } totalCount } }`
      ),
      pageTwo: await execute(
        joinSchema,
        `{ allRoots(first: 2, offset: 1, orderBy: ${orderByEmail}) { nodes { id } totalCount } }`
      ),
      aggregate: await execute(
        joinSchema,
        `{ allRoots(orderBy: ROOT_CHILDREN_BY_ROOT_ID__COUNT_DESC) { nodes { id } totalCount } }`
      ),
      aggregateColumn: await execute(
        joinSchema,
        `{ allRoots(orderBy: ROOT_CHILDREN_BY_ROOT_ID__MAX_AMOUNT_DESC) { nodes { id } } }`
      ),
    };
  });
});

test("keeps correlated scalar subqueries when join mode is disabled", () => {
  expect(fixtures.scalar.data.allRoots.nodes.map(({ id }) => id)).toEqual([
    2, 5, 3, 1, 4,
  ]);
  expect(fixtures.scalar.sql).toContain(
    'order by ( select "email" from "j"."related_account" where'
  );
  expect(fixtures.scalar.sql).not.toMatch(/\bleft join\b/i);
});

test("orders through one forward composite LEFT JOIN in both directions", () => {
  expect(fixtures.forwardAsc.data).toEqual({
    allRoots: {
      nodes: [{ id: 2 }, { id: 5 }, { id: 3 }, { id: 1 }, { id: 4 }],
      totalCount: 5,
    },
  });
  expect(fixtures.forwardDesc.data.allRoots.nodes.map(({ id }) => id)).toEqual([
    4, 1, 3, 2, 5,
  ]);
  expect(leftJoinCount(fixtures.forwardAsc.sql)).toBe(1);
  expect(fixtures.forwardAsc.sql).toMatch(
    /left join "j"\."related_account" as (__local_\d+__) on \(__local_\d+__\."brand_id" = \1\."brand_id"\) and \(__local_\d+__\."owner_user_id" = \1\."user_id"\)/
  );
  expect(fixtures.forwardAsc.sql).toMatch(
    /order by __local_\d+__\."email" ASC/
  );
  expect(fixtures.forwardDesc.sql).toMatch(
    /order by __local_\d+__\."email" DESC/
  );
});

test("orders a one-hop forward singular relationship", () => {
  expect(fixtures.oneHopForward.data).toEqual({
    allRelatedAccounts: {
      nodes: [
        { brandId: 1, userId: 20 },
        { brandId: 2, userId: 10 },
        { brandId: 1, userId: 10 },
      ],
    },
  });
  expect(leftJoinCount(fixtures.oneHopForward.sql)).toBe(1);
  expect(fixtures.oneHopForward.sql).toMatch(
    /left join "j"\."team" as (__local_\d+__) on \(__local_\d+__\."team_id" = \1\."id"\)/
  );
});

test("orders reverse one-to-one and virtual composite relationships", () => {
  expect(fixtures.reverse.data.allRoots.nodes.map(({ id }) => id)).toEqual([
    2, 5, 3, 1, 4,
  ]);
  expect(fixtures.reverse.sql).toMatch(
    /left join "j"\."root_profile" as __local_\d+__ on \(__local_\d+__\."id" = __local_\d+__\."root_id"\)/
  );
  expect(
    fixtures.virtualComposite.data.allVirtualRoots.nodes.map(({ id }) => id)
  ).toEqual([2, 5, 3, 1, 4]);
  expect(fixtures.virtualComposite.sql).toMatch(
    /left join "j"\."related_account" as (__local_\d+__) on \(__local_\d+__\."brand_id" = \1\."brand_id"\) and \(__local_\d+__\."owner_user_id" = \1\."user_id"\)/
  );
});

test("keeps smart-only uniqueness on the scalar-subquery path", () => {
  expect(
    fixtures.smartUniqueFallback.data.allRoots.nodes.map(({ id }) => id)
  ).toEqual([2, 5, 3, 1, 4]);
  expect(leftJoinCount(fixtures.smartUniqueFallback.sql)).toBe(0);
  expect(fixtures.smartUniqueFallback.sql).toContain(
    'order by ( select "label" from "j"."virtual_profile" where'
  );
});

test("reuses same-path joins and shared nested prefixes", () => {
  expect(leftJoinCount(fixtures.samePath.sql)).toBe(1);
  expect(fixtures.samePath.sql).toMatch(
    /order by (__local_\d+__)\."email" ASC,\1\."score" ASC/
  );
  expect(leftJoinCount(fixtures.nestedSamePath.sql)).toBe(2);
  expect(leftJoinCount(fixtures.sharedPrefix.sql)).toBe(3);
  expect(
    fixtures.nestedSamePath.data.allRoots.nodes.map(({ id }) => id)
  ).toEqual([2, 3, 5, 1, 4]);
});

test("keeps aliases distinct for two relationships to one table", () => {
  expect(
    fixtures.distinctRelations.data.allDualRoots.nodes.map(({ id }) => id)
  ).toEqual([2, 3, 1]);
  const aliases = Array.from(
    fixtures.distinctRelations.sql.matchAll(
      /left join "j"\."related_account" as (__local_\d+__)/g
    ),
    (match) => match[1]
  );
  expect(aliases).toHaveLength(2);
  expect(new Set(aliases).size).toBe(2);
});

test("supports self-relations and related computed columns", () => {
  expect(
    fixtures.selfRelation.data.allEmployees.nodes.map(({ id }) => id)
  ).toEqual([3, 2, 1, 4]);
  expect(fixtures.selfRelation.sql).toMatch(
    /left join "j"\."employee" as (__local_\d+__) on \(__local_\d+__\."manager_id" = \1\."id"\)/
  );
  expect(fixtures.computed.data.allRoots.nodes.map(({ id }) => id)).toEqual([
    2, 5, 1, 3, 4,
  ]);
  expect(fixtures.computed.sql).toMatch(
    /order by case when \(__local_\d+__ is null\) then null else "j"\."related_account_sort_key"\(__local_\d+__\) end ASC/
  );
});

test("keeps filters independent and first/offset pages stable", () => {
  expect(fixtures.filtered.data).toEqual({
    allRoots: { nodes: [{ id: 3 }], totalCount: 1 },
  });
  expect(fixtures.filtered.sql).toMatch(
    /where \(__local_\d+__\."name" = \$1\)/
  );
  expect(fixtures.pageOne.data).toEqual({
    allRoots: { nodes: [{ id: 5 }, { id: 3 }], totalCount: 5 },
  });
  expect(fixtures.pageTwo.data).toEqual(fixtures.pageOne.data);
});

test("does not multiply roots and leaves aggregate ordering on subqueries", () => {
  const ids = fixtures.forwardAsc.data.allRoots.nodes.map(({ id }) => id);
  expect(ids).toHaveLength(5);
  expect(new Set(ids).size).toBe(5);
  expect(fixtures.aggregate.data).toEqual({
    allRoots: {
      nodes: [{ id: 3 }, { id: 1 }, { id: 2 }, { id: 4 }, { id: 5 }],
      totalCount: 5,
    },
  });
  expect(leftJoinCount(fixtures.aggregate.sql)).toBe(0);
  expect(fixtures.aggregate.sql).toContain(
    'order by ( select count(*) from "j"."root_child" where'
  );
  expect(
    fixtures.aggregateColumn.data.allRoots.nodes.map(({ id }) => id)
  ).toEqual([4, 5, 3, 1, 2]);
  expect(leftJoinCount(fixtures.aggregateColumn.sql)).toBe(0);
  expect(fixtures.aggregateColumn.sql).toContain(
    'order by ( select max("amount") from "j"."root_child" where'
  );
});

test("keeps nested ordering enum names unchanged", () => {
  expect(
    fixtures.joinSchema
      .getType("RootsOrderBy")
      .getValues()
      .map(({ name }) => name)
  ).toEqual(
    fixtures.scalarSchema
      .getType("RootsOrderBy")
      .getValues()
      .map(({ name }) => name)
  );
});

test("compiled SQL uses LEFT JOIN and no correlated ordering subquery", () => {
  expect(fixtures.forwardAsc.sql).toMatchSnapshot("forward composite join SQL");
  expect(fixtures.forwardAsc.sql).toMatch(/\bleft join\b/i);
  expect(fixtures.forwardAsc.sql).not.toContain(
    'order by ( select "email" from "j"."related_account"'
  );
});
