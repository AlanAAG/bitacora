-- 003_verification_schedule.sql
-- CDMX 2026 verification calendar. The verification MONTH is driven by the plate's
-- last digit (engomado color); the HOLOGRAM drives whether you verify at all and how
-- often (00/exento/electric = exempt; 0 = every semester; 1/2 = every semester).
-- We seed the plate-digit -> month map under hologram '0' as the canonical source;
-- verification-agent matches by plate digit + year and decides exemption from the car's
-- hologram. Source: SEDEMA calendario verificación 2026.
--   5,6 -> Ene–Feb | 7,8 -> Feb–Mar | 3,4 -> Mar–Abr | 1,2 -> Abr–May | 9,0 -> May–Jun
-- Second semester mirrors the same digit->color mapping across Jul–Dic.
-- NOTE: confirm exact day ranges + UMA-pegged costs/fines against sedema.cdmx.gob.mx
-- each January; the scrape-verification edge function refreshes this table.
INSERT INTO verification_schedule (state, plate_last_digit, hologram, semester, year, start_date, end_date, notes) VALUES
-- Semester 1 2026
('CDMX', '5,6', '0', 1, 2026, '2026-01-02', '2026-02-28', 'Amarillo · Enero–Febrero'),
('CDMX', '7,8', '0', 1, 2026, '2026-02-02', '2026-03-31', 'Rosa · Febrero–Marzo'),
('CDMX', '3,4', '0', 1, 2026, '2026-03-02', '2026-04-30', 'Rojo · Marzo–Abril'),
('CDMX', '1,2', '0', 1, 2026, '2026-04-01', '2026-05-31', 'Verde · Abril–Mayo'),
('CDMX', '9,0', '0', 1, 2026, '2026-05-04', '2026-06-30', 'Azul · Mayo–Junio'),
-- Semester 2 2026 (same digit->color mapping, Jul–Dic)
('CDMX', '5,6', '0', 2, 2026, '2026-07-01', '2026-08-31', 'Amarillo · Julio–Agosto'),
('CDMX', '7,8', '0', 2, 2026, '2026-08-03', '2026-09-30', 'Rosa · Agosto–Septiembre'),
('CDMX', '3,4', '0', 2, 2026, '2026-09-01', '2026-10-31', 'Rojo · Septiembre–Octubre'),
('CDMX', '1,2', '0', 2, 2026, '2026-10-01', '2026-11-30', 'Verde · Octubre–Noviembre'),
('CDMX', '9,0', '0', 2, 2026, '2026-11-02', '2026-12-31', 'Azul · Noviembre–Diciembre');
