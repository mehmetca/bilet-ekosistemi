-- Create trigger for orders table
-- This automatically updates updated_at when orders are modified

CREATE TRIGGER orders_updated_at
    BEFORE UPDATE ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
