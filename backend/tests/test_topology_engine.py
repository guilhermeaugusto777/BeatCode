import os
import sys
import pytest
import numpy as np

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from main import (
    build_genre_corpus,
    extract_artist_tracks_and_collabs,
    compute_unipartite_artist_graph,
    compute_bipartite_artist_genre_graph,
    get_demo_dataset,
)


# ==============================================================================
# FIXTURES E DADOS DE TESTE CONTROLADOS
# ==============================================================================

@pytest.fixture
def modular_artists():
    """
    Retorna 5 artistas estruturados com clara separação de comunidades e um nó ponte:
    - art_rock_1 e art_rock_2: Comunidade Rock ("indie rock", "alternative rock")
    - art_hiphop_1 e art_hiphop_2: Comunidade Hip-Hop ("conscious hip hop", "boom bap")
    - art_bridge: Artista Ponte ("indie rock", "conscious hip hop")
    """
    return [
        {
            "id": "art_rock_1",
            "name": "The Rockers",
            "popularity": 75,
            "genres": ["indie rock", "alternative rock"],
            "images": [{"url": "http://img/r1_l.jpg"}, {"url": "http://img/r1_m.jpg"}],
        },
        {
            "id": "art_rock_2",
            "name": "Indie Band",
            "popularity": 70,
            "genres": ["indie rock", "post punk"],
            "images": [{"url": "http://img/r2_m.jpg"}],
        },
        {
            "id": "art_bridge",
            "name": "Genre Blender",
            "popularity": 85,
            "genres": ["indie rock", "conscious hip hop"],
            "images": [],
        },
        {
            "id": "art_hiphop_1",
            "name": "MC Flow",
            "popularity": 80,
            "genres": ["conscious hip hop", "boom bap"],
            "images": [{"url": "http://img/h1_m.jpg"}],
        },
        {
            "id": "art_hiphop_2",
            "name": "Beat Maker",
            "popularity": 65,
            "genres": ["conscious hip hop", "hardcore hip hop"],
            "images": [],
        },
    ]


@pytest.fixture
def collab_tracks():
    """Faixas com colaboração entre artistas específicos."""
    return [
        {
            "id": "trk_collab_rock",
            "name": "Rock Anthem",
            "artists": [{"id": "art_rock_1"}, {"id": "art_rock_2"}],
            "album": {"images": [{"url": "http://img/album1.jpg"}]},
        },
        {
            "id": "trk_collab_bridge",
            "name": "Crossover Hit",
            "artists": [{"id": "art_rock_1"}, {"id": "art_bridge"}],
            "album": {"images": []},
        },
    ]


@pytest.fixture
def recent_session_tracks():
    """Histórico de faixas recentes simulando co-escuta sequencial."""
    return [
        {"track": {"artists": [{"id": "art_hiphop_1"}]}},
        {"track": {"artists": [{"id": "art_hiphop_2"}]}},
        {"track": {"artists": [{"id": "art_bridge"}]}},
    ]


# ==============================================================================
# 1. FUNÇÕES AUXILIARES DE PROCESSAMENTO (CORPUS E COLABORAÇÕES)
# ==============================================================================

def test_build_genre_corpus_formatting(modular_artists):
    """Verifica que o corpus gera termos exatos com '_' e sub-tokens com mais de 2 letras."""
    corpus = build_genre_corpus(modular_artists)
    assert len(corpus) == len(modular_artists)

    # Verifica primeiro artista: 'indie rock' e 'alternative rock'
    doc0 = corpus[0]
    assert "indie_rock" in doc0
    assert "alternative_rock" in doc0
    assert "indie" in doc0
    assert "rock" in doc0
    assert "alternative" in doc0


def test_build_genre_corpus_handles_empty_genres():
    """Lida adequadamente com artistas sem gêneros ou strings vazias."""
    artists = [{"id": "a1", "genres": []}, {"id": "a2", "genres": [" "]}]
    corpus = build_genre_corpus(artists)
    assert len(corpus) == 2
    assert corpus[0] == ""


