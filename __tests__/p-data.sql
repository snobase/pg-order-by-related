insert into p.parent(id, name) values
  (1, 'parent1'),
  (2, 'parent2');

insert into p.forward(id, name) values
  (1, 'forward1'),
  (2, 'forward2'),
  (3, 'forward3'),
  (4, 'forward4');

insert into p.forward_compound(forward_compound_1, forward_compound_2, name) values
  (1, 1, 'forwardCompound11'),
  (1, 2, 'forwardCompound12'),
  (2, 1, 'forwardCompound21'),
  (2, 2, 'forwardCompound22');

insert into p.foo (id, name, parent_id, forward_id, forward_compound_1, forward_compound_2, backward_compound_1, backward_compound_2) values
  (1, 'TEST', 1, 1, 1, 1, 1, 1),
  (2, 'Test', 1, 2, 1, 2, 1, 2),
  (3, 'tEST', 2, 3, 2, 1, 2, 1),
  (4, 'test', 2, 4, 2, 2, 2, 2),
  (5, null, null, null, null, null, null, null);

insert into p.backward(id, name, foo_id) values
  (1, 'backward1', 1),
  (2, 'backward2', 2),
  (3, 'backward3', 3),
  (4, 'backward4', 4);

insert into p.backward_compound(backward_compound_1, backward_compound_2, name) values
  (1, 1, 'backwardCompound11'),
  (1, 2, 'backwardCompound12'),
  (2, 1, 'backwardCompound21'),
  (2, 2, 'backwardCompound22');

insert into p.child(id, name, foo_id) values
  (1, 'child1', 1),
  (2, 'child2', 1),
  (3, 'child3', 2),
  (4, 'child4', 2);

insert into j.team (id, name) values
  (1, 'Alpha team'),
  (2, 'Omega team');

insert into j.region (id, name) values
  (1, 'East'),
  (2, 'West');

insert into j.related_account
  (brand_id, user_id, email, score, team_id, region_id)
values
  (1, 10, 'zeta@example.test', 30, 2, 1),
  (1, 20, 'alpha@example.test', 10, 1, 2),
  (2, 10, 'middle@example.test', 20, 1, 1);

insert into j.root
  (id, name, brand_id, owner_user_id)
values
  (1, 'root one', 1, 10),
  (2, 'root two', 1, 20),
  (3, 'root three', 2, 10),
  (4, 'root four', null, null),
  (5, 'root five', 1, 20);

insert into j.dual_root
  (id, owner_brand_id, owner_user_id, reviewer_brand_id, reviewer_user_id)
values
  (1, 1, 10, 1, 20),
  (2, 1, 20, 1, 10),
  (3, 2, 10, null, null);

insert into j.root_profile (root_id, label) values
  (1, 'Zulu profile'),
  (2, 'Alpha profile'),
  (3, 'Middle profile'),
  (5, 'Beta profile');

insert into j.root_child (id, root_id, amount) values
  (1, 1, 4),
  (2, 1, 8),
  (3, 2, 2),
  (4, 3, 9),
  (5, 3, 3),
  (6, 3, 1);

insert into j.employee (id, name, manager_id) values
  (1, 'chief', null),
  (2, 'beta report', 1),
  (3, 'alpha report', 2),
  (4, 'independent', null);
