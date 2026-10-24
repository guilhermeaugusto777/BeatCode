import os
from collections import defaultdict
from typing import Dict, List, Any, Literal

import numpy as np
import networkx as nx
from networkx.algorithms import community
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from pathlib import Path
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import RedirectResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import spotipy
from spotipy.oauth2 import SpotifyOAuth

load_dotenv()

app = FastAPI(
    title="Spotify Music Graph API",
    description="API de análise de grafos musicais (Unipartido de Artistas e Bipartido Artistas ↔ Gêneros)",
    version="1.0.0",
)

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://127.0.0.1:8000")
INDEX_HTML_PATH = Path(__file__).parent / "index.html"


@app.get("/", include_in_schema=False)
def serve_frontend():
    return FileResponse(INDEX_HTML_PATH)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        FRONTEND_URL,
        "http://127.0.0.1:3000",
        "http://[::1]:3000",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SCOPES = "user-top-read user-read-recently-played user-library-read"

CLUSTER_PALETTE = [
    "#1DB954",  # Spotify Green
    "#3B82F6",  # Electric Blue
    "#F59E0B",  # Amber
    "#EC4899",  # Neon Pink
    "#8B5CF6",  # Violet
    "#06B6D4",  # Cyan
    "#EF4444",  # Coral Red
    "#10B981",  # Emerald
]


def get_spotify_oauth() -> SpotifyOAuth:
    client_id = os.getenv("SPOTIPY_CLIENT_ID")
    client_secret = os.getenv("SPOTIPY_CLIENT_SECRET")
    redirect_uri = os.getenv("SPOTIPY_REDIRECT_URI", "http://127.0.0.1:8000/auth/callback")

    if not client_id or not client_secret or client_id == "seu_client_id_aqui":
        raise HTTPException(
            status_code=400,
            detail="Configure SPOTIPY_CLIENT_ID e SPOTIPY_CLIENT_SECRET no arquivo backend/.env",
        )

    return SpotifyOAuth(
        client_id=client_id,
        client_secret=client_secret,
        redirect_uri=redirect_uri,
        scope=SCOPES,
        cache_path=".spotify_token_cache",
        show_dialog=False,
    )


@app.get("/auth/login")
def login():
    sp_oauth = get_spotify_oauth()
    auth_url = sp_oauth.get_authorize_url()
    return RedirectResponse(auth_url)


@app.get("/auth/callback")
def callback(code: str):
    sp_oauth = get_spotify_oauth()
    token_info = sp_oauth.get_access_token(code, as_dict=True)
    if not token_info:
        raise HTTPException(status_code=400, detail="Falha ao obter token OAuth 2.0 do Spotify.")
    return RedirectResponse(FRONTEND_URL)


@app.get("/auth/status")
def auth_status():
    try:
        sp_oauth = get_spotify_oauth()
        token_info = sp_oauth.validate_token(sp_oauth.cache_handler.get_cached_token())
        return {"authenticated": bool(token_info)}
    except Exception:
        return {"authenticated": False}


def get_spotify_client() -> spotipy.Spotify:
    sp_oauth = get_spotify_oauth()
    token_info = sp_oauth.validate_token(sp_oauth.cache_handler.get_cached_token())
    if not token_info:
        raise HTTPException(
            status_code=401,
            detail="Usuário não autenticado no Spotify. Acesse http://127.0.0.1:8000/auth/login",
        )
    return spotipy.Spotify(auth=token_info["access_token"])


def build_genre_corpus(artists: List[Dict[str, Any]]) -> List[str]:
    """
    Constrói documentos de texto combinando o gênero exato (com underscore)
    e seus sub-tokens para capturar tanto 'indie_rock' exato quanto 'indie'.
    """
    corpus = []
    for artist in artists:
        tokens = []
        for g in artist.get("genres", []):
            exact_token = g.lower().strip().replace(" ", "_").replace("-", "_")
            sub_tokens = [t for t in g.lower().replace("-", " ").split() if len(t) > 2]
            tokens.extend([exact_token, exact_token] + sub_tokens)
        corpus.append(" ".join(tokens))
    return corpus