def test_extract_artist_tracks_and_collabs(modular_artists, collab_tracks):
    """Verifica matriz de colaboração simétrica e mapeamento de faixas por artista."""
    artist_tracks, collab_matrix = extract_artist_tracks_and_collabs(
        modular_artists, collab_tracks, []
    )

    n = len(modular_artists)
    assert collab_matrix.shape == (n, n)
    # Diagonal deve ser 0 (não colabora consigo mesmo)
    np.testing.assert_array_equal(np.diagonal(collab_matrix), np.zeros(n))
    # Matriz simétrica
    np.testing.assert_array_equal(collab_matrix, collab_matrix.T)

    # art_rock_1 (idx 0) e art_rock_2 (idx 1) colaboraram
    assert collab_matrix[0, 1] > 0.0
    assert collab_matrix[1, 0] > 0.0

    # Faixas mapeadas
    assert len(artist_tracks["art_rock_1"]) >= 1
    assert artist_tracks["art_rock_1"][0]["name"] == "Rock Anthem"


# ==============================================================================
# 2. MOTOR UNIPARTIDO (compute_unipartite_artist_graph)
# ==============================================================================

def test_unipartite_weighting_and_components(modular_artists, collab_tracks, recent_session_tracks):
    """Verifica cálculo composto de pesos: similaridade de gênero, colaboração e sessão."""
    result = compute_unipartite_artist_graph(
        artists=modular_artists,
        top_tracks=collab_tracks,
        recent_tracks=recent_session_tracks,
        saved_tracks=[],
        time_range="medium_term",
        min_weight=0.10,
    )

    assert result["metadata"]["graph_mode"] == "artists"
    assert result["metadata"]["time_range"] == "medium_term"
    assert result["metadata"]["total_nodes"] == 5
    assert len(result["links"]) > 0

    # Cada link deve conter decomposição dos componentes de peso
    for link in result["links"]:
        assert "components" in link
        comps = link["components"]
        assert "genre_similarity" in comps
        assert "direct_collaboration" in comps
        assert "co_listening" in comps
        assert 0.0 <= link["weight"] <= 1.0


def test_unipartite_mst_preserves_connected_components(modular_artists):
    """Garante que a Maximum Spanning Tree (MST) impede fragmentação indevida quando há pesos viáveis."""
    result = compute_unipartite_artist_graph(
        artists=modular_artists,
        top_tracks=[],
        recent_tracks=[],
        saved_tracks=[],
        time_range="short_term",
        k_neighbors=2,
        min_weight=0.05,
    )

    # Se há 5 nós conectados com pesos >= min_weight, o número de arestas deve cobrir o grafo
    assert result["metadata"]["total_links"] >= 4
    # Todos os links devem ser artist-artist
    for link in result["links"]:
        assert link["link_type"] == "artist-artist"


def test_unipartite_louvain_communities_and_modularity(modular_artists):
    """Verifica detecção de comunidades Louvain e cálculo de modularidade Q."""
    result = compute_unipartite_artist_graph(
        artists=modular_artists,
        top_tracks=[],
        recent_tracks=[],
        saved_tracks=[],
        time_range="medium_term",
        min_weight=0.08,
    )

    metadata = result["metadata"]
    assert "modularity_score" in metadata
    assert isinstance(metadata["modularity_score"], float)
    assert len(metadata["clusters"]) > 0

    for cluster in metadata["clusters"]:
        assert "cluster_id" in cluster
        assert "color" in cluster
        assert "dominant_genres" in cluster
        assert cluster["artist_count"] > 0


def test_unipartite_bridge_artist_identification(modular_artists, collab_tracks):
    """
    Verifica se o cálculo de Betweenness Centrality identifica o nó ponte
    que conecta as comunidades Rock e Hip-Hop.
    """
    result = compute_unipartite_artist_graph(
        artists=modular_artists,
        top_tracks=collab_tracks,
        recent_tracks=[],
        saved_tracks=[],
        time_range="long_term",
        min_weight=0.05,
    )

    bridge = result["metadata"]["bridge_artist"]
    assert bridge is not None
    assert "id" in bridge
    assert "name" in bridge
    assert "betweenness_centrality" in bridge

    # art_bridge possui gêneros de ambas as comunidades (Rock + Hip-Hop)
    # portanto deve apresentar centralidade de intermediação >= aos nós puramente periféricos
    bridge_node = next(n for n in result["nodes"] if n["id"] == bridge["id"])
    periph_rock = next(n for n in result["nodes"] if n["id"] == "art_rock_2")
    assert bridge_node["metrics"]["betweenness_centrality"] >= periph_rock["metrics"]["betweenness_centrality"]


