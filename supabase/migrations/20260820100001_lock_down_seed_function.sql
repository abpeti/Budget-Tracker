-- A seed_default_categories kizárólag az on_auth_user_created triggeren
-- keresztül hívódjon (SECURITY DEFINER kontextusban) — ne legyen közvetlenül
-- hívható PostgREST RPC végpontként, ahol egy authenticated user tetszőleges
-- p_user_id-t adhatna meg.
revoke execute on function public.seed_default_categories(uuid) from public;
revoke execute on function public.seed_default_categories(uuid) from anon;
revoke execute on function public.seed_default_categories(uuid) from authenticated;
