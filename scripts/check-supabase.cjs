const fs = require('node:fs');
const path = require('node:path');

async function main() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Set Supabase URL and public key in .env first.');
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const settingsResponse = await fetch(`${url}/auth/v1/settings`, { headers, signal: AbortSignal.timeout(15000) });
  if (!settingsResponse.ok) throw new Error(`Auth settings: HTTP ${settingsResponse.status}`);
  const settings = await settingsResponse.json();
  console.log(`Auth connected; email=${settings.external?.email}, signup=${!settings.disable_signup}, confirmEmail=${!settings.mailer_autoconfirm}`);

  const schema = fs.readFileSync(path.join(__dirname, '../src/types/database.types.ts'), 'utf8');
  const tables = [...schema.matchAll(/^      (\w+): \{/gm)].map(match => match[1]);
  // limit=0 verifies endpoints without downloading any user records.
  for (const table of tables) {
    const response = await fetch(`${url}/rest/v1/${table}?select=*&limit=0`, { headers, signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`${table}: HTTP ${response.status}`);
    await response.json();
    console.log(`${table}: OK`);
  }
  console.log(`${tables.length} table endpoints reachable. No accounts or records created.`);
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