# ==============================================================================
# 3. MOTOR BIPARTIDO (compute_bipartite_artist_genre_graph)
# ==============================================================================

def test_bipartite_node_creation_and_attributes(modular_artists):
    """Verifica que o grafo bipartido cria nós de Artistas e Gêneros com atributos corretos."""
    result = compute_bipartite_artist_genre_graph(
        artists=modular_artists,
        top_tracks=[],
        saved_tracks=[],
        time_range="medium_term",
    )

    nodes = result["nodes"]
    artist_nodes = [n for n in nodes if n["node_type"] == "artist"]
    genre_nodes = [n for n in nodes if n["node_type"] == "genre"]

    assert len(artist_nodes) == len(modular_artists)
    assert len(genre_nodes) > 0

    # Atributos de artistas
    for a in artist_nodes:
        assert a["node_type"] == "artist"
        assert a["affinity_rank"] is not None
        assert "val" in a
        assert "color" in a
        assert a["metrics"]["degree_centrality"] >= 0.0

    # Atributos de gêneros
    for g in genre_nodes:
        assert g["node_type"] == "genre"
        assert g["id"].startswith("genre::")
        assert g["affinity_rank"] is None
        assert g["connected_artists_count"] >= 1
        assert g["val"] >= 8


def test_bipartite_strict_bipartition(modular_artists):
    """
    Garante a propriedade fundamental do grafo bipartido:
    Todas as arestas conectam exclusivamente um Artista a um Gênero (V1 ↔ V2).
    Nunca Artista ↔ Artista ou Gênero ↔ Gênero.
    """
    result = compute_bipartite_artist_genre_graph(
        artists=modular_artists,
        top_tracks=[],
        saved_tracks=[],
        time_range="medium_term",
    )

    node_types = {n["id"]: n["node_type"] for n in result["nodes"]}
    assert len(result["links"]) > 0

    for link in result["links"]:
        s_type = node_types[link["source"]]
        t_type = node_types[link["target"]]
        assert link["link_type"] == "artist-genre"
        # Um lado deve ser artista e o outro gênero
        assert {s_type, t_type} == {"artist", "genre"}


def test_bipartite_edge_weights_and_affinity(modular_artists):
    """Verifica que os pesos das arestas no grafo bipartido refletem a afinidade do artista."""
    result = compute_bipartite_artist_genre_graph(
        artists=modular_artists,
        top_tracks=[],
        saved_tracks=[],
        time_range="short_term",
    )

    for link in result["links"]:
        # Fórmula: w = 0.35 + 0.65 * affinity_score
        assert 0.35 <= link["weight"] <= 1.0


def test_bipartite_bridge_artist_is_always_artist(modular_artists):
    """Verifica que o bridge_artist identificado no bipartido é sempre do tipo 'artist' (nunca um gênero)."""
    result = compute_bipartite_artist_genre_graph(
        artists=modular_artists,
        top_tracks=[],
        saved_tracks=[],
        time_range="long_term",
    )

    bridge = result["metadata"]["bridge_artist"]
    if bridge:
        bridge_node = next(n for n in result["nodes"] if n["id"] == bridge["id"])
        assert bridge_node["node_type"] == "artist"


# ==============================================================================
# 4. CASOS DE BORDA E RESILIÊNCIA TOPOLÓGICA
# ==============================================================================

def test_unipartite_empty_artist_list():
    """Lista de artistas vazia retorna grafo íntegro sem exceções."""
    result = compute_unipartite_artist_graph(
        artists=[], top_tracks=[], recent_tracks=[], saved_tracks=[], time_range="medium_term"
    )
    assert result["metadata"]["total_nodes"] == 0
    assert result["metadata"]["total_links"] == 0
    assert result["metadata"]["modularity_score"] == 0.0
    assert result["metadata"]["bridge_artist"] is None
    assert result["nodes"] == []
    assert result["links"] == []


