import { connectionKey, endpointId } from "../lib/connectionExplanation.mjs";

const COMPONENT_LABELS = {
  genre_similarity: ["Gêneros", "Semelhança textual entre os gêneros associados aos artistas."],
  direct_collaboration: ["Colaborações", "Faixas creditadas aos dois artistas no conjunto consultado."],
  co_listening: ["Coescuta", "Proximidade na lista recente de reproduções; os horários não entram neste cálculo."],
};

const formatScore = (value, digits = 4) => Number(value).toLocaleString("pt-BR", {
  minimumFractionDigits: digits,
  maximumFractionDigits: digits,
});

export default function ConnectionExplorer({
  focusedNode,
  connections,
  selectedKey,
  explanation,
  nodesById,
  onSelect,
  sectionRef,
}) {
  return (
    <section ref={sectionRef} className="border-t border-zinc-800 pt-5" aria-labelledby="connections-heading">
      <h3 id="connections-heading" className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
        Explorar conexões
      </h3>
      {!focusedNode ? (
        <p className="mt-3 text-sm leading-5 text-zinc-400">
          Escolha um artista ou gênero na busca para ver suas ligações. Você também pode tocar ou clicar em uma linha no mapa.
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm text-zinc-300">
            Ligações visíveis de <strong className="text-white">{focusedNode.name}</strong>
          </p>
          {connections.length === 0 ? (
            <p className="mt-2 text-xs text-zinc-400">Nenhuma ligação visível com o limiar atual.</p>
          ) : (
            <ul className="mt-3 max-h-44 space-y-1.5 overflow-y-auto pr-1" aria-label={`Conexões de ${focusedNode.name}`}>
              {connections.map((link) => {
                const key = connectionKey(link);
                const source = nodesById.get(endpointId(link.source));
                const target = nodesById.get(endpointId(link.target));
                const other = source?.id === focusedNode.id ? target : source;
                return (
                  <li key={key}>
                    <button
                      type="button"
                      onClick={() => onSelect(link)}
                      aria-pressed={selectedKey === key}
                      className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400 ${selectedKey === key ? "border-emerald-500 bg-emerald-950/50 text-white" : "border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-zinc-600"}`}
                    >
                      <span className="min-w-0 truncate">{other?.node_type === "genre" ? "# " : ""}{other?.name || "Nó desconhecido"}</span>
                      <span className="shrink-0 text-xs text-zinc-400">{formatScore(link.weight, 3)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      <div className="mt-4 rounded-xl border border-zinc-700 bg-zinc-950/90 p-4" aria-live="polite">
        {!selectedKey ? (
          <p className="text-sm text-zinc-400">Nenhuma conexão selecionada. Escolha uma ligação na lista ou no mapa.</p>
        ) : !explanation ? (
          <p className="text-sm text-amber-300">Os dados desta ligação estão incompletos; não é possível explicá-la com segurança.</p>
        ) : explanation.kind === "artist-genre" ? (
          <>
            <h4 className="text-base font-semibold text-white">{explanation.artistName} ↔ #{explanation.genreName}</h4>
            <p className="mt-3 text-sm text-zinc-200">Peso da ligação: <strong>{formatScore(explanation.weight, 3)}</strong> <span className="text-zinc-400">(arredondado pela API)</span></p>
            <p className="mt-3 text-xs leading-5 text-zinc-400">
              O Spotify associou esse gênero ao artista. O BeatCode atribui o peso a partir da posição do artista no ranking consultado; ele não mede confiança do Spotify nem usa a fórmula das ligações entre artistas.
            </p>
          </>
        ) : (
          <>
            <h4 className="text-base font-semibold text-white">{explanation.sourceName} ↔ {explanation.targetName}</h4>
            <p className="mt-3 text-sm text-zinc-200">Peso final informado pela API: <strong>{formatScore(explanation.weight)}</strong> <span className="text-zinc-400">(arredondado a 4 casas)</span></p>
            <p className="mt-2 text-xs leading-5 text-zinc-400">
              Coeficientes fixos (exatos) do modelo: 0,65 × gêneros + 0,25 × colaborações + 0,10 × coescuta. As contribuições abaixo são aproximadas porque a API arredonda cada componente antes de enviá-lo.
            </p>
            <dl className="mt-4 space-y-3">
              {explanation.components.map(({ name, coefficient, contribution }) => {
                const [label, meaning] = COMPONENT_LABELS[name];
                return (
                  <div key={name} className="border-t border-zinc-800 pt-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <dt className="text-sm font-medium text-zinc-200">{label} <span className="text-xs font-normal text-zinc-500">× {formatScore(coefficient, 2)}</span></dt>
                      <dd className="text-sm font-semibold tabular-nums text-emerald-400">{contribution === null ? "Indisponível" : `≈ ${formatScore(contribution)}`}</dd>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-zinc-500">{meaning}</p>
                  </div>
                );
              })}
            </dl>
            <div className="mt-4 border-t border-zinc-800 pt-3">
              <p className="text-xs font-medium text-zinc-300">Gêneros com o mesmo nome nos dois artistas</p>
              {explanation.sharedGenres.length > 0 ? (
                <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Gêneros compartilhados">
                  {explanation.sharedGenres.map((genre) => <li key={genre} className="rounded-full bg-zinc-800 px-2 py-1 text-xs text-zinc-200">{genre}</li>)}
                </ul>
              ) : (
                <p className="mt-1 text-xs leading-5 text-zinc-500">Nenhum rótulo idêntico. A similaridade também pode vir de termos parecidos nos gêneros.</p>
              )}
            </div>
            <p className="mt-4 text-xs leading-5 text-zinc-500">Esses números explicam uma regra do BeatCode; não são porcentagens de preferência musical.</p>
          </>
        )}
      </div>
    </section>
  );
}
