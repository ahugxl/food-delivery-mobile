-- Speed up live menu hash checks and sweetness-option lookups.
create index if not exists food_option_groups_food_id_id_idx
  on public.food_option_groups (food_id, id);
create index if not exists food_option_items_group_id_id_idx
  on public.food_option_items (group_id, id);
analyze public.food_option_groups;
analyze public.food_option_items;
