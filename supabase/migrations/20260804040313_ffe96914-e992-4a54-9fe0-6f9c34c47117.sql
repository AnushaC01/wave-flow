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

  UPDATE public.order_lines ol SET picked = LEAST(ol.quantity, p_qty)
    FROM public.wave_orders wo
   WHERE wo.wave_id = v.wave_id AND ol.order_id = wo.order_id AND ol.sku = v.sku;

  -- deduct newly picked units from reserved/allocated stock
  IF v_delta > 0 THEN
    SELECT w.warehouse INTO v_wh FROM public.waves w WHERE w.id = v.wave_id;
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

CREATE OR REPLACE FUNCTION public.authorize_dispatch(p_id text, p_approve boolean, p_role text, p_actor text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v public.shipments%ROWTYPE; v_orders int;
BEGIN
  IF p_role NOT IN ('Warehouse Manager','Administrator') THEN
    RAISE EXCEPTION 'Only Warehouse Managers can authorize dispatch (BR-157)' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v FROM public.shipments WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Shipment % not found', p_id USING ERRCODE = 'P0002'; END IF;
  IF v.dispatch = 'Dispatched' THEN
    RAISE EXCEPTION 'Shipment % has already been dispatched', p_id USING ERRCODE = '23514';
  END IF;

  IF p_approve THEN
    IF NOT v.load_verified THEN
      RAISE EXCEPTION 'Shipment % has not passed load verification (BR-156)', p_id USING ERRCODE = '23514';
    END IF;
    IF COALESCE(NULLIF(v.vehicle,''), NULL) IS NULL THEN
      RAISE EXCEPTION 'Shipment % has no vehicle assigned', p_id USING ERRCODE = '23514';
    END IF;
    IF COALESCE(NULLIF(v.driver,''), NULL) IS NULL THEN
      RAISE EXCEPTION 'Shipment % has no driver assigned', p_id USING ERRCODE = '23514';
    END IF;
    IF COALESCE(NULLIF(v.dock,''), NULL) IS NULL THEN
      RAISE EXCEPTION 'Shipment % has no dock assigned', p_id USING ERRCODE = '23514';
    END IF;
    SELECT count(*) INTO v_orders FROM public.shipment_orders WHERE shipment_id = p_id;
    IF v_orders = 0 THEN
      RAISE EXCEPTION 'Shipment % has no orders loaded', p_id USING ERRCODE = '23514';
    END IF;
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
END $function$;

CREATE OR REPLACE FUNCTION public.set_shipment_status(p_id text, p_status text, p_actor text DEFAULT 'System')
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v public.shipments%ROWTYPE;
BEGIN
  IF p_status NOT IN ('Staged','Loading','Ready for Shipment','In Transit','Delivered') THEN
    RAISE EXCEPTION 'Unknown shipment status %', p_status USING ERRCODE = '23514';
  END IF;
  SELECT * INTO v FROM public.shipments WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Shipment % not found', p_id USING ERRCODE = 'P0002'; END IF;
  IF p_status IN ('In Transit','Delivered') AND v.dispatch <> 'Dispatched' THEN
    RAISE EXCEPTION 'Shipment % must be dispatch-authorized first (BR-157)', p_id USING ERRCODE = '23514';
  END IF;

  UPDATE public.shipments
     SET status = p_status,
         tracking_no = COALESCE(NULLIF(tracking_no,''), 'TRK-' || upper(substr(md5(p_id || now()::text), 1, 9)))
   WHERE id = p_id;

  IF p_status IN ('In Transit','Delivered') THEN
    UPDATE public.sales_orders SET status = 'Shipped'
     WHERE id IN (SELECT order_id FROM public.shipment_orders WHERE shipment_id = p_id)
       AND status <> 'Shipped';
  END IF;

  INSERT INTO public.activity_log (actor, action, target, type)
  VALUES (COALESCE(p_actor,'System'), 'set shipment status to ' || p_status || ' for', p_id, 'ship');
  RETURN p_id;
END $function$;