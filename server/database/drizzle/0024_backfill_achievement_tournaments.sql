INSERT INTO tournaments (organization_id, name, level, venue, start_date, end_date, created_at, updated_at)
SELECT organization_id, tournament_name, tournament_level, venue, start_date, end_date, created_at, updated_at
FROM student_achievements
WHERE tournament_id IS NULL
GROUP BY organization_id, tournament_name, tournament_level, venue, start_date, end_date;

UPDATE student_achievements
SET tournament_id = (
  SELECT tournaments.id
  FROM tournaments
  WHERE tournaments.organization_id = student_achievements.organization_id
    AND tournaments.name = student_achievements.tournament_name
    AND tournaments.level = student_achievements.tournament_level
    AND tournaments.start_date = student_achievements.start_date
  ORDER BY tournaments.id
  LIMIT 1
)
WHERE tournament_id IS NULL;
