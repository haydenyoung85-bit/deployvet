// DeployVet site config. The only file to edit at deploy time.
// The anon (publishable) key is safe to be public. NEVER put a service_role / sb_secret_ key here.
window.DEPLOYVET_CONFIG = {
  SUPABASE_URL: "https://xlbjkhhcaqqxdviagymp.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhsYmpraGhjYXFxeGR2aWFneW1wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI0OTQ4NTEsImV4cCI6MjEwODA3MDg1MX0.UKbmS-ms9Xg0zrx0nVVn2oV1nLyIAHD2Ty2B278FsHs",
  // Features whose Edge Functions are not deployed yet stay off (and say "coming soon" on the site).
  FEATURES: { rlsExport: false, history: false, portal: false, recheck: false, pushReroast: false, fixPr: false, preview: false },
};