def test_bipartite_empty_artist_list():
    """Lista de artistas vazia no bipartido retorna grafo íntegro sem exceções."""
    result = compute_bipartite_artist_genre_graph(
        artists=[], top_tracks=[], saved_tracks=[], time_range="medium_term"
    )
    assert result["metadata"]["total_nodes"] == 0
    assert result["metadata"]["total_links"] == 0
    assert result["metadata"]["modularity_score"] == 0.0
    assert result["metadata"]["bridge_artist"] is None
    assert result["nodes"] == []
    assert result["links"] == []


def test_unipartite_single_artist():
    """Apenas 1 artista não causa divisão por zero e retorna 1 nó com 0 links."""
    single = [{"id": "solo_1", "name": "Solo Artist", "popularity": 60, "genres": ["pop"], "images": []}]
    result = compute_unipartite_artist_graph(
        artists=single, top_tracks=[], recent_tracks=[], saved_tracks=[], time_range="short_term"
    )
    assert result["metadata"]["total_nodes"] == 1
    assert result["metadata"]["total_links"] == 0
    assert len(result["nodes"]) == 1
    assert result["links"] == []
    assert result["nodes"][0]["metrics"]["betweenness_centrality"] == 0.0


def test_bipartite_single_artist():
    """Apenas 1 artista no bipartido cria o nó do artista e o seu gênero principal sem falhas."""
    single = [{"id": "solo_1", "name": "Solo Artist", "popularity": 60, "genres": ["ambient"], "images": []}]
    result = compute_bipartite_artist_genre_graph(
        artists=single, top_tracks=[], saved_tracks=[], time_range="short_term"
    )
    assert result["metadata"]["total_nodes"] == 2  # 1 artista + 1 gênero
    assert result["metadata"]["total_links"] == 1
    assert len(result["links"]) == 1


def test_unipartite_artists_without_genres():
    """Artistas com genres: [] não causam erro no TfidfVectorizer e processam colaborações."""
    artists_no_genres = [
        {"id": "a1", "name": "Unknown 1", "genres": [], "popularity": 40, "images": []},
        {"id": "a2", "name": "Unknown 2", "genres": [], "popularity": 50, "images": []},
    ]
    tracks = [{"id": "t1", "name": "Collab Song", "artists": [{"id": "a1"}, {"id": "a2"}], "album": {"images": []}}]

    result = compute_unipartite_artist_graph(
        artists=artists_no_genres,
        top_tracks=tracks,
        recent_tracks=[],
        saved_tracks=[],
        time_range="medium_term",
        min_weight=0.01,
    )
    assert result["metadata"]["total_nodes"] == 2
    # Devem se conectar via colaboração direta mesmo sem gêneros
    assert result["metadata"]["total_links"] == 1


def test_bipartite_artists_without_genres():
    """Artistas sem gêneros são adicionados como nós sem falhas e sem criar nós de gêneros órfãos."""
    artists_no_genres = [
        {"id": "a1", "name": "Unknown 1", "genres": [], "popularity": 40, "images": []},
        {"id": "a2", "name": "Unknown 2", "genres": [], "popularity": 50, "images": []},
    ]
    result = compute_bipartite_artist_genre_graph(
        artists=artists_no_genres,
        top_tracks=[],
        saved_tracks=[],
        time_range="medium_term",
    )
    assert result["metadata"]["total_nodes"] == 2
    assert result["metadata"]["total_links"] == 0
    assert all(n["node_type"] == "artist" for n in result["nodes"])


def test_unipartite_disconnected_components():
    """Dois grupos de artistas completamente disjuntos (sem gêneros ou faixas compartilhadas)."""
    disjoint_artists = [
        {"id": "metal_1", "name": "Death Metal Band", "genres": ["death metal", "grindcore"], "popularity": 50, "images": []},
        {"id": "metal_2", "name": "Black Metal Band", "genres": ["black metal", "grindcore"], "popularity": 50, "images": []},
        {"id": "bossa_1", "name": "Bossa Duo", "genres": ["bossa nova", "samba"], "popularity": 50, "images": []},
        {"id": "bossa_2", "name": "Violão Solo", "genres": ["bossa nova", "mpb"], "popularity": 50, "images": []},
    ]

    result = compute_unipartite_artist_graph(
        artists=disjoint_artists,
        top_tracks=[],
        recent_tracks=[],
        saved_tracks=[],
        time_range="medium_term",
        min_weight=0.10,
    )

    assert result["metadata"]["total_nodes"] == 4
    # Deve conter pelo menos 2 clusters separados
    cluster_ids = {n["cluster_id"] for n in result["nodes"]}
    assert len(cluster_ids) >= 2


