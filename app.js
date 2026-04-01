(function () {
  'use strict';

  const { STAGE_LABELS, formatTime, formatDate, getLocalDateKey,
    esc, isRealTeam, teamHtml, displayTeamName, formatLastUpdated, detectTimezone, initTimezoneUI, initShareSheet, loadMatches,
    setTz, getTz, getMatches } = window.WC;

  // --- Filters ---

  function getFilterState() {
    return {
      team: document.getElementById('filter-team').value,
      venue: document.getElementById('filter-venue').value,
      group: document.getElementById('filter-group').value,
      stage: document.getElementById('filter-stage').value,
    };
  }

  function applyFilters(matches) {
    const f = getFilterState();
    return matches.filter(m => {
      if (f.team && m.homeTeam !== f.team && m.awayTeam !== f.team) return false;
      if (f.venue && m.venue !== f.venue) return false;
      if (f.group && m.group !== f.group) return false;
      if (f.stage && m.stage !== f.stage) return false;
      return true;
    });
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

    const hasFilter = Object.values(f).some(v => v);
    document.getElementById('filter-clear').classList.toggle('hidden', !hasFilter);
  }

  function restoreFiltersFromURL() {
    const params = new URLSearchParams(location.search);
    ['team', 'venue', 'group', 'stage'].forEach(key => {
      const val = params.get(key);
      if (val) {
        document.getElementById('filter-' + key).value = val;
      }
    });
  }

  function initFilters() {
    ['filter-team', 'filter-venue', 'filter-group', 'filter-stage'].forEach(id => {
      document.getElementById(id).addEventListener('change', () => {
        syncFiltersToURL();
        render();
      });
    });

    document.getElementById('filter-clear').addEventListener('click', () => {
      ['filter-team', 'filter-venue', 'filter-group', 'filter-stage'].forEach(id => {
        document.getElementById(id).value = '';
      });
      syncFiltersToURL();
      render();
    });
  }

  // --- Rendering ---

  function render() {
    const filtered = applyFilters(getMatches());
    const container = document.getElementById('match-list');
    const tz = getTz();

    if (filtered.length === 0) {
      container.innerHTML = '<div class="no-matches">No matches found</div>';
      return;
    }

    const grouped = new Map();
    filtered.forEach(m => {
      const key = getLocalDateKey(m.utcDate, tz);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(m);
    });

    let html = '';
    for (const [, matches] of grouped) {
      const dateLabel = formatDate(matches[0].utcDate, tz);
      html += `<section class="date-group">
        <h2 class="date-heading">${dateLabel}</h2>`;

      matches.forEach(m => {
        const time = formatTime(m.utcDate, tz);
        const stageLabel = STAGE_LABELS[m.stage] || m.stage;
        const badgeText = m.group ? 'Grp ' + m.group.replace('Group ', '').replace('GROUP_', '') : stageLabel;
        const scoreText = m.score.home !== null
          ? `<span class="score">${m.score.home} - ${m.score.away}</span>`
          : '<span class="vs">vs</span>';
        const statusHtml = m.status === 'LIVE'
          ? '<div class="match-status-live">LIVE</div>'
          : '';

        html += `<div class="match-card">
          <div class="match-time">${time}${statusHtml}</div>
          <div class="match-teams">
            <div class="team">${teamHtml(m.homeTeam)}</div>
            ${scoreText}
            <div class="team">${teamHtml(m.awayTeam)}</div>
          </div>
          <div class="match-meta">
            <div class="match-venue" title="${esc(m.venue)}">${esc(m.venue)}</div>
            <span class="stage-badge" data-stage="${m.stage}">${badgeText}</span>
          </div>
        </div>`;
      });

      html += '</section>';
    }

    container.innerHTML = html;
  }

  // --- Init ---

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
    initShareSheet();
    initFilters();
    syncFiltersToURL();
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
