-- 003_verification_schedule.sql
-- CDMX 2026 schedule (Semester 1: Jan 1 – Jun 30, Semester 2: Jul 1 – Dec 31)
-- Source: SEDEMA — https://www.sedema.cdmx.gob.mx/programas/programa/verificacion-vehicular
-- Hologram '0': vehicles with hologram 0 verify every 6 months
-- Hologram '00': exempt or double-zero, annual
-- Rule: last digit of plates rotates monthly within semester
-- Below is the CDMX 2026 rotation (last digit → verification months)
INSERT INTO verification_schedule (state, plate_last_digit, hologram, semester, year, start_date, end_date, notes) VALUES
-- Semester 1 2026 (Hologram 0 — biannual)
('CDMX', '5,6', '0', 1, 2026, '2026-01-02', '2026-02-28', 'Enero-Febrero'),
('CDMX', '7,8', '0', 1, 2026, '2026-03-02', '2026-04-30', 'Marzo-Abril'),
('CDMX', '3,4', '0', 1, 2026, '2026-05-04', '2026-06-30', 'Mayo-Junio'),
-- Semester 2 2026 (Hologram 0 — biannual)
('CDMX', '5,6', '0', 2, 2026, '2026-07-01', '2026-08-31', 'Julio-Agosto'),
('CDMX', '7,8', '0', 2, 2026, '2026-09-01', '2026-10-31', 'Septiembre-Octubre'),
('CDMX', '3,4', '0', 2, 2026, '2026-11-02', '2026-12-31', 'Noviembre-Diciembre'),
-- Hologram 00 (annual — semester 1 only for odd year-model, semester 2 for even)
('CDMX', '1,2', '00', 1, 2026, '2026-01-02', '2026-06-30', 'Hologram 00 odd year-model'),
('CDMX', '9,0', '00', 2, 2026, '2026-07-01', '2026-12-31', 'Hologram 00 even year-model');
-- NOTE: verify current year schedule at https://www.sedema.cdmx.gob.mx before each year update.
-- The scrape-verification edge function updates this table automatically every January.
