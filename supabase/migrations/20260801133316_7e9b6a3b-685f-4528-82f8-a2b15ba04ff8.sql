
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

-- ============ reference data ============
CREATE TABLE public.warehouses (
  code text PRIMARY KEY,
  name text NOT NULL,
  city text NOT NULL DEFAULT '',
  zones text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.zones (
  name text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.carriers (
  name text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.routes (
  code text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.docks (
  name text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.vehicles (
  id text PRIMARY KEY,
  plate text NOT NULL,
  type text NOT NULL,
  driver text NOT NULL,
  capacity_pallets integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.customers (
  id text PRIMARY KEY,
  name text NOT NULL UNIQUE,
  segment text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  country text NOT NULL DEFAULT '',
  credit_status text NOT NULL DEFAULT 'Approved' CHECK (credit_status IN ('Approved','On Hold','Review')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.products (
  sku text PRIMARY KEY,
  name text NOT NULL,
  uom text NOT NULL DEFAULT 'EA',
  category text NOT NULL DEFAULT '',
  barcode text NOT NULL UNIQUE,
  weight_kg numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============ orders ============
CREATE TABLE public.sales_orders (
  id text PRIMARY KEY,
  customer text NOT NULL REFERENCES public.customers(name) ON UPDATE CASCADE,
  order_date date NOT NULL DEFAULT current_date,
  delivery_date date NOT NULL DEFAULT current_date,
  priority text NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Critical','High','Medium','Low')),
  warehouse text NOT NULL REFERENCES public.warehouses(code) ON UPDATE CASCADE,
  carrier text NOT NULL,
  route text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'Received',
  validation text NOT NULL DEFAULT 'Pending' CHECK (validation IN ('Pending','Passed','Failed')),
  value_usd numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.order_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE ON UPDATE CASCADE,
  sku text NOT NULL REFERENCES public.products(sku) ON UPDATE CASCADE,
  product text NOT NULL DEFAULT '',
  quantity integer NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  allocated integer NOT NULL DEFAULT 0 CHECK (allocated >= 0),
  picked integer NOT NULL DEFAULT 0 CHECK (picked >= 0),
  location text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, sku)
);
CREATE INDEX order_lines_order_idx ON public.order_lines(order_id);

CREATE TABLE public.inventory (
  id text PRIMARY KEY,
  sku text NOT NULL REFERENCES public.products(sku) ON UPDATE CASCADE,
  product text NOT NULL DEFAULT '',
  warehouse text NOT NULL REFERENCES public.warehouses(code) ON UPDATE CASCADE,
  zone text NOT NULL DEFAULT '',
  location text NOT NULL DEFAULT '',
  available integer NOT NULL DEFAULT 0 CHECK (available >= 0),
  reserved integer NOT NULL DEFAULT 0 CHECK (reserved >= 0),
  allocated integer NOT NULL DEFAULT 0 CHECK (allocated >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sku, warehouse)
);

-- ============ waves ============
CREATE TABLE public.waves (
  id text PRIMARY KEY,
  name text NOT NULL,
  warehouse text NOT NULL REFERENCES public.warehouses(code) ON UPDATE CASCADE,
  zone text NOT NULL DEFAULT '',
  priority text NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Critical','High','Medium','Low')),
  carrier text NOT NULL DEFAULT '',
  route text NOT NULL DEFAULT '',
  delivery_date date,
  capacity integer NOT NULL DEFAULT 0,
  lines integer NOT NULL DEFAULT 0,
  reservation_confirmed boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','Planned','Released','Picking','Completed')),
  created_by text NOT NULL DEFAULT 'System',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.wave_orders (
  wave_id text NOT NULL REFERENCES public.waves(id) ON DELETE CASCADE ON UPDATE CASCADE,
  order_id text NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE ON UPDATE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (wave_id, order_id)
);

CREATE TABLE public.pick_lines (
  id text PRIMARY KEY,
  wave_id text NOT NULL REFERENCES public.waves(id) ON DELETE CASCADE ON UPDATE CASCADE,
  picker text NOT NULL DEFAULT '',
  zone text NOT NULL DEFAULT '',
  location text NOT NULL DEFAULT '',
  sku text NOT NULL REFERENCES public.products(sku) ON UPDATE CASCADE,
  product text NOT NULL DEFAULT '',
  quantity integer NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  picked_qty integer NOT NULL DEFAULT 0 CHECK (picked_qty >= 0),
  barcode text NOT NULL DEFAULT '',
  serial text NOT NULL DEFAULT '',
  verified boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','In Progress','Picked','Short')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pick_lines_wave_idx ON public.pick_lines(wave_id);

CREATE TABLE public.packing_records (
  id text PRIMARY KEY,
  order_id text NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE ON UPDATE CASCADE,
  wave_id text REFERENCES public.waves(id) ON DELETE SET NULL ON UPDATE CASCADE,
  package_type text NOT NULL DEFAULT 'Carton' CHECK (package_type IN ('Carton','Pallet','Tote','Crate')),
  carton text NOT NULL DEFAULT '',
  weight_kg numeric(10,2) NOT NULL DEFAULT 0 CHECK (weight_kg >= 0),
  dimensions text NOT NULL DEFAULT '',
  material text NOT NULL DEFAULT '',
  label_number text NOT NULL DEFAULT '',
  station text NOT NULL DEFAULT '',
  operator text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','In Progress','Completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.shipments (
  id text PRIMARY KEY,
  carrier text NOT NULL DEFAULT '',
  vehicle text REFERENCES public.vehicles(id) ON UPDATE CASCADE,
  driver text NOT NULL DEFAULT '',
  dock text NOT NULL DEFAULT '',
  container text NOT NULL DEFAULT '',
  seal text NOT NULL DEFAULT '',
  scheduled_at timestamptz,
  destination text NOT NULL DEFAULT '',
  tracking_no text NOT NULL DEFAULT '',
  load_verified boolean NOT NULL DEFAULT false,
  verification_checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  dispatch text NOT NULL DEFAULT 'Awaiting Dispatch' CHECK (dispatch IN ('Awaiting Dispatch','Approved','Rejected','Dispatched')),
  status text NOT NULL DEFAULT 'Staged' CHECK (status IN ('Staged','Loading','Ready for Shipment','In Transit','Delivered')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.shipment_orders (
  shipment_id text NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE ON UPDATE CASCADE,
  order_id text NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE ON UPDATE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (shipment_id, order_id)
);

CREATE TABLE public.backorders (
  id text PRIMARY KEY,
  order_id text NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE ON UPDATE CASCADE,
  customer text NOT NULL DEFAULT '',
  sku text NOT NULL REFERENCES public.products(sku) ON UPDATE CASCADE,
  product text NOT NULL DEFAULT '',
  missing_qty integer NOT NULL DEFAULT 0 CHECK (missing_qty >= 0),
  available_qty integer NOT NULL DEFAULT 0 CHECK (available_qty >= 0),
  suggested integer NOT NULL DEFAULT 0 CHECK (suggested >= 0),
  reason text NOT NULL DEFAULT '',
  expected_date date,
  priority text NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Critical','High','Medium','Low')),
  status text NOT NULL DEFAULT 'Open' CHECK (status IN ('Open','Partially Allocated','Fulfilled','Closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor text NOT NULL DEFAULT 'System',
  action text NOT NULL,
  target text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'order' CHECK (type IN ('order','wave','pick','pack','ship','alert')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX activity_log_created_idx ON public.activity_log(created_at DESC);

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text NOT NULL DEFAULT '',
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info','success','warning','danger')),
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============ grants, RLS, policies ============
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'warehouses','zones','carriers','routes','docks','vehicles','customers','products',
    'sales_orders','order_lines','inventory','waves','wave_orders','pick_lines',
    'packing_records','shipments','shipment_orders','backorders','activity_log',
    'notifications','app_settings'
  ] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "Public read %1$s" ON public.%1$I FOR SELECT USING (true)', t);
    EXECUTE format('CREATE POLICY "Public insert %1$s" ON public.%1$I FOR INSERT WITH CHECK (true)', t);
    EXECUTE format('CREATE POLICY "Public update %1$s" ON public.%1$I FOR UPDATE USING (true) WITH CHECK (true)', t);
    EXECUTE format('CREATE POLICY "Public delete %1$s" ON public.%1$I FOR DELETE USING (true)', t);
  END LOOP;
END $$;

-- ============ updated_at triggers ============
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'warehouses','vehicles','customers','products','sales_orders','order_lines','inventory',
    'waves','pick_lines','packing_records','shipments','backorders','app_settings'
  ] LOOP
    EXECUTE format('CREATE TRIGGER set_updated_at_%1$s BEFORE UPDATE ON public.%1$I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t);
  END LOOP;
END $$;
