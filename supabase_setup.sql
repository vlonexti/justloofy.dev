-- Run this entire script in the Supabase SQL Editor

-- 1. Create a Profiles table to store custom usernames and linked accounts
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid references auth.users not null,
  username text unique not null,
  minecraft_username text,
  discord_username text,
  rank text default 'Player',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (id)
);

-- 2. Turn on Row Level Security (RLS) for the profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Allow public read access to profiles
CREATE POLICY "Public profiles are viewable by everyone."
  ON profiles FOR SELECT
  USING ( true );

-- 4. Allow users to update their own profile
CREATE POLICY "Users can insert their own profile."
  ON profiles FOR INSERT
  WITH CHECK ( auth.uid() = id );

CREATE POLICY "Users can update own profile."
  ON profiles FOR UPDATE
  USING ( auth.uid() = id );

-- 5. Trigger to automatically create a profile when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)));
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- =========================================================================
-- SERVER INTEGRATIONS
-- =========================================================================

-- Create Announcements table
CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  content text not null,
  author text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Announcements are viewable by everyone."
  ON public.announcements FOR SELECT USING (true);
CREATE POLICY "Only admins can insert announcements"
  ON public.announcements FOR INSERT WITH CHECK (true); -- In prod, secure this

-- Create Applications table
CREATE TABLE IF NOT EXISTS public.applications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  discord_username text not null,
  minecraft_username text not null,
  age integer not null,
  experience text not null,
  reason text not null,
  status text default 'pending',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert their own applications"
  ON public.applications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own applications"
  ON public.applications FOR SELECT USING (auth.uid() = user_id);

-- =========================================================================
-- CREATE YOUR ACCOUNT (JustLoofy)
-- =========================================================================
-- Email: frenzersteven1@gmail.com
-- Password: 2469mofo
-- Username: JustLoofy

INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  recovery_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'frenzersteven1@gmail.com',
  crypt('2469mofo', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider": "email", "providers": ["email"]}',
  '{"username": "JustLoofy"}',
  now(),
  now(),
  '',
  '',
  '',
  ''
);

-- Note: The trigger above will automatically create a row in the public.profiles table 
-- with the username 'JustLoofy' because it reads it from raw_user_meta_data.
