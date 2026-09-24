/*
 * Public client configuration only. The Supabase anon key is designed to be
 * public; never add Stripe secret keys or Supabase service-role keys here.
 */
window.BTP_COURSE_CONFIG = {
  // Supabase's browser client appends /auth/v1 and other API paths itself.
  // This must be the project root URL, not the REST endpoint.
  supabaseUrl: 'https://paktsqnbtetsmupmmeit.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBha3RzcW5idGV0c211cG1tZWl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwMTk4NTEsImV4cCI6MjEwMzU5NTg1MX0.SWucYJ7Pi5Y2zxwJkK7De_9aDCabmUzdYx3s3Ja7Kl0',
  courseProductKey: 'full-course'
};