def extract_artist_tracks_and_collabs(
    artists: List[Dict[str, Any]],
    top_tracks: List[Dict[str, Any]],
    saved_tracks: List[Dict[str, Any]],
):
    n = len(artists)
    artist_idx = {a["id"]: i for i, a in enumerate(artists)}
    artist_top_tracks: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    collab_matrix = np.zeros((n, n), dtype=float)

    all_tracks_pool = top_tracks + [item["track"] for item in saved_tracks if item.get("track")]
    seen_track_ids = set()

    for track in all_tracks_pool:
        if not track or track["id"] in seen_track_ids:
            continue
        seen_track_ids.add(track["id"])

        track_artist_ids = [a["id"] for a in track.get("artists", []) if a["id"] in artist_idx]
        for a_id in track_artist_ids:
            if len(artist_top_tracks[a_id]) < 5:
                artist_top_tracks[a_id].append({
                    "id": track["id"],
                    "name": track["name"],
                    "album_image": (
                        track["album"]["images"][-1]["url"]
                        if track.get("album", {}).get("images")
                        else None
                    ),
                })

        if len(track_artist_ids) > 1:
            for i in range(len(track_artist_ids)):
                for j in range(i + 1, len(track_artist_ids)):
                    u, v = artist_idx[track_artist_ids[i]], artist_idx[track_artist_ids[j]]
                    collab_matrix[u, v] += 1.0
                    collab_matrix[v, u] += 1.0

    collab_matrix = np.minimum(1.0, collab_matrix / 2.0)
    return artist_top_tracks, collab_matrix


