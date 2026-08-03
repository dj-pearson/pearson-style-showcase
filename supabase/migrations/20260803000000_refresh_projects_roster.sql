-- Refresh the public projects roster on danpearson.net.
--
-- WHY THIS EXISTS
-- ---------------
-- Audited 2026-08-03 against each project's LIVE site and the portfolio
-- registry. The table held 7 rows, two of which pointed at domains that are no
-- longer correct:
--
--   * "Build Desk" -> live_link https://build-desk.com. The product was renamed
--     BRIKLY and moved to brikly.net; build-desk.com now 301s there. The stored
--     description was already accurate about the product (construction
--     management), so only the name, link and in-text brand are corrected.
--
--   * "Des Moines AI Pulse" -> live_link https://desmoinesaipulse.com, which
--     DOES NOT RESOLVE (DNS failure, not a 404). The product is Des Moines
--     Insider at desmoinesinsider.com, and it is a hyperlocal events/city guide
--     rather than a conversational AI assistant, so the description is replaced
--     rather than edited.
--
-- Seven live products were missing entirely. They are inserted below so this
-- site matches the roster on dpearsonmedia.com.
--
-- CraftLocal is set to 'archived' rather than deleted: the project is paused
-- (on hold, edge functions deliberately stopped) but craftlocal.net still
-- serves, and a delete is irreversible. See the companion code change, which
-- makes `status` actually control visibility — it did not before.
--
-- IDEMPOTENCY
-- -----------
-- Every statement is guarded. Updates match on the OLD value so re-running is a
-- no-op, and inserts are WHERE NOT EXISTS on title (there is no unique
-- constraint on projects.title, so ON CONFLICT is not available). This matters:
-- an unguarded data migration that re-runs duplicates every row it inserts.
--
-- NOT CHANGED, DELIBERATELY
-- -------------------------
-- image_url is left exactly as-is. Four of the six populated values point at
-- hosts that no longer resolve (the retired cloud Supabase project
-- qazhdcqvjppbbjxzvisp.supabase.co, and gymunitysuite.com), but ProjectCard
-- does not render image_url at all, so this is dormant data rot rather than a
-- visible break. Nulling them would destroy the only record of what the images
-- were while fixing nothing on screen. Flagged for a separate decision.

BEGIN;

-- 1. Build Desk -> Brikly ------------------------------------------------------
UPDATE public.projects
SET title       = 'Brikly',
    live_link   = 'https://brikly.net',
    description = 'Construction management platform giving small and mid-sized contractors real-time job costing, scheduling and change order control. Brikly centralizes project data, automates workflows and provides live visibility into project progress, costs and team performance, so a job''s margin is visible while it is still running rather than after it closes.',
    status      = 'active',
    updated_at  = now()
WHERE title = 'Build Desk';

-- 2. Des Moines AI Pulse -> Des Moines Insider ---------------------------------
--    Different product, not just a rename: the stored copy described a
--    conversational AI assistant; the live site is an events and city guide.
UPDATE public.projects
SET title       = 'Des Moines Insider',
    live_link   = 'https://desmoinesinsider.com',
    description = 'Hyperlocal events and city guide for the Des Moines metro, covering West Des Moines, Ankeny, Urbandale and the surrounding communities. It answers the question residents actually ask — what is happening today and this weekend — with daily-updated live events, concerts, festivals, family activities and restaurant coverage, plus an iOS app.',
    tags        = ARRAY['Local media', 'Events', 'iOS app', 'AI'],
    status      = 'active',
    updated_at  = now()
WHERE title = 'Des Moines AI Pulse';

-- 3. Archive the paused project (reversible; NOT a delete) ---------------------
UPDATE public.projects
SET status = 'archived', updated_at = now()
WHERE title = 'CraftLocal' AND coalesce(status, '') <> 'archived';

-- 4. Normalise status casing ---------------------------------------------------
--    Rows carried a mix of 'active' and 'Active'. Any filter on this column
--    would silently drop half the roster, so the casing is settled before the
--    companion code change starts reading it.
UPDATE public.projects
SET status = lower(status), updated_at = now()
WHERE status IS NOT NULL AND status <> lower(status);

