// UNE BARRE PAR LIGNE, QUAND LA COMPARAISON COMPTE PLUS QUE LE CHIFFRE.
//
// La barre porte une PART, jamais une valeur brute : comparer visuellement deux
// longueurs qui n'ont pas la meme echelle est le plus vieux mensonge des
// tableaux de bord. Le chiffre exact reste ecrit a droite, et la barre n'est la
// que pour donner l'ordre de grandeur au premier coup d'oeil.
export default function AdminBars({
  rows,
}: {
  rows: { key: string; label: string; value: string; pct: number }[];
}) {
  return (
    <ul className="ad-bars">
      {rows.map((row) => (
        <li key={row.key}>
          <span>{row.label}</span>
          <span className="ad-bars__track">
            <span className="ad-bars__fill" style={{ width: `${Math.max(0, Math.min(100, row.pct))}%` }} />
          </span>
          <span className="ad-bars__value">{row.value}</span>
        </li>
      ))}
    </ul>
  );
}
