
INSERT INTO public.customers (first_name, last_name, phone, email)
VALUES
  ('James', 'Wilson', '+64 21 555 0101', 'james.wilson@example.co.nz'),
  ('Sophie', 'Nguyen', '+64 22 555 0102', 'sophie.nguyen@example.co.nz'),
  ('Aroha', 'Tane', '+64 27 555 0103', 'aroha.tane@example.co.nz'),
  ('Ethan', 'Patel', '+64 21 555 0104', 'ethan.patel@example.co.nz'),
  ('Chloe', 'Andersen', '+64 22 555 0105', 'chloe.andersen@example.co.nz')
ON CONFLICT DO NOTHING;