-- 5. Insert the missing live products -----------------------------------------
--    Descriptions verified 2026-08-03 against each site's own title/meta.
INSERT INTO public.projects (title, description, live_link, tags, status, featured, sort_order)
SELECT v.title, v.description, v.live_link, v.tags, 'active', v.featured, v.sort_order
FROM (VALUES
  ('Printyx',
   'AI-powered cloud ERP built for copier and print equipment dealers — an industry still largely running on decades-old on-premise software. It unifies the whole dealership in one system: CRM and quoting, service dispatch and technician scheduling, meter collection and automated contract billing, parts and equipment inventory, and profitability reporting by contract, machine and technician.',
   'https://printyx.net',
   ARRAY['Dealer ERP','B2B SaaS','Field service','AI'], true, 1),

  ('GradeThread',
   'AI condition grading for pre-owned clothing. Sellers photograph a garment and receive an objective 1.0–10.0 grade, a detailed condition report and a shareable certificate buyers trust — standardized grading for the secondhand market, in the way PSA did it for trading cards. Ships FlipDesk, a full reseller workflow covering the eBay lifecycle from sourcing to reconciliation.',
   'https://gradethread.com',
   ARRAY['AI','Resale','Marketplace','iOS app'], false, 4),

  ('Daily OK',
   'Daily check-in app for aging parents and loved ones. One person sends a check-in request, their loved one taps once to confirm they are OK, and escalating alerts fire the moment a check-in is missed. Deliberately no GPS tracking, no cameras and no wearable pendant — which is what makes it acceptable to independent older adults who reject surveillance-style products.',
   'https://dailyok.net',
   ARRAY['Family safety','Aging care','iOS app'], false, 6),

  ('Bitcoin Investments',
   'Education-first cryptocurrency platform for beginners. Live market data, a portfolio tracker with profit and loss, and practical calculators for dollar-cost averaging, tax impact, fees and staking — alongside independent exchange and wallet comparisons and a crypto scam database, which addresses the failure mode that actually costs new investors money.',
   'https://bitcoinvestments.net',
   ARRAY['Fintech','Education','Crypto'], false, 9),

  ('ApiDown',
   'Real-time API status measured from actual production traffic, answering the question every engineer asks at the start of an incident: is this API genuinely down, or is it my code? Vendor status pages stay green through outages; ApiDown surfaces degradation as elevated p95 latency and error rates, checkable from the browser or straight from the terminal with npx.',
   'https://apidown.net',
   ARRAY['Developer tools','Monitoring','CLI'], false, 10),

  ('ENVault',
   'Local-first, encrypted environment variable management for developers. Zero-knowledge AES-256-GCM encryption with keys held in the OS keychain, working fully offline with no account required — which eliminates the two ways secrets actually leak in practice: committed .env files and credentials pasted into chat. Ships as a single dependency-free Go binary.',
   'https://envault.net',
   ARRAY['Developer tools','Security','Encryption'], false, 11),

  ('MCPFold',
   'Open-source tool that connects every Model Context Protocol server from one canonical config, folding it out to each MCP client and loading only the tools a given agent needs — so a session pays context for the capabilities it uses rather than the full catalog. Resolves secret references instead of hardcoding credentials into config. MIT licensed, on npm and the VS Code Marketplace.',
   'https://mcpfold.com',
   ARRAY['Developer tools','AI','Open source','MCP'], false, 12)
) AS v(title, description, live_link, tags, featured, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.projects p WHERE p.title = v.title
);

-- 6. Settle display order ------------------------------------------------------
--    AgentBio and the Des Moines entry both carried sort_order = 2, so their
--    relative order was decided by the created_at tiebreaker rather than by
--    intent. Ordering is assigned explicitly for every row instead.
UPDATE public.projects SET sort_order = 2,  updated_at = now() WHERE title = 'Brikly';
UPDATE public.projects SET sort_order = 3,  updated_at = now() WHERE title = 'Eat Pal';
UPDATE public.projects SET sort_order = 5,  updated_at = now() WHERE title = 'Rep Club';
UPDATE public.projects SET sort_order = 7,  updated_at = now() WHERE title = 'AgentBio';
UPDATE public.projects SET sort_order = 8,  updated_at = now() WHERE title = 'Des Moines Insider';
UPDATE public.projects SET sort_order = 13, updated_at = now() WHERE title = 'Iowa Print Solutions';
UPDATE public.projects SET sort_order = 99, updated_at = now() WHERE title = 'CraftLocal';

COMMIT;

-- VERIFY (run separately; expects 13 active rows and 1 archived):
--   SELECT sort_order, title, status, featured, live_link
--   FROM public.projects ORDER BY status, sort_order;
