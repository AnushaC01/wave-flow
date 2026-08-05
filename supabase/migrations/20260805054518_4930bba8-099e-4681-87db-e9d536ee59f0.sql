ALTER TABLE public.pick_lines ALTER COLUMN wave_id DROP NOT NULL;
ALTER TABLE public.pick_lines ADD COLUMN IF NOT EXISTS order_id text REFERENCES public.sales_orders(id);
CREATE INDEX IF NOT EXISTS pick_lines_order_id_idx ON public.pick_lines(order_id);

CREATE OR REPLACE FUNCTION public.create_manual_pick_list(p_order text, p_actor text DEFAULT 'System')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_order public.sales_orders%ROWTYPE; v_row record; v_count int := 0; v_id text; v_zone text;
BEGIN
  SELECT * INTO v_order FROM public.sales_orders WHERE id = p_order FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order % not found', p_order USING ERRCODE = 'P0002'; END IF;
  IF v_order.validation <> 'Passed' THEN
    RAISE EXCEPTION 'Order % has not passed validation', p_order USING ERRCODE = '23514';
  END IF;
  IF v_order.status IN ('Cancelled','Shipped','Packed') THEN
    RAISE EXCEPTION 'Order % is % and cannot be picked', p_order, v_order.status USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public.wave_orders wo JOIN public.waves w ON w.id = wo.wave_id
             WHERE wo.order_id = p_order AND w.status <> 'Completed') THEN
    RAISE EXCEPTION 'Order % is assigned to a wave — its pick list is generated on wave release', p_order USING ERRCODE = '23505';
  END IF;
  IF EXISTS (SELECT 1 FROM public.pick_lines WHERE order_id = p_order) THEN
    RAISE EXCEPTION 'A pick list already exists for order %', p_order USING ERRCODE = '23505';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.order_lines WHERE order_id = p_order) THEN
    RAISE EXCEPTION 'Order % has no lines', p_order USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public.order_lines WHERE order_id = p_order AND allocated < quantity) THEN
    RAISE EXCEPTION 'Order % must be fully allocated and reserved before manual pick list creation', p_order USING ERRCODE = '23514';
  END IF;
  IF v_order.status NOT IN ('Allocated','Reserved','Ready for Picking') THEN
    RAISE EXCEPTION 'Order % must be allocated and reserved (current status: %)', p_order, v_order.status USING ERRCODE = '23514';
  END IF;

  FOR v_row IN
    SELECT ol.sku, ol.product, ol.quantity, ol.location, p.barcode
      FROM public.order_lines ol JOIN public.products p ON p.sku = ol.sku
     WHERE ol.order_id = p_order
  LOOP
    SELECT i.zone INTO v_zone FROM public.inventory i
     WHERE i.sku = v_row.sku AND i.warehouse = v_order.warehouse
     ORDER BY (i.location = v_row.location) DESC LIMIT 1;
    v_id := public.next_code('pick_lines','id','PL-',4);
    INSERT INTO public.pick_lines (id, wave_id, order_id, picker, zone, location, sku, product, quantity, picked_qty, barcode, serial, verified, status)
    VALUES (v_id, NULL, p_order, 'Unassigned', COALESCE(v_zone,''), v_row.location, v_row.sku, v_row.product, v_row.quantity, 0,
            v_row.barcode, 'SN-' || substr(md5(v_id || v_row.sku), 1, 8), false, 'Pending');
    v_count := v_count + 1;
  END LOOP;

  UPDATE public.sales_orders SET status = 'Ready for Picking' WHERE id = p_order;
  INSERT INTO public.activity_log (actor, action, target, type)
  VALUES (COALESCE(p_actor,'System'), 'created manual pick list for', p_order, 'pick');
  INSERT INTO public.notifications (title, message, severity)
  VALUES ('Manual pick list created', v_count || ' pick lines created for ' || p_order || ' (no wave).', 'success');
  RETURN jsonb_build_object('order', p_order, 'lines', v_count);
END $function$;

CREATE OR REPLACE FUNCTION public.confirm_pick(p_id text, p_barcode text, p_qty integer, p_picker text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v public.pick_lines%ROWTYPE; v_status text; v_delta int; v_wh text; v_inv public.inventory%ROWTYPE; v_take int;
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
  v_delta := p_qty - v.picked_qty;

  UPDATE public.pick_lines
     SET picked_qty = p_qty, verified = true, status = v_status, picker = COALESCE(NULLIF(p_picker,''), picker)
   WHERE id = p_id;

  IF v.wave_id IS NOT NULL THEN
    UPDATE public.order_lines ol SET picked = LEAST(ol.quantity, p_qty)
      FROM public.wave_orders wo
     WHERE wo.wave_id = v.wave_id AND ol.order_id = wo.order_id AND ol.sku = v.sku;
    SELECT w.warehouse INTO v_wh FROM public.waves w WHERE w.id = v.wave_id;
  ELSE
    UPDATE public.order_lines ol SET picked = LEAST(ol.quantity, p_qty)
     WHERE ol.order_id = v.order_id AND ol.sku = v.sku;
    SELECT so.warehouse INTO v_wh FROM public.sales_orders so WHERE so.id = v.order_id;
    UPDATE public.sales_orders SET status = 'Picking'
     WHERE id = v.order_id AND status IN ('Ready for Picking','Allocated','Reserved');
  END IF;

  IF v_delta > 0 AND v_wh IS NOT NULL THEN
    SELECT * INTO v_inv FROM public.inventory
     WHERE sku = v.sku AND warehouse = v_wh AND location = v.location FOR UPDATE;
    IF NOT FOUND THEN
      SELECT * INTO v_inv FROM public.inventory WHERE sku = v.sku AND warehouse = v_wh FOR UPDATE;
    END IF;
    IF FOUND THEN
      v_take := LEAST(v_delta, v_inv.reserved);
      UPDATE public.inventory
         SET reserved = GREATEST(reserved - v_take, 0),
             allocated = GREATEST(allocated - v_take, 0)
       WHERE id = v_inv.id;
    END IF;
  END IF;

  INSERT INTO public.activity_log (actor, action, target, type)
  VALUES (COALESCE(NULLIF(p_picker,''),'Picker'), 'verified pick line', p_id, 'pick');
  RETURN jsonb_build_object('status', v_status, 'pickedQty', p_qty);
END $function$;

CREATE OR REPLACE FUNCTION public.complete_order_picking(p_order text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_open int;
BEGIN
  SELECT count(*) INTO v_open FROM public.pick_lines
   WHERE order_id = p_order AND wave_id IS NULL AND status IN ('Pending','In Progress');
  IF v_open > 0 THEN
    RAISE EXCEPTION '% pick line(s) for % are not confirmed yet', v_open, p_order USING ERRCODE = '23514';
  END IF;
  UPDATE public.sales_orders SET status = 'Packed' WHERE id = p_order AND status IN ('Picking','Ready for Picking');
  INSERT INTO public.activity_log (actor, action, target, type) VALUES ('System', 'completed picking for', p_order, 'pick');
  RETURN p_order;
END $function$;