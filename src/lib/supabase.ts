import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://yirmkfzzwpkfozpqntjo.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlpcm1rZnp6d3BrZm96cHFudGpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MDg5OTgsImV4cCI6MjA4OTI4NDk5OH0.ompuhIzNzdLF48eL1TBxnxum6xjlftSmE0aLRr6fkds';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
