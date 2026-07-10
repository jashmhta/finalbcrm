/**
 * Lightweight mock data so console primary modules are non-empty for accuracy.
 * Idempotent: keyed by source_ref / deal_code prefix `MOCK-`.
 *
 * Run: npx tsx src/db/seed-console-mock.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import postgres from "postgres";

if (!process.env.DATABASE_URL) {
  try {
    const env = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of env.split("\n")) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {
    /* ignore */
  }
}

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

async function main() {
  const users = await sql<{ user_id: string; email: string }[]>`
    SELECT user_id, email FROM app_user WHERE deleted_at IS NULL
  `;
  const byEmail = Object.fromEntries(users.map((u) => [u.email, u.user_id]));
  const shray = byEmail["shray@binarycapital.in"];
  const yash = byEmail["yash@binarycapital.in"];
  const rati = byEmail["rati@binarybonds.in"];
  const tashmit = byEmail["tashmit@binarybonds.in"];
  if (!shray) throw new Error("shray user missing — run seed-org-users first");

  // --- Parties (mock book) ---
  const mockParties: {
    legal: string;
    brand: "binarycapital" | "binarybonds" | "shared";
    nature: "organization" | "natural_person" | "trust";
    ref: string;
    owner?: string;
  }[] = [
    {
      legal: "MOCK Sterling Infra Ltd",
      brand: "binarycapital",
      nature: "organization",
      ref: "MOCK-P-STERLING",
      owner: yash ?? shray,
    },
    {
      legal: "MOCK Meridian Bonds MF",
      brand: "binarybonds",
      nature: "organization",
      ref: "MOCK-P-MERIDIAN",
      owner: tashmit ?? rati ?? shray,
    },
    {
      legal: "MOCK Cascade Capital Family Office",
      brand: "binarybonds",
      nature: "organization",
      ref: "MOCK-P-CASCADE",
      owner: rati ?? shray,
    },
    {
      legal: "MOCK Orbit Logistics Pvt Ltd",
      brand: "binarycapital",
      nature: "organization",
      ref: "MOCK-P-ORBIT",
      owner: yash ?? shray,
    },
    {
      legal: "MOCK Apex Cement Holdings",
      brand: "shared",
      nature: "organization",
      ref: "MOCK-P-APEX",
      owner: shray,
    },
  ];

  for (const p of mockParties) {
    const existing = await sql`
      SELECT party_id FROM party WHERE source_ref = ${p.ref} AND deleted_at IS NULL LIMIT 1
    `;
    if (existing.length) continue;
    await sql`
      INSERT INTO party (
        legal_name, display_name, party_nature, status, brand_origin, source, source_ref,
        assigned_user_id, data_owner_user_id, created_by_user_id, is_listed, country_of_incorporation
      ) VALUES (
        ${p.legal}, ${p.legal}, ${p.nature}, 'active', ${p.brand}, 'manual', ${p.ref},
        ${p.owner ?? null}, ${p.owner ?? null}, ${shray}, false, 'IN'
      )
    `;
    console.log("party+", p.legal);
  }

  const parties = await sql<{ party_id: string; legal_name: string; brand_origin: string; source_ref: string | null }[]>`
    SELECT party_id, legal_name, brand_origin, source_ref FROM party WHERE deleted_at IS NULL
  `;
  const partyByRef = Object.fromEntries(
    parties.filter((p) => p.source_ref).map((p) => [p.source_ref!, p]),
  );
  const capitalParties = parties.filter((p) => p.brand_origin === "binarycapital" || p.brand_origin === "shared");
  const bondsParties = parties.filter((p) => p.brand_origin === "binarybonds" || p.brand_origin === "shared");

  // --- Lead meta on mock parties ---
  const leadSpecs = [
    {
      ref: "MOCK-P-STERLING",
      meta: {
        stage: "opportunity",
        source: "referral",
        dealType: "project_finance",
        estSizeCr: 450,
        probability: 55,
        expectedClose: "2026-09-30",
        assignedRm: yash ?? shray,
        contactName: "Anita Rao",
        contactTitle: "CFO",
        contactEmail: "anita@mock-sterling.example",
        contactPhone: "+91-98XXXX1001",
        bant: { budget: true, authority: true, need: true, timeline: false },
        notes: "Mock lead for console accuracy tests",
        lossReason: null,
        convertedDealId: null,
      },
    },
    {
      ref: "MOCK-P-ORBIT",
      meta: {
        stage: "qualified",
        source: "event",
        dealType: "m_and_a",
        estSizeCr: 120,
        probability: 35,
        expectedClose: "2026-12-15",
        assignedRm: yash ?? shray,
        contactName: "Vikram Shah",
        contactTitle: "MD",
        contactEmail: "vikram@mock-orbit.example",
        contactPhone: "+91-98XXXX1002",
        bant: { budget: true, authority: false, need: true, timeline: true },
        notes: "Mock qualified lead",
        lossReason: null,
        convertedDealId: null,
      },
    },
    {
      ref: "MOCK-P-MERIDIAN",
      meta: {
        stage: "new",
        source: "website",
        dealType: "bond_underwriting",
        estSizeCr: 800,
        probability: 20,
        expectedClose: null,
        assignedRm: tashmit ?? rati ?? shray,
        contactName: "Priya Nair",
        contactTitle: "Treasurer",
        contactEmail: "priya@mock-meridian.example",
        contactPhone: "+91-98XXXX1003",
        bant: { budget: false, authority: false, need: true, timeline: false },
        notes: "Mock bonds lead",
        lossReason: null,
        convertedDealId: null,
      },
    },
  ];

  for (const L of leadSpecs) {
    const row = partyByRef[L.ref];
    if (!row) continue;
    await sql`
      UPDATE party SET lead_meta = ${sql.json(L.meta)}, updated_at = now()
      WHERE party_id = ${row.party_id}
    `;
    console.log("lead_meta+", L.ref);
  }

  // --- Deals (pipeline + monthly charts) ---
  const niraj = byEmail["niraj@binarybonds.in"];
  const bondsLead = niraj ?? tashmit ?? rati ?? shray;
  const dealSpecs: {
    code: string;
    name: string;
    type: string;
    status: string;
    brand: "binarycapital" | "binarybonds";
    size: number;
    lead?: string;
    partyRef?: string;
    monthsAgo: number;
  }[] = [
    {
      code: "MOCK-D-ACME-01",
      name: "Acme Infra project finance",
      type: "project_finance",
      status: "in_dd",
      brand: "binarycapital",
      size: 350,
      lead: yash ?? shray,
      monthsAgo: 0,
    },
    {
      code: "MOCK-D-ROAD-01",
      name: "Roadway EPC mandate",
      type: "dcm_advisory",
      status: "mandated",
      brand: "binarycapital",
      size: 200,
      lead: shray,
      monthsAgo: 1,
    },
    {
      code: "MOCK-D-STER-01",
      name: "Sterling Infra structuring",
      type: "structured_finance",
      status: "structuring",
      brand: "binarycapital",
      size: 450,
      lead: yash ?? shray,
      monthsAgo: 0,
    },
    {
      code: "MOCK-D-MER-01",
      name: "Meridian bond underwriting",
      type: "bond_underwriting",
      status: "pricing",
      brand: "binarybonds",
      size: 800,
      lead: bondsLead,
      monthsAgo: 0,
    },
    {
      code: "MOCK-D-CAS-01",
      name: "Cascade FO placement",
      type: "private_placement_debt",
      status: "allocation",
      brand: "binarybonds",
      size: 150,
      lead: tashmit ?? rati ?? shray,
      monthsAgo: 2,
    },
    {
      code: "MOCK-D-HOR-01",
      name: "Horizon PMS advisory",
      type: "portfolio_management_mandate",
      status: "lead",
      brand: "binarybonds",
      size: 90,
      lead: rati ?? shray,
      monthsAgo: 3,
    },
  ];

  for (const d of dealSpecs) {
    const exists = await sql`SELECT deal_id FROM deal WHERE deal_code = ${d.code} AND deleted_at IS NULL LIMIT 1`;
    if (exists.length) {
      console.log("deal=", d.code);
      continue;
    }
    const created = new Date();
    created.setMonth(created.getMonth() - d.monthsAgo);
    const [row] = await sql<{ deal_id: string }[]>`
      INSERT INTO deal (
        deal_code, deal_type, deal_name, status, brand, lead_user_id,
        target_size, currency_code, created_by_user_id, created_at, updated_at
      ) VALUES (
        ${d.code}, ${d.type}, ${d.name}, ${d.status}, ${d.brand}, ${d.lead ?? shray},
        ${d.size}, 'INR', ${shray}, ${created}, ${created}
      )
      RETURNING deal_id
    `;
    // Link a party if we can
    const pool = d.brand === "binarybonds" ? bondsParties : capitalParties;
    const party = pool[0];
    if (party && row) {
      await sql`
        INSERT INTO deal_party (deal_id, party_id, role, is_lead)
        VALUES (${row.deal_id}, ${party.party_id}, 'issuer', true)
        ON CONFLICT DO NOTHING
      `.catch(async () => {
        // role column might differ - try without is_lead
        try {
          await sql`
            INSERT INTO deal_party (deal_id, party_id, role)
            VALUES (${row.deal_id}, ${party.party_id}, 'issuer')
          `;
        } catch {
          /* ignore link failures */
        }
      });
    }
    console.log("deal+", d.code);
  }

  // --- Tasks ---
  const taskTitles = [
    { title: "MOCK: Call Acme Infra CFO", partyLegal: "Acme Infra Ltd", assignee: yash ?? shray },
    { title: "MOCK: Prep Meridian term sheet", partyLegal: "MOCK Meridian Bonds MF", assignee: tashmit ?? shray },
    { title: "MOCK: KYC pack for Orbit", partyLegal: "MOCK Orbit Logistics Pvt Ltd", assignee: yash ?? shray },
    { title: "MOCK: Matching shortlist Cascade", partyLegal: "MOCK Cascade Capital Family Office", assignee: rati ?? shray },
    { title: "MOCK: Committee pack Apex", partyLegal: "MOCK Apex Cement Holdings", assignee: shray },
  ];

  for (const t of taskTitles) {
    const exists = await sql`
      SELECT task_id FROM task WHERE title = ${t.title} AND deleted_at IS NULL LIMIT 1
    `;
    if (exists.length) continue;
    const party = parties.find((p) => p.legal_name === t.partyLegal) ?? parties[0];
    const due = new Date();
    due.setDate(due.getDate() + 7);
    await sql`
      INSERT INTO task (title, description, assignee_user_id, party_id, due_date, priority, status, created_by_user_id)
      VALUES (
        ${t.title},
        'Console mock task for accuracy / E2E',
        ${t.assignee},
        ${party?.party_id ?? null},
        ${due.toISOString().slice(0, 10)},
        'medium',
        'pending',
        ${shray}
      )
    `;
    console.log("task+", t.title);
  }

  // --- Interactions ---
  for (let i = 0; i < Math.min(5, parties.length); i++) {
    const p = parties[i]!;
    const subj = `MOCK: Coverage note — ${p.legal_name}`;
    const exists = await sql`
      SELECT interaction_id FROM interaction WHERE subject = ${subj} AND deleted_at IS NULL LIMIT 1
    `;
    if (exists.length) continue;
    const when = new Date(Date.now() - i * 86_400_000);
    await sql`
      INSERT INTO interaction (
        party_id, channel, direction, subject, body, occurred_at, user_id, contains_mnpi
      ) VALUES (
        ${p.party_id}, 'call', 'outbound', ${subj},
        'Mock interaction body for console list accuracy.',
        ${when},
        ${shray}, false
      )
    `;
    console.log("interaction+", subj);
  }

  // --- KYC soon ---
  for (const p of parties.slice(0, 3)) {
    const exists = await sql`
      SELECT kyc_record_id FROM kyc_record WHERE party_id = ${p.party_id} AND deleted_at IS NULL LIMIT 1
    `;
    if (exists.length) continue;
    const due = new Date();
    due.setDate(due.getDate() + 12);
    try {
      await sql`
        INSERT INTO kyc_record (
          party_id, status, risk_rating, kyc_type, rekyc_due_date, valid_until
        ) VALUES (
          ${p.party_id}, 'approved', 'medium', 'CDD',
          ${due.toISOString().slice(0, 10)},
          ${due.toISOString().slice(0, 10)}
        )
      `;
      console.log("kyc+", p.legal_name);
    } catch (e) {
      console.log("kyc skip", p.legal_name, String((e as Error).message).slice(0, 80));
    }
  }

  // Final counts
  for (const t of ["party", "deal", "task", "interaction", "kyc_record"] as const) {
    const [r] = await sql.unsafe(
      `SELECT count(*)::int AS c FROM ${t} WHERE deleted_at IS NULL`,
    );
    console.log("count", t, r.c);
  }
  const [leads] = await sql`
    SELECT count(*)::int AS c FROM party WHERE lead_meta IS NOT NULL AND deleted_at IS NULL
  `;
  console.log("count leads", leads.c);

  await sql.end();
  console.log("seed-console-mock done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
