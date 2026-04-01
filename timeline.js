(function () {
  'use strict';

  const { GROUP_COLORS, STAGE_COLORS, STAGE_LABELS,
    getLocalDateKey, esc, getMatchColor, isRealTeam, teamHtml, displayTeamName, formatLastUpdated,
    detectTimezone, initTimezoneUI, initShareButton, loadMatches,
    setTz, getTz, getMatches } = window.WC;

  const DATE_COL_WIDTH = 120;  // px for sticky date column
  const ROW_HEIGHT = 36;       // px per date row
  const MATCH_BLOCK_SLOTS = 3; // each match block spans 3 slots (1.5 hours)
  const MIN_SLOT_WIDTH = 30;   // minimum px per 30-min slot

  // --- Filters ---

  function getFilterState() {
    return {
      team: document.getElementById('filter-team').value,
      venue: document.getElementById('filter-venue').value,
      group: document.getElementById('filter-group').value,
      stage: document.getElementById('filter-stage').value,
    };
  }

  function matchesFilter(m) {
    const f = getFilterState();
    if (f.team && m.homeTeam !== f.team && m.awayTeam !== f.team) return false;
    if (f.venue && m.venue !== f.venue) return false;
    if (f.group && m.group !== f.group) return false;
    if (f.stage && m.stage !== f.stage) return false;
    return true;
  }

  function hasActiveFilter() {
    const f = getFilterState();
    return !!(f.team || f.venue || f.group || f.stage);
  }

  function populateFilterOptions(matches) {
    const teams = new Set();
    const venues = new Set();
    const groups = new Set();
    const stages = new Set();

    matches.forEach(m => {
      if (isRealTeam(m.homeTeam)) teams.add(m.homeTeam);
      if (isRealTeam(m.awayTeam)) teams.add(m.awayTeam);
      venues.add(m.venue);
      if (m.group) groups.add(m.group);
      stages.add(m.stage);
    });

    fillSelect('filter-team', [...teams].sort(), 'All Teams', displayTeamName);
    fillSelect('filter-venue', [...venues].sort(), 'All Venues');
    fillSelect('filter-group', [...groups].sort((a, b) => a.localeCompare(b)), 'All Groups', v => 'Group ' + v.replace('Group ', '').replace('GROUP_', ''));
    fillSelect('filter-stage', [...stages].sort((a, b) => {
      const order = Object.keys(STAGE_LABELS);
      return order.indexOf(a) - order.indexOf(b);
    }), 'All Stages', v => STAGE_LABELS[v] || v);
  }

  function fillSelect(id, values, placeholder, labelFn) {
    const sel = document.getElementById(id);
    const current = sel.value;
    sel.innerHTML = `<option value="">${placeholder}</option>` +
      values.map(v =>
        `<option value="${v}" ${v === current ? 'selected' : ''}>${labelFn ? labelFn(v) : v}</option>`
      ).join('');
  }

  function syncFiltersToURL() {
    const params = new URLSearchParams(location.search);
    const f = getFilterState();
    ['team', 'venue', 'group', 'stage'].forEach(key => {
      if (f[key]) params.set(key, f[key]);
      else params.delete(key);
    });
    params.set('tz', getTz());
    history.replaceState(null, '', '?' + params.toString());
    const has = Object.values(f).some(v => v);
    document.getElementById('filter-clear').classList.toggle('hidden', !has);
  }

  function restoreFiltersFromURL() {
    const params = new URLSearchParams(location.search);
    ['team', 'venue', 'group', 'stage'].forEach(key => {
      const val = params.get(key);
      if (val) document.getElementById('filter-' + key).value = val;
    });
  }

  function initFilters() {
    ['filter-team', 'filter-venue', 'filter-group', 'filter-stage'].forEach(id => {
      document.getElementById(id).addEventListener('change', () => {
        syncFiltersToURL();
        applyFilterHighlights();
      });
    });
    document.getElementById('filter-clear').addEventListener('click', () => {
      ['filter-team', 'filter-venue', 'filter-group', 'filter-stage'].forEach(id => {
        document.getElementById(id).value = '';
      });
      syncFiltersToURL();
      applyFilterHighlights();
    });
  }

  function applyFilterHighlights() {
    const filtering = hasActiveFilter();
    document.querySelectorAll('.tl-match').forEach(el => {
      if (!filtering) {
        el.classList.remove('tl-match-dimmed', 'tl-match-highlighted');
        return;
      }
      const id = parseInt(el.dataset.matchId, 10);
      const m = getMatches().find(match => match.id === id);
      if (m && matchesFilter(m)) {
        el.classList.remove('tl-match-dimmed');
        el.classList.add('tl-match-highlighted');
      } else {
        el.classList.remove('tl-match-highlighted');
        el.classList.add('tl-match-dimmed');
      }
    });
  }

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

    // Fit slots within viewport width (no horizontal scroll)
    const availableWidth = window.innerWidth - DATE_COL_WIDTH - 2; // 2px for borders
    const slotWidth = Math.max(MIN_SLOT_WIDTH, Math.floor(availableWidth / numSlots));
    const contentWidth = numSlots * slotWidth;
    const matchBlockWidth = MATCH_BLOCK_SLOTS * slotWidth;

    // Build HTML
    let html = '';

    // === Header row ===
    html += `<div class="tl-row tl-header-row">`;
    html += `<div class="tl-date-cell tl-header-corner">Kick-off</div>`;
    html += `<div class="tl-slots-container" style="width:${contentWidth}px;">`;
    // Show every hour or every 2 hours if slots are narrow
    const skipHours = slotWidth < 40 ? 2 : 1;
    let hourCount = 0;
    for (let i = 0; i < numSlots; i++) {
      const slotHour = (startHour + i * 0.5) % 24;
      const h = Math.floor(slotHour);
      const m = Math.round((slotHour % 1) * 60);
      const isHour = m === 0;
      let label = '';
      if (isHour) {
        if (hourCount % skipHours === 0) {
          label = `${String(h).padStart(2, '0')}:00`;
        }
        hourCount++;
      }
      html += `<div class="tl-slot-header${isHour ? ' tl-hour-mark' : ''}" style="left:${i * slotWidth}px;width:${slotWidth}px;">${label}</div>`;
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
        html += `<div class="tl-gridline${isHour ? ' tl-gridline-hour' : ''}" style="left:${i * slotWidth}px;width:${slotWidth}px;height:${rowH}px;"></div>`;
      }

      // Match blocks
      items.forEach(({ match: m, hour }, idx) => {
        const slotPos = hourToSlot(hour);
        const left = slotPos * slotWidth;
        const width = matchBlockWidth;
        const lane = itemLanes[idx];
        const top = lane * ROW_HEIGHT + 2;
        const blockH = ROW_HEIGHT - 4;
        const color = getMatchColor(m);

        const home = shortenTeam(m.homeTeam);
        const away = shortenTeam(m.awayTeam);
        const homeReal = isRealTeam(m.homeTeam);
        const awayReal = isRealTeam(m.awayTeam);
        const bothTbd = !homeReal && !awayReal;
        const blockColor = bothTbd ? '#3a3f4b' : color;
        const groupLetter = m.group ? m.group.replace('Group ', '').replace('GROUP_', '') : '';
        const numLabel = m.stage !== 'GROUP_STAGE' ? m.id : '';

        const homeLabel = homeReal ? esc(home) : `<span class="tl-tbd">${esc(home)}</span>`;
        const awayLabel = awayReal ? esc(away) : `<span class="tl-tbd">${esc(away)}</span>`;

        const homeFull = displayTeamName(m.homeTeam);
        const awayFull = displayTeamName(m.awayTeam);
        const isAbbreviated = home !== homeFull || away !== awayFull;

        html += `<div class="tl-match${bothTbd ? ' tl-match-tbd' : ''}${isAbbreviated ? ' tl-has-full' : ''}" data-match-id="${m.id}" style="left:${left}px;top:${top}px;width:${width}px;height:${blockH}px;background:${blockColor};" title="${esc(homeFull)} v ${esc(awayFull)}\n${esc(m.venue)}">`;
        if (numLabel) html += `<span class="tl-match-num">${numLabel}</span>`;
        html += `<span class="tl-match-label tl-match-short">${homeLabel} v ${awayLabel}</span>`;
        if (isAbbreviated) html += `<span class="tl-match-label tl-match-full">${esc(homeFull)} v ${esc(awayFull)}</span>`;
        if (groupLetter) html += `<span class="tl-match-group">${groupLetter}</span>`;
        html += `</div>`;
      });

      html += `</div></div>`;
    });

    grid.innerHTML = html;
    renderLegend();
    applyFilterHighlights();
  }

  function shortenTeam(name) {
    const display = displayTeamName(name);
    const map = {
      'South Africa': 'RSA', 'Korea Republic': 'KOR', 'South Korea': 'KOR',
      'Saudi Arabia': 'KSA', 'New Zealand': 'NZL',
      "Côte d'Ivoire": 'CIV', 'Ivory Coast': 'CIV',
      'Costa Rica': 'CRC', 'DR Congo': 'COD',
      'Cabo Verde': 'CPV', 'Cape Verde': 'CPV',
      'Czechia': 'CZE', 'Czech Republic': 'CZE',
      'Türkiye': 'TÜR', 'Turkey': 'TÜR',
      'Bosnia & Herzegovina': 'BIH',
    };
    if (map[display]) return map[display];
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

    const seen = new Set();
    for (const [group, color] of Object.entries(GROUP_COLORS)) {
      const letter = group.replace('Group ', '').replace('GROUP_', '');
      if (seen.has(letter)) continue;
      seen.add(letter);
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
      updated.textContent = formatLastUpdated(data.lastUpdated);
    }

    populateFilterOptions(getMatches());
    restoreFiltersFromURL();
    initTimezoneUI(render);
    initShareButton();
    initFilters();
    syncFiltersToURL();
    render();

    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(render, 150);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
