drop schema if exists p cascade;
drop schema if exists j cascade;

create schema p;
create schema j;

create table p.parent (
  id serial primary key,
  name text not null
);

create table p.forward (
  id serial primary key,
  name text not null
);

create table p.forward_compound (
  forward_compound_1 int,
  forward_compound_2 int,
  name text,
  primary key (forward_compound_1, forward_compound_2)
);

create table p.foo (
  id serial primary key,
  name text,
  parent_id int references p.parent (id),
  forward_id int unique references p.forward (id),
  forward_compound_1 int,
  forward_compound_2 int,
  backward_compound_1 int,
  backward_compound_2 int,
  unique (forward_compound_1, forward_compound_2),
  unique (backward_compound_1, backward_compound_2),
  foreign key (forward_compound_1, forward_compound_2) references p.forward_compound (forward_compound_1, forward_compound_2)
);

create table p.backward (
  id serial primary key,
  name text not null,
  foo_id int unique references p.foo (id)
);

create table p.backward_compound (
  backward_compound_1 int,
  backward_compound_2 int,
  name text,
  primary key (backward_compound_1, backward_compound_2),
  foreign key (backward_compound_1, backward_compound_2) references p.foo (backward_compound_1, backward_compound_2)
);

create table p.child (
  id serial primary key,
  name text not null,
  foo_id int references p.foo (id)
);

create function p.forward_computed(forward p.forward) returns text as $$
  select md5(forward.name);
$$ language sql stable;

create function p.forward_computed_sortable(forward p.forward) returns text as $$
  select md5(forward.name);
$$ language sql stable;

comment on function p.forward_computed_sortable(forward p.forward) is E'@sortable';

create table j.team (
  id int primary key,
  name text not null
);

create table j.region (
  id int primary key,
  name text not null
);

create table j.related_account (
  brand_id int not null,
  user_id int not null,
  email text not null,
  score int not null,
  team_id int references j.team (id),
  region_id int references j.region (id),
  primary key (brand_id, user_id)
);

create table j.root (
  id int primary key,
  name text not null,
  brand_id int,
  owner_user_id int,
  foreign key (brand_id, owner_user_id)
    references j.related_account (brand_id, user_id)
);

create table j.dual_root (
  id int primary key,
  owner_brand_id int,
  owner_user_id int,
  reviewer_brand_id int,
  reviewer_user_id int,
  foreign key (owner_brand_id, owner_user_id)
    references j.related_account (brand_id, user_id),
  foreign key (reviewer_brand_id, reviewer_user_id)
    references j.related_account (brand_id, user_id)
);

comment on table j.dual_root is E'@orderByRelatedMaxDepth 1';

create table j.root_profile (
  root_id int primary key references j.root (id),
  label text not null
);

create table j.root_child (
  id int primary key,
  root_id int not null references j.root (id),
  amount int not null
);

create table j.employee (
  id int primary key,
  name text not null,
  manager_id int references j.employee (id)
);

create view j.virtual_root as
select id, name, brand_id, owner_user_id
from j.root;

comment on view j.virtual_root is E'@primaryKey id\n@foreignKey (brand_id, owner_user_id) references j.related_account (brand_id, user_id)';

create view j.virtual_profile as
select root_id, label
from j.root_profile;

comment on view j.virtual_profile is E'@unique root_id\n@foreignKey (root_id) references j.root (id)';

create function j.related_account_sort_key(account j.related_account)
returns text as $$
  select coalesce(reverse(account.email), 'missing related account');
$$ language sql stable;

comment on function j.related_account_sort_key(account j.related_account) is E'@sortable';
