"""Perfil sintético fixo com três comunidades conhecidas e um artista ponte."""

from datetime import datetime, timedelta, timezone


GROUPS = {
    "rock": ("R1", "R2", "R3", "R4"),
    "jazz": ("J1", "J2", "J3", "J4"),
    "electronic": ("E1", "E2", "E3", "E4"),
}


def _artist(artist_id, genres):
    return {"id": artist_id, "name": artist_id, "genres": genres, "popularity": 50, "images": []}


def _track(track_id, *artist_ids):
    return {
        "id": track_id,
        "name": track_id,
        "artists": [{"id": artist_id} for artist_id in artist_ids],
        "album": {"images": []},
    }


def make_profile():
    artists = [
        _artist("R1", ["indie rock", "alternative rock"]),
        _artist("R2", ["indie rock", "alternative rock"]),
        _artist("R3", ["indie rock", "modern rock"]),
        _artist("R4", ["alternative rock", "modern rock"]),
        _artist("J1", ["jazz fusion", "bebop"]),
        _artist("J2", ["jazz fusion", "bebop"]),
        _artist("J3", ["jazz fusion", "post-bop"]),
        _artist("J4", ["bebop", "post-bop"]),
        _artist("E1", ["electronic", "synthpop"]),
        _artist("E2", ["electronic", "synthpop"]),
        _artist("E3", ["electronic", "house"]),
        _artist("E4", ["synthpop", "house"]),
        _artist("X", ["indie rock", "jazz fusion", "electronic"]),
    ]
    top_tracks = [_track("bridge-rock", "X", "R1"), _track("bridge-jazz", "X", "J1")]
    recent_tracks = []
    start = datetime(2026, 1, 1, 10, tzinfo=timezone.utc)
    for day, group in enumerate(GROUPS.values()):
        for position, artist_id in enumerate(group):
            moment = start + timedelta(days=day, minutes=position * 3)
            recent_tracks.append({
                "played_at": moment.isoformat().replace("+00:00", "Z"),
                "track": _track(f"play-{artist_id}", artist_id),
            })
    recent_tracks.sort(key=lambda item: item["played_at"], reverse=True)
    return {"artists": artists, "top_tracks": top_tracks, "recent_tracks": recent_tracks, "saved_tracks": []}
