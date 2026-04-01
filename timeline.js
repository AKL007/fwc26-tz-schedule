(function () {
  'use strict';

  const { GROUP_COLORS, STAGE_COLORS, STAGE_LABELS,
    getLocalDateKey, esc, getMatchColor,
    detectTimezone, initTimezoneUI, loadMatches,
    setTz, getTz, getMatches } = window.WC;

  const SLOT_WIDTH = 60;       // px per 30-min slot
  const DATE_COL_WIDTH = 120;  // px for sticky date column
  const ROW_HEIGHT = 36;       // px per date row
  const MATCH_BLOCK_SLOTS = 3; // each match block spans 3 slots (1.5 hours)

  // Get hour + minute as decimal in the match's local date context
  // Returns { dateKey, hour } where hour can be 0-23.99
  function getLocalParts(utcDate, tz) {
    const d = new Date(utcDate);
    const parts = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric', minute: 'numeric', hour12: false, timeZone: tz,
    }).formatToParts(d);
    const h = parseInt(parts.find(p => p.type === 'hour').value, 10);
    const m = parseInt(parts.find(p => p.type === 'minute').value, 10);
    return { dateKey: getLocalDateKey(utcDate, tz), hour: (h % 24) + m / 60 };
  }

  function formatDateLabel(utcDate, tz) {
    const d = new Date(utcDate);
    const day = d.toLocaleDateString('en-US', { weekday: 'short', timeZone: tz });
    const monthDay = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: tz });
    return { day, monthDay };
  }

  function render() {
    const matches = getMatches();
    const tz = getTz();
    const grid = document.getElementById('timeline-grid');

    if (!matches.length) {
      grid.innerHTML = '<div class="no-matches">No matches found</div>';
      return;
    }

    // Build per-date match data with local hours
    const dateMap = new Map(); // dateKey → { matches: [{match, hour}], sampleUtc }
    matches.forEach(m => {
      const { dateKey, hour } = getLocalParts(m.utcDate, tz);
      if (!dateMap.has(dateKey)) dateMap.set(dateKey, { items: [], sampleUtc: m.utcDate });
      dateMap.get(dateKey).items.push({ match: m, hour });
    });

    // Find the global time range across ALL dates
    // We need a continuous range — find true min/max hours
    let allHours = [];
    for (const { items } of dateMap.values()) {
      items.forEach(({ hour }) => allHours.push(hour));
    }
    allHours.sort((a, b) => a - b);

    // Check if times wrap around midnight (big gap in the middle)
    // If the gap between max and min (wrapping via 24) is smaller than the direct range,
    // it means times wrap around midnight
    const directRange = allHours[allHours.length - 1] - allHours[0];
    let startHour, numSlots;

    if (directRange <= 16) {
      // No wrap — simple case
      startHour = Math.floor(allHours[0] * 2) / 2;
      const endHour = Math.ceil((allHours[allHours.length - 1] + 1.5) * 2) / 2;
      numSlots = Math.round((endHour - startHour) * 2);
    } else {
      // Wraps around midnight — find the biggest gap
      let maxGap = 0, gapEnd = 0;
      for (let i = 1; i < allHours.length; i++) {
        const gap = allHours[i] - allHours[i - 1];
        if (gap > maxGap) { maxGap = gap; gapEnd = i; }
      }
      // Start from the hour after the biggest gap
      startHour = Math.floor(allHours[gapEnd] * 2) / 2;
      const lastHour = allHours[gapEnd - 1];
      const endHour = Math.ceil((lastHour + 24 - startHour + 1.5 + startHour) * 2) / 2;
      // Actually: total span wrapping
      const span = (lastHour + 1.5) - startHour + 24;
      numSlots = Math.round(span * 2);
    }

    // Convert an hour to slot index (handling wrap-around)
    function hourToSlot(h) {
      let offset = h - startHour;
      if (offset < 0) offset += 24;
      return offset * 2; // 2 slots per hour
    }

    const dates = [...dateMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    const totalRows = dates.length;
    const contentWidth = numSlots * SLOT_WIDTH;

    // Build HTML
    let html = '';

    // === Header row ===
    html += `<div class="tl-row tl-header-row">`;
    html += `<div class="tl-date-cell tl-header-corner">Kick-off</div>`;
    html += `<div class="tl-slots-container" style="width:${contentWidth}px;">`;
    for (let i = 0; i < numSlots; i++) {
      const slotHour = (startHour + i * 0.5) % 24;
      const h = Math.floor(slotHour);
      const m = Math.round((slotHour % 1) * 60);
      const label = m === 0 ? `${String(h).padStart(2, '0')}:00` : '';
      const isHour = m === 0;
      html += `<div class="tl-slot-header${isHour ? ' tl-hour-mark' : ''}" style="left:${i * SLOT_WIDTH}px;width:${SLOT_WIDTH}px;">${label}</div>`;
    }
    html += `</div></div>`;

    // === Date rows ===
    dates.forEach(([dateKey, { items, sampleUtc }]) => {
      const { day, monthDay } = formatDateLabel(sampleUtc, tz);

      // Sort items by hour for stacking
      items.sort((a, b) => a.hour - b.hour);

      // Calculate stacking — find overlapping matches and stack them
      const lanes = []; // each lane is an array of {start, end} slot ranges
      const itemLanes = [];

      items.forEach(({ hour }) => {
        const startSlot = hourToSlot(hour);
        const endSlot = startSlot + MATCH_BLOCK_SLOTS;

        let lane = 0;
        for (lane = 0; lane < lanes.length; lane++) {
          const conflict = lanes[lane].some(r => startSlot < r.end && endSlot > r.start);
          if (!conflict) break;
        }
        if (lane === lanes.length) lanes.push([]);
        lanes[lane].push({ start: startSlot, end: endSlot });
        itemLanes.push(lane);
      });

      const numLanes = Math.max(1, lanes.length);
      const rowH = numLanes * ROW_HEIGHT;

      html += `<div class="tl-row" style="height:${rowH}px;">`;
      html += `<div class="tl-date-cell">`;
      html += `<span class="tl-day">${day}</span>`;
      html += `<span class="tl-monthday">${monthDay}</span>`;
      html += `</div>`;

      html += `<div class="tl-slots-container" style="width:${contentWidth}px;">`;

      // Grid lines
      for (let i = 0; i < numSlots; i++) {
        const slotHour = (startHour + i * 0.5) % 24;
        const m = Math.round((slotHour % 1) * 60);
        const isHour = m === 0;
        html += `<div class="tl-gridline${isHour ? ' tl-gridline-hour' : ''}" style="left:${i * SLOT_WIDTH}px;width:${SLOT_WIDTH}px;height:${rowH}px;"></div>`;
      }

      // Match blocks
      items.forEach(({ match: m, hour }, idx) => {
        const slotPos = hourToSlot(hour);
        const left = slotPos * SLOT_WIDTH;
        const width = MATCH_BLOCK_SLOTS * SLOT_WIDTH;
        const lane = itemLanes[idx];
        const top = lane * ROW_HEIGHT + 2;
        const blockH = ROW_HEIGHT - 4;
        const color = getMatchColor(m);

        const home = shortenTeam(m.homeTeam);
        const away = shortenTeam(m.awayTeam);
        const label = `${home} v ${away}`;
        const groupLetter = m.group ? m.group.replace('Group ', '') : '';
        const numLabel = m.stage !== 'GROUP_STAGE' ? m.id : '';

        html += `<div class="tl-match" style="left:${left}px;top:${top}px;width:${width}px;height:${blockH}px;background:${color};" title="${esc(m.homeTeam)} v ${esc(m.awayTeam)}\n${esc(m.venue)}">`;
        if (numLabel) html += `<span class="tl-match-num">${numLabel}</span>`;
        html += `<span class="tl-match-label">${esc(label)}</span>`;
        if (groupLetter) html += `<span class="tl-match-group">${groupLetter}</span>`;
        html += `</div>`;
      });

      html += `</div></div>`;
    });

    grid.innerHTML = html;
    renderLegend();
  }

  function shortenTeam(name) {
    const map = {
      'South Africa': 'RSA', 'South Korea': 'KOR', 'Saudi Arabia': 'KSA',
      'New Zealand': 'NZL', 'Ivory Coast': 'CIV', 'Costa Rica': 'CRC',
      'DR Congo': 'COD', 'Cape Verde': 'CPV',
    };
    if (map[name]) return map[name];
    if (name.startsWith('1st ')) return '1' + name.replace('1st Group ', '');
    if (name.startsWith('2nd ')) return '2' + name.replace('2nd Group ', '');
    if (name.startsWith('3rd ')) return '3' + name.replace('3rd Group ', '');
    if (name.startsWith('Winner Match ')) return 'W' + name.replace('Winner Match ', '');
    if (name.startsWith('Loser Match ')) return 'L' + name.replace('Loser Match ', '');
    if (name.length <= 8) return name;
    return name.substring(0, 3).toUpperCase();
  }

  function renderLegend() {
    const legend = document.getElementById('timeline-legend');
    let html = '';

    for (const [group, color] of Object.entries(GROUP_COLORS)) {
      const letter = group.replace('Group ', '');
      html += `<div class="legend-item"><div class="legend-swatch" style="background:${color}"></div><span>Grp ${letter}</span></div>`;
    }

    [['ROUND_OF_32', 'R32'], ['QUARTER_FINAL', 'QF'], ['SEMI_FINAL', 'SF'], ['FINAL', 'Final']].forEach(([stage, label]) => {
      if (STAGE_COLORS[stage]) {
        html += `<div class="legend-item"><div class="legend-swatch" style="background:${STAGE_COLORS[stage]}"></div><span>${label}</span></div>`;
      }
    });

    legend.innerHTML = html;
  }

  async function init() {
    setTz(detectTimezone());
    const data = await loadMatches();

    const updated = document.getElementById('last-updated');
    if (data.lastUpdated) {
      const d = new Date(data.lastUpdated);
      updated.textContent = `Last updated: ${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }

    initTimezoneUI(render);
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
