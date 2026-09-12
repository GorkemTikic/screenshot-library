UPDATE contributors
SET owner_key = 'cs-gorkem-t'
WHERE trim(display_name) COLLATE NOCASE IN ('CS Gorkem T', 'CS Görkem T');

UPDATE contributors
SET owner_key = 'cs-enzo'
WHERE trim(display_name) COLLATE NOCASE = 'CS Enzo';

UPDATE contributors
SET owner_key = 'cs-vera'
WHERE trim(display_name) COLLATE NOCASE = 'CS Vera';