def compute_unipartite_artist_graph(
    artists: List[Dict[str, Any]],
    top_tracks: List[Dict[str, Any]],
    recent_tracks: List[Dict[str, Any]],
    saved_tracks: List[Dict[str, Any]],
    time_range: str,
    k_neighbors: int = 5,
    min_weight: float = 0.12,
) -> Dict[str, Any]:
    """
    Modo 1: Grafo Unipartido (Artista ↔ Artista)
    Calcula pesos combinando TF-IDF de gêneros, colaborações diretas e co-escuta em sessão,
    aplicando poda topológica via k-NN + Maximum Spanning Tree.
    """
    n = len(artists)
    if n == 0:
        return {"metadata": {}, "nodes": [], "links": []}

    artist_idx = {a["id"]: i for i, a in enumerate(artists)}
    artist_top_tracks, collab_matrix = extract_artist_tracks_and_collabs(
        artists, top_tracks, saved_tracks
    )

    # Matriz de Co-escuta em Sessões Recentes (janela deslizante = 3)
    session_matrix = np.zeros((n, n), dtype=float)
    recent_artist_seq = []
    for item in recent_tracks:
        track = item.get("track")
        if track and track.get("artists"):
            primary_id = track["artists"][0]["id"]
            if primary_id in artist_idx:
                recent_artist_seq.append(artist_idx[primary_id])

    window = 3
    for i in range(len(recent_artist_seq)):
        u = recent_artist_seq[i]
        for j in range(i + 1, min(i + window, len(recent_artist_seq))):
            v = recent_artist_seq[j]
            if u != v:
                session_matrix[u, v] += 1.0
                session_matrix[v, u] += 1.0

    max_session = session_matrix.max()
    if max_session > 0:
        session_matrix = session_matrix / max_session

    # Similaridade de Gênero via TF-IDF + Cosseno
    corpus = build_genre_corpus(artists)
    if any(len(doc) > 0 for doc in corpus):
        vectorizer = TfidfVectorizer()
        tfidf_matrix = vectorizer.fit_transform(corpus)
        genre_sim_matrix = cosine_similarity(tfidf_matrix)
        np.fill_diagonal(genre_sim_matrix, 0.0)
    else:
        genre_sim_matrix = np.zeros((n, n), dtype=float)

    # Peso Composto: W = 0.65 * Genre + 0.25 * Collab + 0.10 * Session
    alpha, beta, gamma = 0.65, 0.25, 0.10
    weight_matrix = np.clip(
        alpha * genre_sim_matrix + beta * collab_matrix + gamma * session_matrix,
        0.0,
        1.0,
    )

    # Poda Topológica (k-NN + Maximum Spanning Tree)
    G_full = nx.Graph()
    for i, artist in enumerate(artists):
        G_full.add_node(artist["id"], idx=i)

    for i in range(n):
        for j in range(i + 1, n):
            w = float(weight_matrix[i, j])
            if w >= min_weight:
                G_full.add_edge(artists[i]["id"], artists[j]["id"], weight=w)

    mst_edges = set()
    if G_full.number_of_edges() > 0:
        T = nx.maximum_spanning_tree(G_full, weight="weight")
        mst_edges = {tuple(sorted(e)) for e in T.edges()}

    knn_edges = set()
    for i in range(n):
        row = weight_matrix[i]
        top_indices = np.argsort(row)[::-1][:k_neighbors]
        for j in top_indices:
            if row[j] >= min_weight and i != j:
                edge_key = tuple(sorted((artists[i]["id"], artists[j]["id"])))
                knn_edges.add(edge_key)

    final_edges = mst_edges.union(knn_edges)

    G = nx.Graph()
    for artist in artists:
        G.add_node(artist["id"])

    links_payload = []
    for u_id, v_id in final_edges:
        i, j = artist_idx[u_id], artist_idx[v_id]
        w = round(float(weight_matrix[i, j]), 4)
        shared_genres = sorted(
            list(set(artists[i].get("genres", [])).intersection(set(artists[j].get("genres", []))))
        )
        G.add_edge(u_id, v_id, weight=w)
        links_payload.append({
            "source": u_id,
            "target": v_id,
            "weight": w,
            "link_type": "artist-artist",
            "components": {
                "genre_similarity": round(float(genre_sim_matrix[i, j]), 3),
                "direct_collaboration": round(float(collab_matrix[i, j]), 3),
                "co_listening": round(float(session_matrix[i, j]), 3),
            },
            "shared_genres": shared_genres,
        })

    # Detecção de Comunidades (Louvain)
    if G.number_of_edges() > 0:
        communities_list = community.louvain_communities(G, weight="weight", seed=42)
        communities_list = sorted(communities_list, key=lambda c: len(c), reverse=True)
        modularity_val = round(community.modularity(G, communities_list, weight="weight"), 3)
    else:
        communities_list = [set(G.nodes())]
        modularity_val = 0.0

    node_cluster: Dict[str, int] = {}
    clusters_summary = []
    for c_idx, comm in enumerate(communities_list):
        color = CLUSTER_PALETTE[c_idx % len(CLUSTER_PALETTE)]
        genre_counts: Dict[str, int] = defaultdict(int)
        for node_id in comm:
            node_cluster[node_id] = c_idx
            for g in artists[artist_idx[node_id]].get("genres", []):
                genre_counts[g] += 1

        dominant_genres = [
            g for g, _ in sorted(genre_counts.items(), key=lambda x: x[1], reverse=True)[:3]
        ]
        clusters_summary.append({
            "cluster_id": c_idx,
            "color": color,
            "dominant_genres": dominant_genres or ["eclético"],
            "artist_count": len(comm),
        })

    degree_cent = nx.degree_centrality(G)
    for u, v, d in G.edges(data=True):
        d["distance"] = 1.0 / max(d["weight"], 1e-4)
    betweenness_cent = nx.betweenness_centrality(G, weight="distance", normalized=True)

    nodes_payload = []
    for rank_idx, artist in enumerate(artists):
        a_id = artist["id"]
        c_id = node_cluster.get(a_id, 0)
        color = CLUSTER_PALETTE[c_id % len(CLUSTER_PALETTE)]

        affinity_score = round(1.0 - (rank_idx / max(n, 1)) * 0.75, 3)
        pop = artist.get("popularity", 50)
        node_size = round(10 + 18 * (0.7 * affinity_score + 0.3 * (pop / 100.0)), 2)

        images = artist.get("images", [])
        image_url = images[1]["url"] if len(images) > 1 else (images[0]["url"] if images else None)

        nodes_payload.append({
            "id": a_id,
            "name": artist["name"],
            "node_type": "artist",
            "affinity_rank": rank_idx + 1,
            "affinity_score": affinity_score,
            "global_popularity": pop,
            "val": node_size,
            "cluster_id": c_id,
            "color": color,
            "image_url": image_url,
            "genres": artist.get("genres", []),
            "top_tracks": artist_top_tracks.get(a_id, []),
            "metrics": {
                "degree_centrality": round(degree_cent.get(a_id, 0.0), 3),
                "betweenness_centrality": round(betweenness_cent.get(a_id, 0.0), 3),
            },
        })

    bridge_node = max(nodes_payload, key=lambda x: x["metrics"]["betweenness_centrality"])

    return {
        "metadata": {
            "graph_mode": "artists",
            "time_range": time_range,
            "total_nodes": len(nodes_payload),
            "total_links": len(links_payload),
            "modularity_score": modularity_val,
            "bridge_artist": {
                "id": bridge_node["id"],
                "name": bridge_node["name"],
                "betweenness_centrality": bridge_node["metrics"]["betweenness_centrality"],
            },
            "clusters": clusters_summary,
        },
        "nodes": nodes_payload,
        "links": links_payload,
    }


