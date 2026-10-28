create type order_status as enum
  ('inquiry','quoted','awaiting_deposit','in_design','approved','printing','ready','delivered','cancelled');
create type payment_method as enum ('cash','charge_anywhere','wire','check','other');

create table customers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  user_id uuid not null default auth.uid(),
  name text not null,
  phone text,
  email text,
  notes text
);

create sequence orders_order_no_seq start 1001;

create table orders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  user_id uuid not null default auth.uid(),
  order_no int not null default nextval('orders_order_no_seq'),
  customer_id uuid references customers on delete restrict,
  title text not null,
  details text,
  product_type text,
  quantity int default 1,
  price numeric(10,2) not null default 0,
  due_date date,
  status order_status default 'inquiry',
  source text,
  delivered_at timestamptz
);
alter sequence orders_order_no_seq owned by orders.order_no;

create table payments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  user_id uuid not null default auth.uid(),
  order_id uuid references orders on delete cascade,
  amount numeric(10,2) not null check (amount > 0),
  method payment_method,
  paid_at date default current_date,
  reference text
);

create table order_files (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  user_id uuid not null default auth.uid(),
  order_id uuid references orders on delete cascade,
  path text,
  name text
);

create index on customers (phone);
create index on orders (customer_id);
create index on orders (due_date);
create index on payments (order_id);
create index on order_files (order_id);

-- lateral sum uses the payments(order_id) index, so filtered/single-order reads stay cheap as data grows
create view order_summary with (security_invoker = true) as
select
  o.*,
  c.name as customer_name,
  c.phone as customer_phone,
  p.paid,
  o.price - p.paid as balance,
  case
    when p.paid = 0 then 'unpaid'
    when o.price - p.paid <= 0 then 'paid'
    else 'partial'
  end as payment_state
from orders o
left join customers c on c.id = o.customer_id
cross join lateral (select coalesce(sum(amount), 0)::numeric(10,2) as paid from payments where order_id = o.id) p;

-- RLS: owner only. FK checks bypass RLS, so writes also verify the parent row is the caller's.
alter table customers enable row level security;
alter table orders enable row level security;
alter table payments enable row level security;
alter table order_files enable row level security;

create policy own_customers on customers for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy own_orders on orders for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and (customer_id is null or exists
    (select 1 from customers c where c.id = customer_id and c.user_id = auth.uid())));

create policy own_payments on payments for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists
    (select 1 from orders o where o.id = order_id and o.user_id = auth.uid()));

create policy own_order_files on order_files for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists
    (select 1 from orders o where o.id = order_id and o.user_id = auth.uid()));

-- Storage: private bucket, files live under <user_id>/<order_id>/...
insert into storage.buckets (id, name, public) values ('order-files', 'order-files', false)
on conflict (id) do nothing;

create policy own_files_select on storage.objects for select to authenticated
  using (bucket_id = 'order-files' and (storage.foldername(name))[1] = auth.uid()::text);
create policy own_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'order-files' and (storage.foldername(name))[1] = auth.uid()::text);
create policy own_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'order-files' and (storage.foldername(name))[1] = auth.uid()::text);
