import type { SiteAnalysisData } from './ai.service';

// ─────────────────────────────────────────────────────────────────────────────
// Rule-based upgrade recommendation.
// Used automatically when ANTHROPIC_API_KEY is not configured. It reads the same
// data that would be sent to Claude (site, neighbours, regional stats) and applies
// transparent engineering rules. Output uses the exact same section format as the
// Claude prompt, so the frontend renders it without any change.
// ─────────────────────────────────────────────────────────────────────────────

const is5G = (t: string): boolean => t.startsWith('5G');

type Priority = 'Critical' | 'High' | 'Medium' | 'Low' | 'Not Needed';

export const buildRuleBasedRecommendation = (data: SiteAnalysisData): string => {
  const { site, neighbors, regionStats } = data;

  const techs: string[] = site.technologies ?? [];
  const has4G = techs.includes('4G');
  const has5G = techs.some(is5G);

  const totalSites = regionStats.total_sites || 1;
  const pct4G = Math.round((regionStats.sites_with_4g / totalSites) * 100);
  const pct5G = Math.round((regionStats.sites_with_5g / totalSites) * 100);

  const neighbors5G = neighbors.filter(n => (n.technologies ?? []).some(is5G)).length;
  const isolated = neighbors.length === 0;

  const inactiveRatio = site.cell_count > 0 ? site.inactive_cells / site.cell_count : 0;
  const inactivePct = Math.round(inactiveRatio * 100);

  // Distinct sector directions (rounded to 10°) and the largest uncovered arc
  const dirs = Array.from(
    new Set(
      (site.azimuths ?? [])
        .filter(a => (a as unknown) !== null && (a as unknown) !== undefined)
        .map(a => Number(a))
        .filter(a => Number.isFinite(a))
        .map(a => ((Math.round(a / 10) * 10) % 360 + 360) % 360)
    )
  ).sort((a, b) => a - b);
  const sectors = dirs.length;
  let maxGap = 0;
  if (sectors === 1) {
    maxGap = 360;
  } else if (sectors > 1) {
    for (let i = 0; i < sectors; i++) {
      const next = i === sectors - 1 ? dirs[0] + 360 : dirs[i + 1];
      maxGap = Math.max(maxGap, next - dirs[i]);
    }
  }
  const sectorGap = sectors > 0 && sectors < 3 && maxGap > 180;

  const avgCells = regionStats.avg_cells_per_site || 0;
  const lowCapacity = avgCells > 0 && site.cell_count > 0 && site.cell_count < avgCells * 0.6;

  const legacyOnly = !has4G && !has5G;
  const missing5G = has4G && !has5G;

  // ── Score → priority ──────────────────────────────────────────────────────
  let score = 0;
  if (legacyOnly) score += 3;
  if (missing5G) score += 1;
  if (!has5G && neighbors5G > 0) score += 1;
  if (inactiveRatio > 0.3) score += 2;
  else if (inactiveRatio > 0) score += 1;
  if (isolated) score += 1;
  if (sectorGap) score += 1;
  if (lowCapacity) score += 1;

  const priority: Priority =
    score >= 6 ? 'Critical' :
    score >= 4 ? 'High' :
    score >= 2 ? 'Medium' :
    score >= 1 ? 'Low' : 'Not Needed';

  // ── Recommended actions (most important first, max 3) ─────────────────────
  const actions: string[] = [];

  if (inactiveRatio > 0.3) {
    actions.push(`Investigate and restore the ${site.inactive_cells} inactive cell(s) (${inactivePct}% of the site): check alarms, backhaul and radio units before adding new capacity.`);
  }
  if (legacyOnly) {
    actions.push(`Deploy 4G (LTE) on this tower — it only offers ${techs.join(', ') || 'no active technology'} while the region is at ${pct4G}% 4G adoption.`);
  } else if (missing5G) {
    actions.push(
      neighbors5G > 0
        ? `Add 5G NR on this site — ${neighbors5G} of ${neighbors.length} neighbouring site(s) already have 5G, so users here are being left behind.`
        : `Plan a 5G NR rollout (NSA on the existing 4G layer) — regional 5G adoption is only ${pct5G}%.`
    );
  }
  if (inactiveRatio > 0 && inactiveRatio <= 0.3) {
    actions.push(`Repair the ${site.inactive_cells} inactive cell(s) and verify there is no recurring fault.`);
  }
  if (isolated) {
    actions.push('Improve resilience: add backhaul redundancy (e.g. microwave backup) because no other site lies within 15 km.');
  }
  if (sectorGap) {
    actions.push(`Complete the sector layout — only ${sectors} sector direction(s) are configured, leaving an uncovered arc of about ${maxGap}°.`);
  }
  if (lowCapacity) {
    actions.push(`Add carriers/sectors: the site has ${site.cell_count} cell(s) versus a regional average of ${avgCells}.`);
  }
  if (actions.length === 0) {
    actions.push('Keep the current configuration and review traffic/utilisation each quarter.');
  }
  const topActions = actions.slice(0, 3);

  // ── Reasoning ─────────────────────────────────────────────────────────────
  const regionName = site.region || 'an unknown region';
  const neighbourText = isolated
    ? 'no other site lies within 15 km'
    : `${neighbors.length} neighbouring site(s) lie within 15 km (${neighbors5G} with 5G)`;
  const closing =
    priority === 'Critical' || priority === 'High'
      ? 'Together these gaps make this site a strong candidate for an upgrade.'
      : priority === 'Medium'
        ? 'A planned upgrade would bring the site in line with its surroundings.'
        : 'The site is broadly in line with its region, so no urgent change is needed.';
  const reasoning =
    `${site.site_name} (${regionName}) runs ${techs.join(', ') || 'no technology'} on ${site.cell_count} cell(s), ` +
    `${site.active_cells} active and ${site.inactive_cells} inactive. ` +
    `Its region is at ${pct4G}% 4G and ${pct5G}% 5G site adoption, and ${neighbourText}. ${closing}`;

  // ── Risk ──────────────────────────────────────────────────────────────────
  let risk: string;
  if (legacyOnly) {
    risk = 'Subscribers stay limited to legacy speeds and the site becomes the weakest link as traffic moves to 4G/5G.';
  } else if (inactiveRatio > 0.3) {
    risk = `With ${inactivePct}% of cells inactive, capacity and coverage reliability will keep degrading.`;
  } else if (!has5G && neighbors5G > 0) {
    risk = 'Users will drift to neighbouring 5G sites, overloading them and breaking service continuity here.';
  } else if (isolated) {
    risk = 'A fault here would leave the surrounding area with no nearby fallback site.';
  } else {
    risk = 'Low — no urgent risk detected; continue routine monitoring.';
  }

  return [
    `**Upgrade Priority**: ${priority}`,
    '',
    '**Recommended Actions**:',
    ...topActions.map(a => `- ${a}`),
    '',
    `**Reasoning**: ${reasoning}`,
    '',
    `**Risk if not upgraded**: ${risk}`,
  ].join('\n');
};