-- Datos demo equivalentes a los `mockUsers` que tenía server/index.ts,
-- para que el botón "Rellenar Demo" del LoginForm funcione contra Supabase.

insert into fichas (codigo_ficha, programa)
values ('2847251', 'Técnico en Cocina')
on conflict (codigo_ficha) do nothing;

insert into usuarios (nombre, cedula, email, password_hash, rol, ficha_id)
select 'Carlos Ruiz', '1005678901', 'cruiz@misena.edu.co', 'demo123', 'aprendiz', f.id
from fichas f where f.codigo_ficha = '2847251'
on conflict (cedula) do nothing;

insert into usuarios (nombre, cedula, email, password_hash, rol)
values ('María Fernanda Gómez', '1098765432', 'mgomez@sena.edu.co', 'demo123', 'instructor')
on conflict (cedula) do nothing;

update fichas set instructor_id = u.id
from usuarios u
where fichas.codigo_ficha = '2847251' and u.cedula = '1098765432';

insert into reconocimiento_facial (usuario_id, modelo)
select id, 'demo' from usuarios where cedula = '1005678901'
on conflict do nothing;
