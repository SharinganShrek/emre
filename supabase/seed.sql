-- =============================================================================
-- Emre — sample data for a single user.
-- =============================================================================
-- Usage: sign up a user first, find their id in Authentication → Users, then
-- replace the UUID in the `uid` CTE below and run this file.
-- (The Next.js app also ships an in-browser seed dataset for local dev, so this
--  file is only needed when persisting to Supabase.)
-- =============================================================================

do $$
declare
  uid uuid := '00000000-0000-0000-0000-000000000000'; -- <-- replace me
  h_sat uuid; h_skin uuid; h_gym uuid;
  g_sat uuid; g_paper uuid;
  proj uuid;
begin
  if not exists (select 1 from auth.users where id = uid) then
    raise notice 'Replace `uid` with a real auth.users id before seeding.';
    return;
  end if;

  insert into public.profiles (user_id, display_name, timezone, bio)
  values (uid, 'Emre', 'Europe/Istanbul', 'Building Emre — my personal operating system.')
  on conflict (user_id) do nothing;

  -- Habits
  insert into public.habits (user_id, name, color, icon, sort_order) values
    (uid,'SAT','#7c9cff','BookA',0) returning id into h_sat;
  insert into public.habits (user_id, name, color, icon, sort_order) values
    (uid,'Skincare','#fbbf24','Sparkles',1) returning id into h_skin;
  insert into public.habits (user_id, name, color, icon, sort_order) values
    (uid,'Gym','#f87171','Dumbbell',2) returning id into h_gym;

  -- A week of habit logs
  insert into public.habit_logs (user_id, habit_id, log_date, completed, count)
  select uid, h.id, current_date - g, true, 1
  from (values (h_sat),(h_skin),(h_gym)) as h(id),
       generate_series(0,6) as g
  on conflict (habit_id, log_date) do nothing;

  -- Tasks
  insert into public.tasks (user_id, title, status, priority, due_date, project) values
    (uid,'Finish SAT reading practice set 4','todo','high', current_date + 1,'SAT'),
    (uid,'Draft intro for lung CT paper','in_progress','high', current_date + 3,'Research'),
    (uid,'Build Analytics page for Emre','in_progress','medium', current_date,'Emre');

  -- Goals + milestones
  insert into public.goals (user_id, title, description, category, progress, target_date)
  values (uid,'SAT 1550+','Score 1550 or higher on the SAT.','Academics',62, current_date + 120)
  returning id into g_sat;
  insert into public.goals (user_id, title, description, category, progress, target_date)
  values (uid,'Publish AI research paper','Submit lung CT segmentation paper.','Research',35, current_date + 180)
  returning id into g_paper;
  insert into public.goal_milestones (user_id, goal_id, title, done, sort_order) values
    (uid, g_sat,'Full-length test above 1450', true, 0),
    (uid, g_sat,'Math consistently above 750', false, 1),
    (uid, g_paper,'Baseline U-Net results', false, 0);

  -- Study + practice tests
  insert into public.study_sessions (user_id, subject, duration_minutes, session_date, notes) values
    (uid,'SAT Math',60, current_date - 1,'Algebra drills'),
    (uid,'SAT Reading',45, current_date - 2,'2 passages, timed');
  insert into public.practice_tests (user_id, test_name, test_date, math_score, reading_writing_score, total_score) values
    (uid,'College Board Practice 1', current_date - 21, 690, 660, 1350),
    (uid,'College Board Practice 3', current_date - 3, 740, 710, 1450);

  -- Research (sample project requested in the brief)
  insert into public.research_projects (user_id, title, description, status)
  values (uid,'Lung CT Segmentation Research','Segment lung nodules from CT scans using a U-Net variant.','active')
  returning id into proj;
  insert into public.research_papers (user_id, project_id, title, authors, url, status) values
    (uid, proj,'U-Net: Convolutional Networks for Biomedical Image Segmentation','Ronneberger et al.','https://arxiv.org/abs/1505.04597','read');
  insert into public.research_experiments (user_id, project_id, name, hypothesis, status, run_date) values
    (uid, proj,'Baseline U-Net (256x256)','Vanilla U-Net reaches >0.80 Dice.','done', current_date - 12);

  -- Fitness
  insert into public.gym_sessions (user_id, session_date, duration_minutes, focus) values
    (uid, current_date - 1, 55, 'Push'),
    (uid, current_date - 3, 60, 'Pull');

  -- Movies + books
  insert into public.movies (user_id, title, kind, status, rating, review, watched_date) values
    (uid,'Frieren: Beyond Journey''s End','anime','watched',10,'Quiet and beautiful.', current_date - 6),
    (uid,'Vinland Saga','anime','watching',9,'Thorfinn''s arc is incredible.', null);
  insert into public.books (user_id, title, author, status, rating) values
    (uid,'Atomic Habits','James Clear','read',8),
    (uid,'Deep Learning','Goodfellow et al.','reading',null);

  -- Journal + notes
  insert into public.journal_entries (user_id, entry_date, mood, content) values
    (uid, current_date, 4, 'Productive day. Shipped the dashboard skeleton.');
  insert into public.notes (user_id, title, body, tags, category, pinned) values
    (uid,'Emre roadmap','MVP: dashboard, habits, goals, study.', array['emre-hub','roadmap'],'project', true);
end;
$$;
