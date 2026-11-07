"""Normalização conservadora dos rótulos de gênero fornecidos pelo Spotify."""

import re
import unicodedata


def normalize_genre(value):
    if not isinstance(value, str):
        return ""
    label = unicodedata.normalize("NFKC", value).casefold().strip()
    label = re.sub(r"\s+", " ", label)
    label = re.sub(r"\s*&\s*", "&", label)
    label = re.sub(r"\s*[-‐‑–—]\s*", "-", label)
    return label


def build_compatible_genre_corpus(artists):
    """Preserva rótulo completo e subtermos históricos, deduplicando rótulos.

    O corpus é usado com token_pattern=\\S+ para não quebrar r&b e similares.
    """
    corpus = []
    for artist in artists:
        seen = set()
        tokens = []
        for raw in artist.get("genres") or []:
            label = normalize_genre(raw)
            if not label or label in seen:
                continue
            seen.add(label)
            exact = label.replace(" ", "_").replace("-", "_")
            parts = [part for part in label.replace("-", " ").split() if len(part) > 2]
            tokens.extend([exact, exact, *parts])
        corpus.append(" ".join(tokens))
    return corpus