# ==============================================================================
# 5. CONTRATO DE DADOS E INTEGRIDADE REFERENCIAL DE IDs
# ==============================================================================

def test_payload_contract_and_referential_integrity_unipartite(modular_artists, collab_tracks):
    """
    Valida o contrato formal exigido pelo frontend no modo Unipartido:
    - Todas as arestas (source e target) apontam para IDs existentes em 'nodes'.
    - Tipos de dados e métricas esperadas estão presentes.
    """
    result = compute_unipartite_artist_graph(
        artists=modular_artists,
        top_tracks=collab_tracks,
        recent_tracks=[],
        saved_tracks=[],
        time_range="medium_term",
        min_weight=0.05,
    )

    node_ids = {n["id"] for n in result["nodes"]}
    for link in result["links"]:
        assert link["source"] in node_ids, f"ID de origem {link['source']} inexistente em nodes!"
        assert link["target"] in node_ids, f"ID de destino {link['target']} inexistente em nodes!"
        assert isinstance(link["weight"], float)

    for node in result["nodes"]:
        assert "id" in node
        assert "name" in node
        assert "node_type" in node
        assert "val" in node
        assert "color" in node
        assert "metrics" in node
        assert "degree_centrality" in node["metrics"]
        assert "betweenness_centrality" in node["metrics"]


def test_payload_contract_and_referential_integrity_bipartite(modular_artists):
    """
    Valida o contrato formal exigido pelo frontend no modo Bipartido:
    - Todas as arestas (source e target) apontam para IDs existentes em 'nodes'.
    - IDs de gêneros seguem a convenção 'genre::<nome>'.
    """
    result = compute_bipartite_artist_genre_graph(
        artists=modular_artists,
        top_tracks=[],
        saved_tracks=[],
        time_range="medium_term",
    )

    node_ids = {n["id"] for n in result["nodes"]}
    for link in result["links"]:
        assert link["source"] in node_ids, f"ID de origem {link['source']} inexistente em nodes!"
        assert link["target"] in node_ids, f"ID de destino {link['target']} inexistente em nodes!"

    for node in result["nodes"]:
        if node["node_type"] == "genre":
            assert node["id"].startswith("genre::")
            assert node["affinity_rank"] is None
        elif node["node_type"] == "artist":
            assert node["affinity_rank"] is not None


def test_demo_dataset_topology_integrity():
    """Valida a integridade topológica do dataset de demonstração oficial de BeatCode."""
    demo_data = get_demo_dataset()
    artists = demo_data["artists"]
    tracks = demo_data["top_tracks"]

    # 1. Modo unipartido
    unipartite_res = compute_unipartite_artist_graph(
        artists=artists,
        top_tracks=tracks,
        recent_tracks=demo_data.get("recent_tracks", []),
        saved_tracks=demo_data.get("saved_tracks", []),
        time_range="medium_term",
    )
    uni_node_ids = {n["id"] for n in unipartite_res["nodes"]}
    assert len(uni_node_ids) == len(artists)
    for link in unipartite_res["links"]:
        assert link["source"] in uni_node_ids
        assert link["target"] in uni_node_ids

    assert unipartite_res["metadata"]["bridge_artist"] is not None
    assert unipartite_res["metadata"]["modularity_score"] > 0.0

    # 2. Modo bipartido
    bipartite_res = compute_bipartite_artist_genre_graph(
        artists=artists,
        top_tracks=tracks,
        saved_tracks=demo_data.get("saved_tracks", []),
        time_range="medium_term",
    )
    bip_node_ids = {n["id"] for n in bipartite_res["nodes"]}
    for link in bipartite_res["links"]:
        assert link["source"] in bip_node_ids
        assert link["target"] in bip_node_ids
        assert {bipartite_res["nodes"][0]["node_type"], "genre"}
