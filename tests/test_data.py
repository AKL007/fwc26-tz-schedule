#!/usr/bin/env python3
"""Validate matches.json data integrity.

Run: python3 -m pytest tests/ -v
Or:  python3 tests/test_data.py
"""

import json
import os
import re
import unittest
from datetime import datetime

DATA_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'matches.json')

VALID_STAGES = {
    'GROUP_STAGE', 'ROUND_OF_32', 'ROUND_OF_16',
    'QUARTER_FINAL', 'SEMI_FINAL',
    'THIRD_PLACE', 'MATCH_FOR_THIRD_PLACE',
    'FINAL',
}

VALID_GROUPS = {f'GROUP_{c}' for c in 'ABCDEFGHIJKL'}

VALID_STATUSES = {'SCHEDULED', 'TIMED', 'LIVE', 'IN_PLAY', 'PAUSED',
                  'FINISHED', 'POSTPONED', 'CANCELLED', 'SUSPENDED', 'AWARDED'}

# Known placeholder patterns (not real teams)
PLACEHOLDER_PATTERNS = [
    r'^\d',                    # "1st Group A", "2nd Group B", "3A/B/C/D/F"
    r'^(Winner|Loser) Match',  # "Winner Match 73"
    r'Path \w+ winner',        # "UEFA Path A winner"
    r'^TBD$',
]


class TestDataFile(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with open(DATA_PATH) as f:
            cls.data = json.load(f)
        cls.matches = cls.data['matches']

    def test_file_has_last_updated(self):
        self.assertIn('lastUpdated', self.data)
        # Should be valid ISO datetime
        datetime.fromisoformat(self.data['lastUpdated'].replace('Z', '+00:00'))

    def test_has_matches(self):
        self.assertGreaterEqual(len(self.matches), 64, 'Should have at least 64 matches')
        self.assertLessEqual(len(self.matches), 120, 'Should not exceed 120 matches')


class TestMatchSchema(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with open(DATA_PATH) as f:
            cls.matches = json.load(f)['matches']

    def test_required_fields_present(self):
        required = {'id', 'utcDate', 'stage', 'homeTeam', 'awayTeam', 'venue', 'score', 'status'}
        for i, m in enumerate(self.matches):
            for field in required:
                self.assertIn(field, m, f'Match {i} missing field: {field}')

    def test_utc_date_format(self):
        for m in self.matches:
            self.assertRegex(
                m['utcDate'],
                r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$',
                f'Match {m["id"]}: utcDate should be ISO 8601 UTC'
            )

    def test_utc_dates_in_range(self):
        for m in self.matches:
            dt = datetime.fromisoformat(m['utcDate'].replace('Z', '+00:00'))
            self.assertGreaterEqual(dt.year, 2026, f'Match {m["id"]}: year should be 2026+')
            self.assertLessEqual(dt.year, 2027, f'Match {m["id"]}: year should be <= 2027')


class TestStagesAndGroups(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with open(DATA_PATH) as f:
            cls.matches = json.load(f)['matches']

    def test_valid_stages(self):
        for m in self.matches:
            self.assertIn(
                m['stage'], VALID_STAGES,
                f'Match {m["id"]}: invalid stage "{m["stage"]}"'
            )

    def test_group_format(self):
        """Groups must use GROUP_X format, never 'Group X'."""
        for m in self.matches:
            if m.get('group'):
                self.assertIn(
                    m['group'], VALID_GROUPS,
                    f'Match {m["id"]}: group "{m["group"]}" not in expected format GROUP_X'
                )
                self.assertNotIn(
                    'Group ', m['group'],
                    f'Match {m["id"]}: group uses old "Group X" format'
                )

    def test_group_stage_has_group(self):
        for m in self.matches:
            if m['stage'] == 'GROUP_STAGE':
                self.assertIsNotNone(
                    m.get('group'),
                    f'Match {m["id"]}: GROUP_STAGE match missing group'
                )

    def test_knockout_has_no_group(self):
        for m in self.matches:
            if m['stage'] != 'GROUP_STAGE':
                self.assertIn(
                    m.get('group'), (None, ''),
                    f'Match {m["id"]}: knockout match should not have group'
                )


class TestTeams(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with open(DATA_PATH) as f:
            cls.matches = json.load(f)['matches']

    def test_teams_not_empty(self):
        for m in self.matches:
            self.assertTrue(m['homeTeam'], f'Match {m["id"]}: homeTeam is empty')
            self.assertTrue(m['awayTeam'], f'Match {m["id"]}: awayTeam is empty')

    def test_group_stage_has_real_teams(self):
        """At minimum, group stage should have actual nation names (not all placeholders)."""
        real_teams = set()
        for m in self.matches:
            if m['stage'] == 'GROUP_STAGE':
                for team in (m['homeTeam'], m['awayTeam']):
                    if not any(re.match(p, team) for p in PLACEHOLDER_PATTERNS):
                        real_teams.add(team)
        self.assertGreaterEqual(
            len(real_teams), 40,
            f'Expected 40+ real teams in group stage, got {len(real_teams)}'
        )


class TestVenues(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with open(DATA_PATH) as f:
            cls.matches = json.load(f)['matches']

    def test_group_stage_venues_not_empty(self):
        """Group stage matches should have venues (from seed data at minimum)."""
        empty_venues = [
            m['id'] for m in self.matches
            if m['stage'] == 'GROUP_STAGE' and not m.get('venue')
        ]
        self.assertEqual(
            len(empty_venues), 0,
            f'{len(empty_venues)} group stage matches have empty venues: {empty_venues[:5]}...'
        )

    def test_venues_are_strings(self):
        for m in self.matches:
            self.assertIsInstance(m['venue'], str, f'Match {m["id"]}: venue should be string')


class TestScores(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with open(DATA_PATH) as f:
            cls.matches = json.load(f)['matches']

    def test_score_structure(self):
        for m in self.matches:
            self.assertIn('score', m)
            self.assertIn('home', m['score'], f'Match {m["id"]}: score missing home')
            self.assertIn('away', m['score'], f'Match {m["id"]}: score missing away')

    def test_scheduled_matches_have_null_scores(self):
        for m in self.matches:
            if m['status'] in ('SCHEDULED', 'TIMED'):
                self.assertIsNone(
                    m['score']['home'],
                    f'Match {m["id"]}: scheduled match should have null score'
                )

    def test_finished_matches_have_scores(self):
        for m in self.matches:
            if m['status'] == 'FINISHED':
                self.assertIsNotNone(
                    m['score']['home'],
                    f'Match {m["id"]}: finished match should have score'
                )


class TestStatus(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with open(DATA_PATH) as f:
            cls.matches = json.load(f)['matches']

    def test_valid_status(self):
        for m in self.matches:
            self.assertIn(
                m['status'], VALID_STATUSES,
                f'Match {m["id"]}: invalid status "{m["status"]}"'
            )


if __name__ == '__main__':
    unittest.main()
