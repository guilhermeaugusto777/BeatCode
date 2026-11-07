"""Experimentos de tempo são referências independentes da API principal."""

from datetime import datetime, timedelta, timezone

import pytest

from experiments.temporal_models import temporal_matrix


ARTISTS = [{"id": "A"}, {"id": "B"}]


def events(minutes_apart):
    start = datetime(2026, 1, 1, 10, tzinfo=timezone.utc)
    return [
        {"played_at": start.isoformat(), "track": {"artists": [{"id": "A"}]}},
        {"played_at": (start + timedelta(minutes=minutes_apart)).isoformat(), "track": {"artists": [{"id": "B"}]}},
    ]


@pytest.mark.parametrize(
    ("minutes", "current", "session", "decay", "bounded"),
    [
        (2, 1.0, 1.0, 0.95484, 0.95484),
        (120, 1.0, 0.0, 0.0625, 0.0),
        (1440, 1.0, 0.0, 0.0, 0.0),
    ],
)
def test_minutes_hours_days(minutes, current, session, decay, bounded):
    samples = events(minutes)
    assert temporal_matrix(ARTISTS, samples, model="current").matrix[0, 1] == current
    assert temporal_matrix(ARTISTS, samples, model="session").matrix[0, 1] == session
    assert temporal_matrix(ARTISTS, samples, model="decay").matrix[0, 1] == pytest.approx(decay, abs=1e-5)
    assert temporal_matrix(ARTISTS, samples, model="bounded_decay").matrix[0, 1] == pytest.approx(bounded, abs=1e-5)


def test_timestamp_models_sort_events_and_skip_unknown_time():
    samples = events(2)
    samples.append({"track": {"artists": [{"id": "A"}]}})
    result = temporal_matrix(ARTISTS, list(reversed(samples)), model="session")
    assert result.matrix[0, 1] == 1.0
    assert result.eligible_events == 2
    assert result.missing_timestamps == 1
    assert result.sessions == 1


def test_session_boundary_uses_consecutive_gap_and_window():
    artists = [{"id": "A"}, {"id": "B"}, {"id": "C"}]
    start = datetime(2026, 1, 1, 10, tzinfo=timezone.utc)
    samples = [
        {"played_at": (start + timedelta(minutes=minutes)).isoformat(),
         "track": {"artists": [{"id": artist_id}]}}
        for minutes, artist_id in [(0, "A"), (20, "B"), (40, "C")]
    ]
    result = temporal_matrix(artists, samples, model="session")
    assert result.sessions == 1
    assert result.matrix[0, 2] == 1.0
    bounded = temporal_matrix(artists, samples, model="bounded_decay")
    assert bounded.matrix[0, 2] == 0.0


def test_invalid_parameters_are_rejected():
    with pytest.raises(ValueError):
        temporal_matrix(ARTISTS, [], model="decay", half_life_minutes=0)
