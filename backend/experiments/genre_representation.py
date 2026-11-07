"""Candidatos reproduzíveis para representar os rótulos de gênero do Spotify."""

import re

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from genre_representation import build_compatible_genre_corpus, normalize_genre


CONNECTORS = {"and", "the", "of", "de", "do", "da", "e"}


def genre_features(artists, *, mode="hybrid"):
    """Retorna listas de features; o rótulo completo nunca é quebrado.

    `hybrid` preserva também palavras relevantes, mas a hipótese semântica
    dessas palavras ainda precisa de validação com dados reais.
    """
    if mode not in {"hybrid", "exact"}:
        raise ValueError("mode deve ser hybrid ou exact")
    documents = []
    for artist in artists:
        seen = set()
        features = []
        for raw in artist.get("genres") or []:
            label = normalize_genre(raw)
            if not label or label in seen:
                continue
            seen.add(label)
            features.extend([f"genre:{label}"] * (2 if mode == "hybrid" else 1))
            if mode == "hybrid":
                for word in re.split(r"[\s\-_]+", label):
                    if len(word) >= 3 and word not in CONNECTORS:
                        features.append(f"word:{word}")
        documents.append(features)
    return documents


def compatible_genre_cosine_matrix(artists):
    corpus = build_compatible_genre_corpus(artists)
    if not any(corpus):
        return np.zeros((len(artists), len(artists)), dtype=float)
    vectorizer = TfidfVectorizer(token_pattern=r"(?u)\S+")
    matrix = cosine_similarity(vectorizer.fit_transform(corpus))
    np.fill_diagonal(matrix, 0.0)
    return matrix


def legacy_genre_cosine_matrix(artists):
    """Reprodução do tokenizer anterior para comparações históricas."""
    corpus = []
    for artist in artists:
        tokens = []
        for raw in artist.get("genres") or []:
            if not isinstance(raw, str):
                continue
            exact = raw.lower().strip().replace(" ", "_").replace("-", "_")
            parts = [part for part in raw.lower().replace("-", " ").split() if len(part) > 2]
            tokens.extend([exact, exact, *parts])
        corpus.append(" ".join(tokens))
    if not any(corpus):
        return np.zeros((len(artists), len(artists)), dtype=float)
    matrix = cosine_similarity(TfidfVectorizer().fit_transform(corpus))
    np.fill_diagonal(matrix, 0.0)
    return matrix


def genre_cosine_matrix(artists, *, mode="hybrid"):
    documents = genre_features(artists, mode=mode)
    if not any(documents):
        return np.zeros((len(artists), len(artists)), dtype=float)
    vectorizer = TfidfVectorizer(analyzer=lambda features: features, lowercase=False)
    matrix = cosine_similarity(vectorizer.fit_transform(documents))
    np.fill_diagonal(matrix, 0.0)
    return matrix
