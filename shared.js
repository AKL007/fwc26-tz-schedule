// Shared utilities for WC 2026 schedule app
window.WC = (function () {
  'use strict';

  const TEAM_DISPLAY_NAMES = {
    'Turkey': 'Türkiye',
    'South Korea': 'Korea Republic',
    'Ivory Coast': "Côte d'Ivoire",
    'Czech Republic': 'Czechia',
    'DR Congo': 'DR Congo',
    'Bosnia & Herzegovina': 'Bosnia & Herzegovina',
    'Cape Verde': 'Cabo Verde',
  };

  function displayTeamName(name) {
    return TEAM_DISPLAY_NAMES[name] || name;
  }

  const STAGE_LABELS = {
    GROUP_STAGE: 'Group',
    ROUND_OF_32: 'R32',
    ROUND_OF_16: 'R16',
    QUARTER_FINAL: 'QF',
    SEMI_FINAL: 'SF',
    THIRD_PLACE: '3rd Place',
    MATCH_FOR_THIRD_PLACE: '3rd Place',
    FINAL: 'Final',
  };

  const COMMON_TIMEZONES = [
    'Pacific/Auckland', 'Australia/Sydney', 'Australia/Perth',
    'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Kolkata', 'Asia/Dubai',
    'Africa/Nairobi', 'Europe/Moscow', 'Europe/Istanbul',
    'Europe/Athens', 'Europe/Berlin', 'Europe/Paris', 'Europe/London',
    'Atlantic/Azores', 'America/Sao_Paulo', 'America/Buenos_Aires',
    'America/New_York', 'America/Chicago', 'America/Denver',
    'America/Los_Angeles', 'America/Anchorage', 'Pacific/Honolulu',
  ];

  const _GROUP_MAP = {
    A: '#1a5276', B: '#1e8449', C: '#2e86c1', D: '#d35400',
    E: '#6c3483', F: '#cb4335', G: '#7d3c98', H: '#c0392b',
    I: '#d4ac0d', J: '#117a65', K: '#884ea0', L: '#2c3e50',
  };
  // Support both "Group A" and "GROUP_A" formats
  const GROUP_COLORS = {};
  for (const [letter, color] of Object.entries(_GROUP_MAP)) {
    GROUP_COLORS['Group ' + letter] = color;
    GROUP_COLORS['GROUP_' + letter] = color;
  }

  const STAGE_COLORS = {
    ROUND_OF_32: '#5d6d7e', ROUND_OF_16: '#2e4053',
    QUARTER_FINAL: '#7d5a00', SEMI_FINAL: '#6a1b9a',
    THIRD_PLACE: '#6a1b9a', MATCH_FOR_THIRD_PLACE: '#6a1b9a',
    FINAL: '#b71c1c',
  };

  let currentTz = '';
  let allMatches = [];

  function detectTimezone() {
    const params = new URLSearchParams(location.search);
    return params.get('tz') || Intl.DateTimeFormat().resolvedOptions().timeZone;
  }

  function formatTime(utcDate, tz) {
    return new Date(utcDate).toLocaleTimeString([], {
      hour: '2-digit', minute: '2-digit',
      timeZone: tz || currentTz, hour12: false,
    });
  }

  function formatDate(utcDate, tz) {
    return new Date(utcDate).toLocaleDateString([], {
      weekday: 'long', month: 'long', day: 'numeric',
      timeZone: tz || currentTz,
    });
  }

  function formatDateShort(utcDate, tz) {
    return new Date(utcDate).toLocaleDateString([], {
      weekday: 'short', month: 'short', day: 'numeric',
      timeZone: tz || currentTz,
    });
  }

  function getLocalDateKey(utcDate, tz) {
    return new Date(utcDate).toLocaleDateString('en-CA', { timeZone: tz || currentTz });
  }

  function getLocalHour(utcDate, tz) {
    const d = new Date(utcDate);
    const parts = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric', minute: 'numeric',
      timeZone: tz || currentTz, hour12: false,
    }).formatToParts(d);
    const h = parseInt(parts.find(p => p.type === 'hour').value, 10);
    const m = parseInt(parts.find(p => p.type === 'minute').value, 10);
    return h + m / 60;
  }

  function esc(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function getMatchColor(match) {
    if (match.group && GROUP_COLORS[match.group]) return GROUP_COLORS[match.group];
    if (STAGE_COLORS[match.stage]) return STAGE_COLORS[match.stage];
    return '#5d6d7e';
  }

  function initTimezoneUI(onChangeCallback) {
    const label = document.getElementById('tz-label');
    const btn = document.getElementById('tz-change');
    const sel = document.getElementById('tz-select');

    label.textContent = currentTz.replace(/_/g, ' ');

    const tzSet = new Set(COMMON_TIMEZONES);
    tzSet.add(currentTz);
    const sorted = [...tzSet].sort();
    sel.innerHTML = sorted.map(tz =>
      `<option value="${tz}" ${tz === currentTz ? 'selected' : ''}>${tz.replace(/_/g, ' ')}</option>`
    ).join('');

    btn.addEventListener('click', () => {
      btn.classList.add('hidden');
      sel.classList.remove('hidden');
      sel.focus();
    });

    sel.addEventListener('change', () => {
      currentTz = sel.value;
      const params = new URLSearchParams(location.search);
      params.set('tz', currentTz);
      history.replaceState(null, '', '?' + params.toString());
      label.textContent = currentTz.replace(/_/g, ' ');
      sel.classList.add('hidden');
      btn.classList.remove('hidden');
      updateNavLinks();
      if (onChangeCallback) onChangeCallback();
    });

    sel.addEventListener('blur', () => {
      sel.classList.add('hidden');
      btn.classList.remove('hidden');
    });
  }

  function updateNavLinks() {
    const qs = location.search;
    document.querySelectorAll('.view-nav a').forEach(a => {
      const base = a.getAttribute('href').split('?')[0];
      a.href = base + qs;
    });
  }

  async function loadMatches() {
    const res = await fetch('/data/matches.json');
    const data = await res.json();
    allMatches = data.matches;
    return data;
  }

  function teamHtml(name) {
    const display = displayTeamName(name);
    if (isRealTeam(name)) return esc(display);
    return `<span class="tbd-chip">${esc(display)}</span>`;
  }

  function isRealTeam(name) {
    if (!name || name === 'TBD') return false;
    if (/^\d/.test(name)) return false;              // "1st Group A", "2nd Group B", "3A/B/C/D/F"
    if (/^(Winner|Loser) Match/.test(name)) return false;
    if (/Path \w+ winner/i.test(name)) return false; // "UEFA Path A winner", "IC Path 1 winner"
    return true;
  }

  function formatLastUpdated(isoDate) {
    const d = new Date(isoDate);
    const day = d.getDate();
    const suffix = [, 'st', 'nd', 'rd'][day % 10 > 3 ? 0 : (day % 100 - day % 10 !== 10) * (day % 10)] || 'th';
    const month = d.toLocaleDateString('en-US', { month: 'long' });
    const year = d.getFullYear();
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `Last updated: ${day}${suffix} ${month}, ${year} ${time}`;
  }

  let html2canvasLoaded = null;
  function loadHtml2Canvas() {
    if (html2canvasLoaded) return html2canvasLoaded;
    html2canvasLoaded = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
      s.onload = () => resolve(window.html2canvas);
      s.onerror = reject;
      document.head.appendChild(s);
    });
    return html2canvasLoaded;
  }

  async function generateImage() {
    const h2c = await loadHtml2Canvas();
    const header = document.getElementById('timeline-header');
    const grid = document.getElementById('timeline-grid');
    const target = grid || document.getElementById('match-list');
    if (!target) return null;

    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'position:absolute;left:-9999px;background:#0a0e17;padding:16px;';

    const title = document.createElement('div');
    title.style.cssText = 'color:#e8eaed;font-family:-apple-system,sans-serif;font-size:16px;font-weight:700;text-align:center;margin-bottom:4px;text-transform:uppercase;';
    title.textContent = 'FIFA World Cup 2026 Schedule';
    wrapper.appendChild(title);

    const tzInfo = document.createElement('div');
    tzInfo.style.cssText = 'color:#8b92a5;font-family:-apple-system,sans-serif;font-size:15px;text-align:center;margin-bottom:12px;';
    tzInfo.textContent = currentTz.replace(/_/g, ' ') + ' · wc-26-schedule.com';
    wrapper.appendChild(tzInfo);

    if (header) wrapper.appendChild(header.cloneNode(true));
    wrapper.appendChild(target.cloneNode(true));

    // Reset sticky positioning so cells render in normal flow
    wrapper.querySelectorAll('.tl-date-cell, .tl-header-corner').forEach(el => {
      el.style.position = 'static';
    });

    document.body.appendChild(wrapper);

    const canvas = await h2c(wrapper, { backgroundColor: '#0a0e17', scale: 2, useCORS: true });
    document.body.removeChild(wrapper);

    return await new Promise(r => canvas.toBlob(r, 'image/png'));
  }

  function showStatus(btn, text) {
    const status = btn.querySelector('.share-sheet-status');
    status.textContent = text;
    setTimeout(() => { status.textContent = ''; }, 2000);
  }

  const _isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  function initShareSheet() {
    const trigger = document.getElementById('share-trigger');
    const sheet = document.getElementById('share-sheet');
    if (!trigger || !sheet) return;

    const backdrop = sheet.querySelector('.share-sheet-backdrop');
    const closeBtn = document.getElementById('share-sheet-close');
    const copyLink = document.getElementById('share-copy-link');
    const copyImage = document.getElementById('share-copy-image');
    const downloadImage = document.getElementById('share-download-image');

    function open() { sheet.classList.remove('hidden'); }
    function close() { sheet.classList.add('hidden'); }

    trigger.addEventListener('click', open);
    backdrop.addEventListener('click', close);
    closeBtn.addEventListener('click', close);

    // On mobile, change "Copy schedule" to "Share schedule"
    if (_isMobile) {
      const imgLabel = copyImage.querySelector('.share-sheet-label');
      imgLabel.textContent = 'Share schedule';
    }

    // Copy link
    copyLink.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(window.location.href);
        showStatus(copyLink, 'Copied!');
      } catch (e) {
        showStatus(copyLink, 'Failed');
      }
    });

    // Copy schedule
    copyImage.addEventListener('click', async () => {
      const label = copyImage.querySelector('.share-sheet-label');
      label.textContent = 'Generating...';
      copyImage.disabled = true;
      try {
        const blob = await generateImage();
        if (!blob) { showStatus(copyImage, 'Failed'); return; }

        const file = new File([blob], 'wc2026-schedule.png', { type: 'image/png' });

        if (_isMobile && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ title: 'FIFA World Cup 2026 Schedule', files: [file] });
        } else if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          showStatus(copyImage, 'Copied!');
        } else {
          // Fallback to download
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = 'wc2026-schedule.png';
          a.click();
          URL.revokeObjectURL(a.href);
          showStatus(copyImage, 'Downloaded!');
        }
      } catch (e) {
        console.error(e);
        showStatus(copyImage, 'Failed');
      } finally {
        label.textContent = _isMobile ? 'Share schedule' : 'Copy schedule';
        copyImage.disabled = false;
      }
    });

    // Download schedule
    downloadImage.addEventListener('click', async () => {
      const label = downloadImage.querySelector('.share-sheet-label');
      label.textContent = 'Generating...';
      downloadImage.disabled = true;
      try {
        const blob = await generateImage();
        if (!blob) { showStatus(downloadImage, 'Failed'); return; }
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'wc2026-schedule.png';
        a.click();
        URL.revokeObjectURL(a.href);
        showStatus(downloadImage, 'Downloaded!');
      } catch (e) {
        console.error(e);
        showStatus(downloadImage, 'Failed');
      } finally {
        label.textContent = 'Download schedule';
        downloadImage.disabled = false;
      }
    });

    // Add to calendar
    const addCalendar = document.getElementById('share-add-calendar');
    if (addCalendar) {
      addCalendar.addEventListener('click', () => {
        try {
          const matches = getFilteredMatches();
          const ics = generateICS(matches);
          const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = 'wc2026-schedule.ics';
          a.click();
          URL.revokeObjectURL(a.href);
          const count = matches.length;
          showStatus(addCalendar, `${count} match${count !== 1 ? 'es' : ''}!`);
        } catch (e) {
          console.error(e);
          showStatus(addCalendar, 'Failed');
        }
      });
    }
  }

  // --- Multi-filter state ---
  const activeFilters = { team: [], venue: [], group: [], stage: [] };

  function getActiveFilters() { return activeFilters; }

  function addFilter(type, value) {
    if (!value || activeFilters[type].includes(value)) return;
    activeFilters[type].push(value);
  }

  function removeFilter(type, value) {
    activeFilters[type] = activeFilters[type].filter(v => v !== value);
  }

  function clearAllFilters() {
    for (const key in activeFilters) activeFilters[key] = [];
  }

  function hasAnyFilter() {
    return Object.values(activeFilters).some(arr => arr.length > 0);
  }

  function matchPassesFilters(m) {
    const f = activeFilters;
    if (f.team.length && !f.team.some(t => m.homeTeam === t || m.awayTeam === t)) return false;
    if (f.venue.length && !f.venue.includes(m.venue)) return false;
    if (f.group.length && !f.group.includes(m.group)) return false;
    if (f.stage.length && !f.stage.includes(m.stage)) return false;
    return true;
  }

  function getFilteredMatches() {
    return allMatches.filter(matchPassesFilters);
  }

  function syncFiltersToURL() {
    const params = new URLSearchParams(location.search);
    for (const key of ['team', 'venue', 'group', 'stage']) {
      if (activeFilters[key].length) params.set(key, activeFilters[key].join(','));
      else params.delete(key);
    }
    params.set('tz', currentTz);
    history.replaceState(null, '', '?' + params.toString());
    updateNavLinks();
  }

  function restoreFiltersFromURL() {
    const params = new URLSearchParams(location.search);
    for (const key of ['team', 'venue', 'group', 'stage']) {
      const val = params.get(key);
      if (val) activeFilters[key] = val.split(',');
    }
  }

  const FILTER_PLACEHOLDERS = {
    team: 'All Teams', venue: 'All Venues', group: 'All Groups', stage: 'All Stages',
  };

  function updateTriggerLabel(type) {
    const dropdown = document.querySelector(`.filter-dropdown[data-type="${type}"]`);
    if (!dropdown) return;
    const trigger = dropdown.querySelector('.filter-trigger');
    const count = activeFilters[type].length;
    if (count === 0) {
      trigger.textContent = FILTER_PLACEHOLDERS[type];
      trigger.classList.remove('has-active');
    } else {
      trigger.textContent = `${FILTER_PLACEHOLDERS[type]} (${count})`;
      trigger.classList.add('has-active');
    }
  }

  function updateCheckboxStates(type) {
    const dropdown = document.querySelector(`.filter-dropdown[data-type="${type}"]`);
    if (!dropdown) return;
    dropdown.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.checked = activeFilters[type].includes(cb.value);
    });
    updateTriggerLabel(type);
  }

  function renderChips(onChangeCallback) {
    const container = document.getElementById('filter-chips');
    if (!container) return;

    const typeLabels = { team: 'Team', venue: 'Venue', group: 'Group', stage: 'Stage' };
    let html = '';

    for (const [type, values] of Object.entries(activeFilters)) {
      values.forEach(val => {
        let label = val;
        if (type === 'team') label = displayTeamName(val);
        else if (type === 'group') label = 'Group ' + val.replace('GROUP_', '').replace('Group ', '');
        else if (type === 'stage') label = STAGE_LABELS[val] || val;

        html += `<button class="filter-chip" data-type="${type}" data-value="${esc(val)}">
          <span class="chip-type">${typeLabels[type]}</span>
          <span>${esc(label)}</span>
          <span class="chip-remove">&times;</span>
        </button>`;
      });
    }

    if (hasAnyFilter()) {
      html += `<button class="clear-all">Clear all</button>`;
    }

    container.innerHTML = html;

    container.querySelectorAll('.filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        removeFilter(chip.dataset.type, chip.dataset.value);
        updateCheckboxStates(chip.dataset.type);
        syncFiltersToURL();
        renderChips(onChangeCallback);
        if (onChangeCallback) onChangeCallback();
      });
    });

    const clearBtn = container.querySelector('.clear-all');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        clearAllFilters();
        for (const type of Object.keys(activeFilters)) updateCheckboxStates(type);
        syncFiltersToURL();
        renderChips(onChangeCallback);
        if (onChangeCallback) onChangeCallback();
      });
    }
  }

  function initMultiFilters(onChangeCallback) {
    restoreFiltersFromURL();

    document.querySelectorAll('.filter-dropdown').forEach(dropdown => {
      const type = dropdown.dataset.type;
      const trigger = dropdown.querySelector('.filter-trigger');
      const menu = dropdown.querySelector('.filter-menu');

      // Toggle dropdown
      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        // Close other open menus
        document.querySelectorAll('.filter-menu').forEach(m => {
          if (m !== menu) m.classList.add('hidden');
        });
        menu.classList.toggle('hidden');
      });

      // Handle checkbox changes
      menu.addEventListener('change', (e) => {
        if (e.target.type !== 'checkbox') return;
        if (e.target.checked) {
          addFilter(type, e.target.value);
        } else {
          removeFilter(type, e.target.value);
        }
        updateTriggerLabel(type);
        syncFiltersToURL();
        renderChips(onChangeCallback);
        if (onChangeCallback) onChangeCallback();
      });

      updateTriggerLabel(type);
    });

    // Close menus on outside click
    document.addEventListener('click', () => {
      document.querySelectorAll('.filter-menu').forEach(m => m.classList.add('hidden'));
    });

    // Prevent menu clicks from closing
    document.querySelectorAll('.filter-menu').forEach(m => {
      m.addEventListener('click', e => e.stopPropagation());
    });

    renderChips(onChangeCallback);
    updateNavLinks();
  }

  function generateICS(matches) {
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//WC26 Schedule//wc-26-schedule.com//EN',
      'CALSCALE:GREGORIAN',
      'X-WR-CALNAME:FIFA World Cup 2026',
    ];

    matches.forEach(m => {
      const home = displayTeamName(m.homeTeam);
      const away = displayTeamName(m.awayTeam);
      const start = m.utcDate.replace(/[-:]/g, '').replace('.000', '');
      // Assume 2 hour match duration
      const endDate = new Date(m.utcDate);
      endDate.setHours(endDate.getHours() + 2);
      const end = endDate.toISOString().replace(/[-:]/g, '').replace('.000', '');

      const groupLabel = m.group ? m.group.replace('GROUP_', 'Group ').replace('Group ', 'Group ') : '';
      const stageLabel = STAGE_LABELS[m.stage] || m.stage;
      const description = [
        `FIFA World Cup 2026`,
        groupLabel ? `${groupLabel} - ${stageLabel}` : stageLabel,
        `wc-26-schedule.com`,
      ].join('\\n');

      lines.push(
        'BEGIN:VEVENT',
        `DTSTART:${start}`,
        `DTEND:${end}`,
        `SUMMARY:${home} vs ${away}`,
        `LOCATION:${m.venue || 'TBD'}`,
        `DESCRIPTION:${description}`,
        `UID:wc2026-${m.id}@wc-26-schedule.com`,
        'END:VEVENT',
      );
    });

    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
  }

  function setTz(tz) { currentTz = tz; }
  function getTz() { return currentTz; }
  function getMatches() { return allMatches; }

  return {
    STAGE_LABELS, COMMON_TIMEZONES, GROUP_COLORS, STAGE_COLORS,
    detectTimezone, formatTime, formatDate, formatDateShort,
    getLocalDateKey, getLocalHour, esc, getMatchColor,
    isRealTeam, teamHtml, displayTeamName, formatLastUpdated,
    initTimezoneUI, initShareSheet, initMultiFilters, loadMatches,
    getActiveFilters, hasAnyFilter, matchPassesFilters, getFilteredMatches,
    setTz, getTz, getMatches,
  };
})();