def compute_bipartite_artist_genre_graph(
    artists: List[Dict[str, Any]],
    top_tracks: List[Dict[str, Any]],
    saved_tracks: List[Dict[str, Any]],
    time_range: str,
) -> Dict[str, Any]:
    """
    Modo 2: Grafo Bipartido (Artistas ↔ Gêneros)
    Cria dois conjuntos disjuntos de nós:
      - U: Artistas (com foto, afinidade, músicas)
      - V: Gêneros musicais (filtrados para gêneros relevantes que conectam artistas ou definem nichos)
    """
    n = len(artists)
    if n == 0:
        return {"metadata": {}, "nodes": [], "links": []}

    artist_top_tracks, _ = extract_artist_tracks_and_collabs(artists, top_tracks, saved_tracks)

    # Contagem de frequência de cada gênero no perfil do usuário
    genre_to_artists: Dict[str, List[str]] = defaultdict(list)
    for artist in artists:
        for g in artist.get("genres", []):
            genre_to_artists[g].append(artist["id"])

    # Seleciona gêneros que conectam >= 2 artistas OU o gênero principal de um artista sem gênero compartilhado
    selected_genres = {g for g, a_list in genre_to_artists.items() if len(a_list) >= 2}
    for artist in artists:
        a_genres = artist.get("genres", [])
        if a_genres and not any(g in selected_genres for g in a_genres):
            selected_genres.add(a_genres[0])

    B = nx.Graph()
    artist_map = {}
    for rank_idx, artist in enumerate(artists):
        a_id = artist["id"]
        artist_map[a_id] = (rank_idx, artist)
        B.add_node(a_id, bipartite=0, node_type="artist")

    for g in selected_genres:
        g_node_id = f"genre::{g}"
        B.add_node(g_node_id, bipartite=1, node_type="genre", label=g)

    links_payload = []
    for rank_idx, artist in enumerate(artists):
        a_id = artist["id"]
        affinity_score = 1.0 - (rank_idx / max(n, 1)) * 0.70
        for g in artist.get("genres", []):
            if g in selected_genres:
                g_node_id = f"genre::{g}"
                # Peso da aresta Artista-Gênero proporcional à afinidade do usuário pelo artista
                w = round(float(0.35 + 0.65 * affinity_score), 3)
                B.add_edge(a_id, g_node_id, weight=w)
                links_payload.append({
                    "source": a_id,
                    "target": g_node_id,
                    "weight": w,
                    "link_type": "artist-genre",
                    "shared_genres": [g],
                })

    # Detecção de Comunidades no Grafo Bipartido via Louvain
    if B.number_of_edges() > 0:
        communities_list = community.louvain_communities(B, weight="weight", seed=42)
        communities_list = sorted(communities_list, key=lambda c: len(c), reverse=True)
        modularity_val = round(community.modularity(B, communities_list, weight="weight"), 3)
    else:
        communities_list = [set(B.nodes())]
        modularity_val = 0.0

    node_cluster: Dict[str, int] = {}
    clusters_summary = []
    for c_idx, comm in enumerate(communities_list):
        color = CLUSTER_PALETTE[c_idx % len(CLUSTER_PALETTE)]
        comm_genres = []
        comm_artists_count = 0
        for node_id in comm:
            node_cluster[node_id] = c_idx
            if node_id.startswith("genre::"):
                g_name = node_id.replace("genre::", "")
                comm_genres.append((g_name, len(genre_to_artists[g_name])))
            else:
                comm_artists_count += 1

        comm_genres.sort(key=lambda x: x[1], reverse=True)
        dominant_genres = [g for g, _ in comm_genres[:3]]
        if comm_artists_count > 0:
            clusters_summary.append({
                "cluster_id": c_idx,
                "color": color,
                "dominant_genres": dominant_genres or ["eclético"],
                "artist_count": comm_artists_count,
            })

    degree_cent = nx.degree_centrality(B)
    betweenness_cent = nx.betweenness_centrality(B, normalized=True)

    nodes_payload = []
    # 1. Nós de Artistas
    for rank_idx, artist in enumerate(artists):
        a_id = artist["id"]
        c_id = node_cluster.get(a_id, 0)
        color = CLUSTER_PALETTE[c_id % len(CLUSTER_PALETTE)]
        affinity_score = round(1.0 - (rank_idx / max(n, 1)) * 0.75, 3)
        pop = artist.get("popularity", 50)
        node_size = round(9 + 14 * (0.7 * affinity_score + 0.3 * (pop / 100.0)), 2)

        images = artist.get("images", [])
        image_url = images[1]["url"] if len(images) > 1 else (images[0]["url"] if images else None)

        nodes_payload.append({
            "id": a_id,
            "name": artist["name"],
            "node_type": "artist",
            "affinity_rank": rank_idx + 1,
            "affinity_score": affinity_score,
            "global_popularity": pop,
            "val": node_size,
            "cluster_id": c_id,
            "color": color,
            "image_url": image_url,
            "genres": artist.get("genres", []),
            "top_tracks": artist_top_tracks.get(a_id, []),
            "metrics": {
                "degree_centrality": round(degree_cent.get(a_id, 0.0), 3),
                "betweenness_centrality": round(betweenness_cent.get(a_id, 0.0), 3),
            },
        })

    # 2. Nós de Gêneros (Hubs Semânticos)
    for g in selected_genres:
        g_node_id = f"genre::{g}"
        c_id = node_cluster.get(g_node_id, 0)
        color = CLUSTER_PALETTE[c_id % len(CLUSTER_PALETTE)]
        connected_count = len(genre_to_artists[g])
        genre_size = round(8 + min(connected_count * 2.5, 18), 2)

        nodes_payload.append({
            "id": g_node_id,
            "name": g.upper(),
            "node_type": "genre",
            "affinity_rank": None,
            "affinity_score": round(connected_count / max(n, 1), 3),
            "global_popularity": connected_count * 10,
            "val": genre_size,
            "cluster_id": c_id,
            "color": color,
            "image_url": None,
            "genres": [g],
            "top_tracks": [],
            "connected_artists_count": connected_count,
            "metrics": {
                "degree_centrality": round(degree_cent.get(g_node_id, 0.0), 3),
                "betweenness_centrality": round(betweenness_cent.get(g_node_id, 0.0), 3),
            },
        })

    artist_only_nodes = [nd for nd in nodes_payload if nd["node_type"] == "artist"]
    bridge_node = max(
        artist_only_nodes,
        key=lambda x: x["metrics"]["betweenness_centrality"],
        default={"id": "", "name": "N/A", "metrics": {"betweenness_centrality": 0.0}},
    )

    return {
        "metadata": {
            "graph_mode": "bipartite",
            "time_range": time_range,
            "total_nodes": len(nodes_payload),
            "total_links": len(links_payload),
            "modularity_score": modularity_val,
            "bridge_artist": {
                "id": bridge_node["id"],
                "name": bridge_node["name"],
                "betweenness_centrality": bridge_node["metrics"]["betweenness_centrality"],
            },
            "clusters": clusters_summary,
        },
        "nodes": nodes_payload,
        "links": links_payload,
    }


