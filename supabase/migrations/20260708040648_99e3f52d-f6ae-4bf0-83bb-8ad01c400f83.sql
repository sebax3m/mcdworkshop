
DROP TABLE IF EXISTS public._import_stg;
CREATE TABLE public._import_stg (
  cliente text, telefono text, email text,
  marca text, modelo text, anio int, patente text
);
GRANT ALL ON public._import_stg TO service_role;
