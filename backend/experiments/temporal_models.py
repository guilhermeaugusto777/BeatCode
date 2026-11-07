"""Heurísticas temporais isoladas; nenhuma delas é usada pela API."""

import math
from dataclasses import dataclass
from datetime import datetime

import numpy as np

from main import compute_current_session_matrix


@dataclass(frozen=True)
class TemporalResult:
    matrix: np.ndarray
    eligible_events: int
    missing_timestamps: int
    sessions: int


def _dated_events(artists, recent_tracks):
    artist_idx = {artist["id"]: index for index, artist in enumerate(artists)}
    events = []
    missing = 0
    for item in recent_tracks:
        track = item.get("track") if isinstance(item, dict) else None
        track_artists = track.get("artists") if isinstance(track, dict) else None
        artist_id = track_artists[0].get("id") if track_artists and isinstance(track_artists[0], dict) else None
        if artist_id not in artist_idx:
            continue
        raw = item.get("played_at")
        try:
            played_at = datetime.fromisoformat(raw.replace("Z", "+00:00"))
            if played_at.tzinfo is None:
                raise ValueError("timezone ausente")
        except (AttributeError, TypeError, ValueError):
            missing += 1
            continue
        events.append((played_at, artist_idx[artist_id]))
    events.sort(key=lambda event: event[0])
    return events, missing


def temporal_matrix(
    artists,
    recent_tracks,
    *,
    model,
    window=3,
    session_gap_minutes=30,
    half_life_minutes=30,
):
    """Compara posição, sessão por lacuna e proximidade com meia-vida.

    Sessão/decay usam valores absolutos limitados a 1; normalizar pelo maior
    par apagaria o significado de minutos versus dias em perfis pequenos.
    """
    if model not in {"current", "session", "decay", "bounded_decay"}:
        raise ValueError("modelo desconhecido")
    if window < 2 or (model == "current" and window != 3) or session_gap_minutes <= 0 or half_life_minutes <= 0:
        raise ValueError("janela inválida; lacuna e meia-vida devem ser positivas")
    if model == "current":
        matrix = compute_current_session_matrix(artists, recent_tracks)
        return TemporalResult(matrix, len(recent_tracks), 0, 0)

    events, missing = _dated_events(artists, recent_tracks)
    matrix = np.zeros((len(artists), len(artists)), dtype=float)
    session_ids = []
    session_id = -1
    for i, (played_at, _) in enumerate(events):
        if i == 0 or (played_at - events[i - 1][0]).total_seconds() > session_gap_minutes * 60:
            session_id += 1
        session_ids.append(session_id)

    for i, (played_at, u) in enumerate(events):
        for j in range(i + 1, min(i + window, len(events))):
            other_time, v = events[j]
            if u == v:
                continue
            gap = (other_time - played_at).total_seconds() / 60
            if model == "session":
                contribution = 1.0 if session_ids[i] == session_ids[j] else 0.0
            elif model == "bounded_decay" and (
                session_ids[i] != session_ids[j] or gap > session_gap_minutes
            ):
                contribution = 0.0
            else:
                contribution = math.exp(-math.log(2) * gap / half_life_minutes)
            matrix[u, v] += contribution
            matrix[v, u] += contribution

    return TemporalResult(np.minimum(matrix, 1.0), len(events), missing, session_id + 1)