def get_demo_dataset() -> Dict[str, Any]:
    """
    Conjunto de dados realistas para testar e inspecionar os grafos Unipartido e Bipartido
    imediatamente, mesmo antes de configurar as chaves da API do Spotify.
    """
    artists = [
        {"id": "a1", "name": "Radiohead", "popularity": 84, "genres": ["alternative rock", "art rock", "melancholia", "oxford indie"], "images": []},
        {"id": "a2", "name": "The Smile", "popularity": 68, "genres": ["art rock", "alternative rock", "indie rock"], "images": []},
        {"id": "a3", "name": "Arcade Fire", "popularity": 74, "genres": ["indie rock", "modern rock", "art pop", "canadian indie"], "images": []},
        {"id": "a4", "name": "Tame Impala", "popularity": 86, "genres": ["australian psych", "modern rock", "neo-psychedelic", "indie pop"], "images": []},
        {"id": "a5", "name": "MGMT", "popularity": 79, "genres": ["indie pop", "modern rock", "neo-psychedelic"], "images": []},
        {"id": "a6", "name": "Beach House", "popularity": 77, "genres": ["dream pop", "indie pop", "shoegaze", "art pop"], "images": []},
        {"id": "a7", "name": "Slowdive", "popularity": 73, "genres": ["shoegaze", "dream pop", "alternative rock"], "images": []},
        {"id": "a8", "name": "Cocteau Twins", "popularity": 72, "genres": ["dream pop", "shoegaze", "ethereal wave", "art pop"], "images": []},
        {"id": "a9", "name": "Milton Nascimento", "popularity": 75, "genres": ["mpb", "bossa nova", "brazilian jazz", "clube da esquina"], "images": []},
        {"id": "a10", "name": "Lô Borges", "popularity": 67, "genres": ["mpb", "clube da esquina", "brazilian rock"], "images": []},
        {"id": "a11", "name": "Caetano Veloso", "popularity": 78, "genres": ["mpb", "bossa nova", "tropicalia"], "images": []},
        {"id": "a12", "name": "Gilberto Gil", "popularity": 76, "genres": ["mpb", "tropicalia", "samba", "bossa nova"], "images": []},
        {"id": "a13", "name": "Gal Costa", "popularity": 75, "genres": ["mpb", "tropicalia", "bossa nova"], "images": []},
        {"id": "a14", "name": "Jorge Ben Jor", "popularity": 79, "genres": ["mpb", "samba rock", "samba", "tropicalia"], "images": []},
        {"id": "a15", "name": "Tim Maia", "popularity": 80, "genres": ["mpb", "brazilian soul", "samba rock", "brazilian boogie"], "images": []},
        {"id": "a16", "name": "Kendrick Lamar", "popularity": 94, "genres": ["conscious hip hop", "hip hop", "west coast rap", "rap"], "images": []},
        {"id": "a17", "name": "Tyler, The Creator", "popularity": 90, "genres": ["hip hop", "rap", "alternative hip hop", "neo soul"], "images": []},
        {"id": "a18", "name": "Frank Ocean", "popularity": 89, "genres": ["neo soul", "alternative r&b", "hip hop", "art pop"], "images": []},
        {"id": "a19", "name": "SZA", "popularity": 93, "genres": ["alternative r&b", "r&b", "neo soul"], "images": []},
        {"id": "a20", "name": "MF DOOM", "popularity": 81, "genres": ["alternative hip hop", "conscious hip hop", "hip hop", "east coast hip hop"], "images": []},
        {"id": "a21", "name": "Madlib", "popularity": 70, "genres": ["alternative hip hop", "instrumental hip hop", "jazz rap"], "images": []},
        {"id": "a22", "name": "Nujabes", "popularity": 76, "genres": ["jazz rap", "instrumental hip hop", "chillhop"], "images": []},
        {"id": "a23", "name": "Daft Punk", "popularity": 87, "genres": ["electro", "filter house", "french house", "synthpop"], "images": []},
        {"id": "a24", "name": "Justice", "popularity": 75, "genres": ["electro house", "filter house", "french house", "indietronica"], "images": []},
        {"id": "a25", "name": "LCD Soundsystem", "popularity": 74, "genres": ["alternative dance", "dance-punk", "indietronica", "modern rock", "art rock"], "images": []},
        {"id": "a26", "name": "Gorillaz", "popularity": 86, "genres": ["alternative hip hop", "modern rock", "art pop", "indietronica"], "images": []},
    ]

    tracks = [
        {"id": "t1", "name": "Weird Fishes/ Arpeggi", "artists": [{"id": "a1"}], "album": {"images": []}},
        {"id": "t2", "name": "Clube da Esquina Nº 2", "artists": [{"id": "a9"}, {"id": "a10"}], "album": {"images": []}},
        {"id": "t3", "name": "EARFQUAKE", "artists": [{"id": "a17"}, {"id": "a18"}], "album": {"images": []}},
        {"id": "t4", "name": "All Caps (Madvillain)", "artists": [{"id": "a20"}, {"id": "a21"}], "album": {"images": []}},
        {"id": "t5", "name": "Instant Crush", "artists": [{"id": "a23"}, {"id": "a4"}], "album": {"images": []}},
        {"id": "t6", "name": "Empire Ants", "artists": [{"id": "a26"}, {"id": "a6"}], "album": {"images": []}},
        {"id": "t7", "name": "Panis et Circenses", "artists": [{"id": "a11"}, {"id": "a12"}, {"id": "a13"}], "album": {"images": []}},
    ]
    return {"artists": artists, "top_tracks": tracks, "recent_tracks": [], "saved_tracks": []}


