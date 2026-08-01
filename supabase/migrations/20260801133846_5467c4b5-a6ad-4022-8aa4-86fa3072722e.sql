
-- ---------- id helper ----------
CREATE OR REPLACE FUNCTION public.next_code(p_table text, p_column text, p_prefix text, p_pad int)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_max bigint;
BEGIN
  EXECUTE format(
    'SELECT COALESCE(MAX(NULLIF(regexp_replace(substring(%I from %s), ''\D'', '''', ''g''), '''')::bigint), 0) FROM public.%I WHERE %I LIKE %L',
    p_column, length(p_prefix) + 1, p_table, p_column, p_prefix || '%'
  ) INTO v_max;
  RETURN p_prefix || lpad((v_max + 1)::text, p_pad, '0');
END $$;

-- ---------- sales orders ----------
CREATE OR REPLACE FUNCTION public.create_sales_order(p jsonb)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id text; v_line jsonb;
BEGIN
  v_id := COALESCE(NULLIF(p->>'id',''), public.next_code('sales_orders','id','SO-' || to_char(now(),'YYYY') || '-', 4));
  IF EXISTS (SELECT 1 FROM public.sales_orders WHERE id = v_id) THEN
    RAISE EXCEPTION 'Order % already exists', v_id USING ERRCODE = '23505';
  END IF;
  IF jsonb_array_length(COALESCE(p->'lines','[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'At least one order line is required' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.sales_orders (id, customer, order_date, delivery_date, priority, warehouse, carrier, route, status, validation, value_usd)
  VALUES (v_id, p->>'customer', (p->>'orderDate')::date, (p->>'deliveryDate')::date, p->>'priority',
          p->>'warehouse', p->>'carrier', COALESCE(p->>'route',''), COALESCE(p->>'status','Received'),
          COALESCE(p->>'validation','Pending'), COALESCE((p->>'valueUsd')::numeric, 0));

  FOR v_line IN SELECT * FROM jsonb_array_elements(p->'lines') LOOP
    INSERT INTO public.order_lines (order_id, sku, product, quantity, allocated, picked, location)
    VALUES (v_id, v_line->>'sku', COALESCE(v_line->>'product',''), (v_line->>'quantity')::int,
            COALESCE((v_line->>'allocated')::int,0), COALESCE((v_line->>'picked')::int,0), COALESCE(v_line->>'location',''))
    ON CONFLICT (order_id, sku) DO UPDATE SET quantity = public.order_lines.quantity + EXCLUDED.quantity;
  END LOOP;

  INSERT INTO public.activity_log (actor, action, target, type) VALUES (COALESCE(p->>'actor','System'), 'created sales order', v_id, 'order');
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.update_sales_order(p_id text, p jsonb)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_line jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.sales_orders WHERE id = p_id) THEN
    RAISE EXCEPTION 'Order % not found', p_id USING ERRCODE = 'P0002';
  END IF;
  UPDATE public.sales_orders SET
    customer = COALESCE(p->>'customer', customer),
    order_date = COALESCE((p->>'orderDate')::date, order_date),
    delivery_date = COALESCE((p->>'deliveryDate')::date, delivery_date),
    priority = COALESCE(p->>'priority', priority),
    warehouse = COALESCE(p->>'warehouse', warehouse),
    carrier = COALESCE(p->>'carrier', carrier),
    route = COALESCE(p->>'route', route),
    status = COALESCE(p->>'status', status),
    validation = COALESCE(p->>'validation', validation),
    value_usd = COALESCE((p->>'valueUsd')::numeric, value_usd)
  WHERE id = p_id;

  IF p ? 'lines' THEN
    DELETE FROM public.order_lines WHERE order_id = p_id;
    FOR v_line IN SELECT * FROM jsonb_array_elements(p->'lines') LOOP
      INSERT INTO public.order_lines (order_id, sku, product, quantity, allocated, picked, location)
      VALUES (p_id, v_line->>'sku', COALESCE(v_line->>'product',''), (v_line->>'quantity')::int,
              COALESCE((v_line->>'allocated')::int,0), COALESCE((v_line->>'picked')::int,0), COALESCE(v_line->>'location',''));
    END LOOP;
  END IF;

  INSERT INTO public.activity_log (actor, action, target, type) VALUES (COALESCE(p->>'actor','System'), 'updated sales order', p_id, 'order');
  RETURN p_id;
END $$;

CREATE OR REPLACE FUNCTION public.validate_sales_order(p_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_order public.sales_orders%ROWTYPE; v_credit text; v_lines int; v_result text; v_reason text := '';
BEGIN
  SELECT * INTO v_order FROM public.sales_orders WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order % not found', p_id USING ERRCODE = 'P0002'; END IF;

  SELECT credit_status INTO v_credit FROM public.customers WHERE name = v_order.customer;
  SELECT count(*) INTO v_lines FROM public.order_lines WHERE order_id = p_id;

  IF v_lines = 0 THEN v_result := 'Failed'; v_reason := 'Order has no lines';
  ELSIF v_credit = 'On Hold' THEN v_result := 'Failed'; v_reason := 'Customer credit is on hold';
  ELSIF v_order.delivery_date < v_order.order_date THEN v_result := 'Failed'; v_reason := 'Delivery date is before order date';
  ELSE v_result := 'Passed'; v_reason := 'All validation checks passed';
  END IF;

  UPDATE public.sales_orders
     SET validation = v_result,
         status = CASE WHEN v_result = 'Passed' AND status = 'Received' THEN 'Validated' ELSE status END
   WHERE id = p_id;

  INSERT INTO public.activity_log (actor, action, target, type) VALUES ('System', 'validated sales order', p_id, 'order');
  RETURN jsonb_build_object('validation', v_result, 'reason', v_reason);
END $$;

-- ---------- allocation (BR-149 / BR-158) ----------
CREATE OR REPLACE FUNCTION public.allocate_order(p_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order public.sales_orders%ROWTYPE; v_line public.order_lines%ROWTYPE;
  v_inv public.inventory%ROWTYPE; v_need int; v_take int; v_short int := 0; v_allocated int := 0; v_bo text;
BEGIN
  SELECT * INTO v_order FROM public.sales_orders WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order % not found', p_id USING ERRCODE = 'P0002'; END IF;
  IF v_order.validation <> 'Passed' THEN
    RAISE EXCEPTION 'Order % must pass validation before allocation', p_id USING ERRCODE = '23514';
  END IF;

  FOR v_line IN SELECT * FROM public.order_lines WHERE order_id = p_id LOOP
    v_need := GREATEST(v_line.quantity - v_line.allocated, 0);
    CONTINUE WHEN v_need = 0;
    SELECT * INTO v_inv FROM public.inventory WHERE sku = v_line.sku AND warehouse = v_order.warehouse FOR UPDATE;
    v_take := LEAST(v_need, COALESCE(v_inv.available, 0));

    IF v_take > 0 THEN
      UPDATE public.inventory SET available = available - v_take, reserved = reserved + v_take, allocated = allocated + v_take WHERE id = v_inv.id;
      UPDATE public.order_lines SET allocated = allocated + v_take WHERE id = v_line.id;
      v_allocated := v_allocated + v_take;
    END IF;

    IF v_need - v_take > 0 THEN
      v_short := v_short + (v_need - v_take);
      v_bo := public.next_code('backorders','id','BO-',4);
      INSERT INTO public.backorders (id, order_id, customer, sku, product, missing_qty, available_qty, suggested, reason, expected_date, priority, status)
      VALUES (v_bo, p_id, v_order.customer, v_line.sku, v_line.product, v_need - v_take, COALESCE(v_inv.available,0),
              LEAST(v_need - v_take, COALESCE(v_inv.available,0)), 'Insufficient stock at allocation',
              current_date + 7, v_order.priority, 'Open');
      INSERT INTO public.notifications (title, message, severity)
      VALUES ('Backorder created', v_bo || ' raised for ' || p_id || ' — ' || (v_need - v_take) || ' units short.', 'danger');
    END IF;
  END LOOP;

  UPDATE public.sales_orders
     SET status = CASE WHEN v_short > 0 THEN 'Backordered' WHEN v_allocated > 0 THEN 'Allocated' ELSE status END
   WHERE id = p_id;

  INSERT INTO public.activity_log (actor, action, target, type) VALUES ('System', 'allocated inventory for', p_id, 'order');
  RETURN jsonb_build_object('allocated', v_allocated, 'short', v_short);
END $$;

CREATE OR REPLACE FUNCTION public.reserve_order(p_id text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.sales_orders SET status = 'Reserved' WHERE id = p_id AND status = 'Allocated';
  IF NOT FOUND THEN RAISE EXCEPTION 'Order % must be allocated before reservation', p_id USING ERRCODE = '23514'; END IF;
  INSERT INTO public.activity_log (actor, action, target, type) VALUES ('System', 'reserved inventory for', p_id, 'order');
  RETURN p_id;
END $$;

-- ---------- waves ----------
CREATE OR REPLACE FUNCTION public.create_wave(p jsonb)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id text; v_order text; v_lines int; v_reserved boolean;
BEGIN
  v_id := COALESCE(NULLIF(p->>'id',''), public.next_code('waves','id','WV-' || to_char(now(),'YYYY') || '-', 4));
  IF EXISTS (SELECT 1 FROM public.waves WHERE id = v_id) THEN
    RAISE EXCEPTION 'Wave % already exists', v_id USING ERRCODE = '23505';
  END IF;
  IF jsonb_array_length(COALESCE(p->'orders','[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'Select at least one order for the wave' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.waves (id, name, warehouse, zone, priority, carrier, route, delivery_date, capacity, lines, reservation_confirmed, status, created_by)
  VALUES (v_id, p->>'name', p->>'warehouse', COALESCE(p->>'zone',''), COALESCE(p->>'priority','Medium'),
          COALESCE(p->>'carrier',''), COALESCE(p->>'route',''), (p->>'deliveryDate')::date,
          COALESCE((p->>'capacity')::int, 0), 0, false, COALESCE(p->>'status','Planned'), COALESCE(p->>'createdBy','System'));

  FOR v_order IN SELECT jsonb_array_elements_text(p->'orders') LOOP
    IF EXISTS (SELECT 1 FROM public.wave_orders wo JOIN public.waves w ON w.id = wo.wave_id
               WHERE wo.order_id = v_order AND w.status <> 'Completed' AND wo.wave_id <> v_id) THEN
      RAISE EXCEPTION 'Order % is already assigned to an active wave', v_order USING ERRCODE = '23505';
    END IF;
    INSERT INTO public.wave_orders (wave_id, order_id) VALUES (v_id, v_order) ON CONFLICT DO NOTHING;
    UPDATE public.sales_orders SET status = 'Wave Planned' WHERE id = v_order AND status IN ('Received','Validated','Allocated','Reserved');
  END LOOP;

  SELECT count(*) INTO v_lines FROM public.order_lines ol JOIN public.wave_orders wo ON wo.order_id = ol.order_id WHERE wo.wave_id = v_id;
  SELECT bool_and(so.status IN ('Reserved','Allocated','Wave Planned','Released','Picking'))
    INTO v_reserved FROM public.sales_orders so JOIN public.wave_orders wo ON wo.order_id = so.id WHERE wo.wave_id = v_id;
  UPDATE public.waves SET lines = v_lines, reservation_confirmed = COALESCE(v_reserved, false) WHERE id = v_id;

  INSERT INTO public.activity_log (actor, action, target, type) VALUES (COALESCE(p->>'createdBy','System'), 'planned wave', v_id, 'wave');
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.update_wave(p_id text, p jsonb)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_order text; v_lines int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.waves WHERE id = p_id) THEN
    RAISE EXCEPTION 'Wave % not found', p_id USING ERRCODE = 'P0002';
  END IF;
  UPDATE public.waves SET
    name = COALESCE(p->>'name', name),
    warehouse = COALESCE(p->>'warehouse', warehouse),
    zone = COALESCE(p->>'zone', zone),
    priority = COALESCE(p->>'priority', priority),
    carrier = COALESCE(p->>'carrier', carrier),
    route = COALESCE(p->>'route', route),
    delivery_date = COALESCE((p->>'deliveryDate')::date, delivery_date),
    capacity = COALESCE((p->>'capacity')::int, capacity),
    status = COALESCE(p->>'status', status)
  WHERE id = p_id;

  IF p ? 'orders' THEN
    DELETE FROM public.wave_orders WHERE wave_id = p_id;
    FOR v_order IN SELECT jsonb_array_elements_text(p->'orders') LOOP
      INSERT INTO public.wave_orders (wave_id, order_id) VALUES (p_id, v_order) ON CONFLICT DO NOTHING;
    END LOOP;
    SELECT count(*) INTO v_lines FROM public.order_lines ol JOIN public.wave_orders wo ON wo.order_id = ol.order_id WHERE wo.wave_id = p_id;
    UPDATE public.waves SET lines = v_lines WHERE id = p_id;
  END IF;

  INSERT INTO public.activity_log (actor, action, target, type) VALUES ('System', 'updated wave', p_id, 'wave');
  RETURN p_id;
END $$;

CREATE OR REPLACE FUNCTION public.confirm_wave_reservation(p_id text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ok boolean;
BEGIN
  SELECT bool_and(ol.allocated >= ol.quantity)
    INTO v_ok
    FROM public.order_lines ol JOIN public.wave_orders wo ON wo.order_id = ol.order_id
   WHERE wo.wave_id = p_id;
  UPDATE public.waves SET reservation_confirmed = COALESCE(v_ok,false) WHERE id = p_id;
  RETURN COALESCE(v_ok, false);
END $$;

CREATE OR REPLACE FUNCTION public.release_wave(p_id text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.waves%ROWTYPE;
BEGIN
  SELECT * INTO v FROM public.waves WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Wave % not found', p_id USING ERRCODE = 'P0002'; END IF;
  IF NOT v.reservation_confirmed THEN
    RAISE EXCEPTION 'Wave % cannot be released without confirmed inventory reservation', p_id USING ERRCODE = '23514';
  END IF;
  IF v.status NOT IN ('Draft','Planned') THEN
    RAISE EXCEPTION 'Wave % is already %', p_id, v.status USING ERRCODE = '23514';
  END IF;

  UPDATE public.waves SET status = 'Released' WHERE id = p_id;
  UPDATE public.sales_orders SET status = 'Released'
   WHERE id IN (SELECT order_id FROM public.wave_orders WHERE wave_id = p_id) AND status <> 'Shipped';

  INSERT INTO public.activity_log (actor, action, target, type) VALUES ('System', 'released wave', p_id, 'wave');
  INSERT INTO public.notifications (title, message, severity)
  VALUES ('Wave released', p_id || ' released with ' || v.lines || ' lines.', 'success');
  RETURN p_id;
END $$;

-- ---------- pick lists (BR-151) ----------
CREATE OR REPLACE FUNCTION public.generate_pick_lists(p_wave text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row record; v_count int := 0; v_id text; v_status text;
BEGIN
  SELECT status INTO v_status FROM public.waves WHERE id = p_wave;
  IF v_status IS NULL THEN RAISE EXCEPTION 'Wave % not found', p_wave USING ERRCODE = 'P0002'; END IF;
  IF v_status NOT IN ('Released','Picking','Completed') THEN
    RAISE EXCEPTION 'Pick lists can only be generated for released waves' USING ERRCODE = '23514';
  END IF;

  FOR v_row IN
    SELECT ol.sku, ol.product, ol.quantity, ol.location, p.barcode, w.zone
      FROM public.order_lines ol
      JOIN public.wave_orders wo ON wo.order_id = ol.order_id
      JOIN public.waves w ON w.id = wo.wave_id
      JOIN public.products p ON p.sku = ol.sku
     WHERE wo.wave_id = p_wave
       AND NOT EXISTS (SELECT 1 FROM public.pick_lines pl WHERE pl.wave_id = p_wave AND pl.sku = ol.sku AND pl.location = ol.location)
  LOOP
    v_id := public.next_code('pick_lines','id','PL-',4);
    INSERT INTO public.pick_lines (id, wave_id, picker, zone, location, sku, product, quantity, picked_qty, barcode, serial, verified, status)
    VALUES (v_id, p_wave, 'Unassigned', v_row.zone, v_row.location, v_row.sku, v_row.product, v_row.quantity, 0,
            v_row.barcode, 'SN-' || substr(md5(v_id || v_row.sku), 1, 8), false, 'Pending');
    v_count := v_count + 1;
  END LOOP;

  UPDATE public.waves SET status = 'Picking' WHERE id = p_wave AND status = 'Released' AND v_count > 0;
  INSERT INTO public.activity_log (actor, action, target, type) VALUES ('System', 'generated pick lists for', p_wave, 'pick');
  RETURN v_count;
END $$;

-- ---------- picking (BR-152) ----------
CREATE OR REPLACE FUNCTION public.confirm_pick(p_id text, p_barcode text, p_qty int, p_picker text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.pick_lines%ROWTYPE; v_status text;
BEGIN
  SELECT * INTO v FROM public.pick_lines WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pick line % not found', p_id USING ERRCODE = 'P0002'; END IF;
  IF p_barcode IS DISTINCT FROM v.barcode THEN
    RAISE EXCEPTION 'Barcode mismatch — scanned % but expected %', p_barcode, v.barcode USING ERRCODE = '23514';
  END IF;
  IF p_qty < 0 OR p_qty > v.quantity THEN
    RAISE EXCEPTION 'Picked quantity must be between 0 and %', v.quantity USING ERRCODE = '23514';
  END IF;

  v_status := CASE WHEN p_qty >= v.quantity THEN 'Picked' WHEN p_qty = 0 THEN 'Pending' ELSE 'Short' END;
  UPDATE public.pick_lines
     SET picked_qty = p_qty, verified = true, status = v_status, picker = COALESCE(NULLIF(p_picker,''), picker)
   WHERE id = p_id;

  UPDATE public.order_lines ol SET picked = LEAST(ol.quantity, p_qty)
    FROM public.wave_orders wo
   WHERE wo.wave_id = v.wave_id AND ol.order_id = wo.order_id AND ol.sku = v.sku;

  INSERT INTO public.activity_log (actor, action, target, type)
  VALUES (COALESCE(NULLIF(p_picker,''),'Picker'), 'verified pick line', p_id, 'pick');
  RETURN jsonb_build_object('status', v_status, 'pickedQty', p_qty);
END $$;

-- ---------- shipments ----------
CREATE OR REPLACE FUNCTION public.create_shipment(p jsonb)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id text; v_order text;
BEGIN
  v_id := COALESCE(NULLIF(p->>'id',''), public.next_code('shipments','id','SH-',5));
  IF EXISTS (SELECT 1 FROM public.shipments WHERE id = v_id) THEN
    RAISE EXCEPTION 'Shipment % already exists', v_id USING ERRCODE = '23505';
  END IF;
  INSERT INTO public.shipments (id, carrier, vehicle, driver, dock, container, seal, scheduled_at, destination, tracking_no, status)
  VALUES (v_id, p->>'carrier', NULLIF(p->>'vehicle',''), COALESCE(p->>'driver',''), COALESCE(p->>'dock',''),
          COALESCE(p->>'container',''), COALESCE(p->>'seal',''),
          NULLIF(p->>'scheduledAt','')::timestamptz, COALESCE(p->>'destination',''),
          COALESCE(NULLIF(p->>'trackingNo',''), 'TRK-' || substr(md5(v_id || now()::text), 1, 9)),
          COALESCE(p->>'status','Staged'));

  FOR v_order IN SELECT jsonb_array_elements_text(COALESCE(p->'orders','[]'::jsonb)) LOOP
    INSERT INTO public.shipment_orders (shipment_id, order_id) VALUES (v_id, v_order) ON CONFLICT DO NOTHING;
    UPDATE public.sales_orders SET status = 'Staged' WHERE id = v_order AND status NOT IN ('Shipped');
  END LOOP;

  INSERT INTO public.activity_log (actor, action, target, type) VALUES ('System', 'created shipment', v_id, 'ship');
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.update_shipment(p_id text, p jsonb)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_order text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.shipments WHERE id = p_id) THEN
    RAISE EXCEPTION 'Shipment % not found', p_id USING ERRCODE = 'P0002';
  END IF;
  UPDATE public.shipments SET
    carrier = COALESCE(p->>'carrier', carrier),
    vehicle = COALESCE(NULLIF(p->>'vehicle',''), vehicle),
    driver = COALESCE(p->>'driver', driver),
    dock = COALESCE(p->>'dock', dock),
    container = COALESCE(p->>'container', container),
    seal = COALESCE(p->>'seal', seal),
    scheduled_at = COALESCE(NULLIF(p->>'scheduledAt','')::timestamptz, scheduled_at),
    destination = COALESCE(p->>'destination', destination),
    tracking_no = COALESCE(p->>'trackingNo', tracking_no),
    status = COALESCE(p->>'status', status)
  WHERE id = p_id;

  IF p ? 'orders' THEN
    DELETE FROM public.shipment_orders WHERE shipment_id = p_id;
    FOR v_order IN SELECT jsonb_array_elements_text(p->'orders') LOOP
      INSERT INTO public.shipment_orders (shipment_id, order_id) VALUES (p_id, v_order) ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  INSERT INTO public.activity_log (actor, action, target, type) VALUES ('System', 'updated shipment', p_id, 'ship');
  RETURN p_id;
END $$;

CREATE OR REPLACE FUNCTION public.verify_load(p_id text, p_checklist jsonb, p_actor text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_required int := 6;
BEGIN
  IF jsonb_array_length(COALESCE(p_checklist,'[]'::jsonb)) < v_required THEN
    RAISE EXCEPTION 'All % checklist items must be completed before verification', v_required USING ERRCODE = '23514';
  END IF;
  UPDATE public.shipments
     SET load_verified = true, verification_checklist = p_checklist,
         status = CASE WHEN status IN ('Staged','Loading') THEN 'Ready for Shipment' ELSE status END
   WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Shipment % not found', p_id USING ERRCODE = 'P0002'; END IF;
  INSERT INTO public.activity_log (actor, action, target, type) VALUES (COALESCE(p_actor,'System'), 'verified load for', p_id, 'ship');
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.authorize_dispatch(p_id text, p_approve boolean, p_role text, p_actor text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.shipments%ROWTYPE;
BEGIN
  IF p_role NOT IN ('Warehouse Manager','Administrator') THEN
    RAISE EXCEPTION 'Only Warehouse Managers can authorize dispatch (BR-157)' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v FROM public.shipments WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Shipment % not found', p_id USING ERRCODE = 'P0002'; END IF;
  IF p_approve AND NOT v.load_verified THEN
    RAISE EXCEPTION 'Shipment % has not passed load verification (BR-156)', p_id USING ERRCODE = '23514';
  END IF;

  UPDATE public.shipments
     SET dispatch = CASE WHEN p_approve THEN 'Dispatched' ELSE 'Rejected' END,
         status = CASE WHEN p_approve THEN 'In Transit' ELSE status END
   WHERE id = p_id;

  IF p_approve THEN
    UPDATE public.sales_orders SET status = 'Shipped'
     WHERE id IN (SELECT order_id FROM public.shipment_orders WHERE shipment_id = p_id);
  END IF;

  INSERT INTO public.activity_log (actor, action, target, type)
  VALUES (COALESCE(p_actor,'System'), CASE WHEN p_approve THEN 'approved dispatch for' ELSE 'rejected dispatch for' END, p_id, 'ship');
  INSERT INTO public.notifications (title, message, severity)
  VALUES (CASE WHEN p_approve THEN 'Dispatch approved' ELSE 'Dispatch rejected' END, p_id || ' by ' || COALESCE(p_actor,'System') || '.',
          CASE WHEN p_approve THEN 'success' ELSE 'warning' END);
  RETURN p_id;
END $$;

-- ---------- backorders (BR-158 / BR-159) ----------
CREATE OR REPLACE FUNCTION public.resolve_backorder(p_id text, p_action text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.backorders%ROWTYPE; v_wh text; v_inv public.inventory%ROWTYPE; v_take int := 0;
BEGIN
  SELECT * INTO v FROM public.backorders WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Backorder % not found', p_id USING ERRCODE = 'P0002'; END IF;

  IF p_action = 'close' THEN
    UPDATE public.backorders SET status = 'Closed' WHERE id = p_id;
    INSERT INTO public.activity_log (actor, action, target, type) VALUES ('System', 'closed backorder', p_id, 'alert');
    RETURN jsonb_build_object('status','Closed','allocated',0);
  END IF;

  SELECT warehouse INTO v_wh FROM public.sales_orders WHERE id = v.order_id;
  SELECT * INTO v_inv FROM public.inventory WHERE sku = v.sku AND warehouse = v_wh FOR UPDATE;
  v_take := LEAST(v.missing_qty, COALESCE(v_inv.available, 0));
  IF v_take <= 0 THEN
    RAISE EXCEPTION 'No stock available to allocate for backorder %', p_id USING ERRCODE = '23514';
  END IF;

  UPDATE public.inventory SET available = available - v_take, reserved = reserved + v_take, allocated = allocated + v_take WHERE id = v_inv.id;
  UPDATE public.order_lines SET allocated = allocated + v_take WHERE order_id = v.order_id AND sku = v.sku;

  IF p_action = 'fulfil' AND v_take >= v.missing_qty THEN
    UPDATE public.backorders SET missing_qty = 0, available_qty = GREATEST(COALESCE(v_inv.available,0) - v_take, 0), suggested = 0, status = 'Fulfilled' WHERE id = p_id;
    UPDATE public.sales_orders SET status = 'Allocated' WHERE id = v.order_id AND status = 'Backordered';
  ELSE
    UPDATE public.backorders
       SET missing_qty = GREATEST(v.missing_qty - v_take, 0),
           available_qty = GREATEST(COALESCE(v_inv.available,0) - v_take, 0),
           suggested = LEAST(GREATEST(v.missing_qty - v_take, 0), GREATEST(COALESCE(v_inv.available,0) - v_take, 0)),
           status = CASE WHEN v.missing_qty - v_take <= 0 THEN 'Fulfilled' ELSE 'Partially Allocated' END
     WHERE id = p_id;
  END IF;

  INSERT INTO public.activity_log (actor, action, target, type) VALUES ('System', 'allocated stock to backorder', p_id, 'alert');
  RETURN jsonb_build_object('allocated', v_take);
END $$;

-- ---------- grants ----------
GRANT EXECUTE ON FUNCTION
  public.next_code(text,text,text,int),
  public.create_sales_order(jsonb), public.update_sales_order(text,jsonb), public.validate_sales_order(text),
  public.allocate_order(text), public.reserve_order(text),
  public.create_wave(jsonb), public.update_wave(text,jsonb), public.confirm_wave_reservation(text), public.release_wave(text),
  public.generate_pick_lists(text), public.confirm_pick(text,text,int,text),
  public.create_shipment(jsonb), public.update_shipment(text,jsonb), public.verify_load(text,jsonb,text),
  public.authorize_dispatch(text,boolean,text,text), public.resolve_backorder(text,text)
TO anon, authenticated, service_role;