@app.get("/api/graph")
def get_music_graph(
    time_range: Literal["short_term", "medium_term", "long_term"] = Query("medium_term"),
    graph_mode: Literal["artists", "bipartite"] = Query("artists"),
    limit: int = Query(50, ge=10, le=50),
    demo: bool = Query(False),
):
    if demo:
        demo_data = get_demo_dataset()
        artists = demo_data["artists"]
        top_tracks = demo_data["top_tracks"]
        recent_tracks = demo_data["recent_tracks"]
        saved_tracks = demo_data["saved_tracks"]
    else:
        sp = get_spotify_client()
        top_artists_resp = sp.current_user_top_artists(limit=limit, time_range=time_range)
        top_tracks_resp = sp.current_user_top_tracks(limit=50, time_range=time_range)
        recent_resp = sp.current_user_recently_played(limit=50)
        saved_resp = sp.current_user_saved_tracks(limit=50)

        artists = top_artists_resp.get("items", [])
        top_tracks = top_tracks_resp.get("items", [])
        recent_tracks = recent_resp.get("items", [])
        saved_tracks = saved_resp.get("items", [])

    if graph_mode == "bipartite":
        return compute_bipartite_artist_genre_graph(
            artists=artists,
            top_tracks=top_tracks,
            saved_tracks=saved_tracks,
            time_range=time_range,
        )

    return compute_unipartite_artist_graph(
        artists=artists,
        top_tracks=top_tracks,
        recent_tracks=recent_tracks,
        saved_tracks=saved_tracks,
        time_range=time_range,
    )
