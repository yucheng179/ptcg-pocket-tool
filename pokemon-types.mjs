export const pokemonTypeOptions = [
    { id: 1, key: "grass", label: "草" },
    { id: 2, key: "fire", label: "火" },
    { id: 3, key: "water", label: "水" },
    { id: 4, key: "lightning", label: "電" },
    { id: 5, key: "psychic", label: "超" },
    { id: 6, key: "fighting", label: "鬥" },
    { id: 7, key: "darkness", label: "惡" },
    { id: 8, key: "metal", label: "鋼" },
    { id: 9, key: "dragon", label: "龍" },
    { id: 10, key: "colorless", label: "無" }
];

export function getPokemonTypes(cardEntry) {
    if (cardEntry.cardType !== "pokemon" || !Array.isArray(cardEntry.play?.types)) return [];
    return [...new Set(cardEntry.play.types
        .map(id => pokemonTypeOptions.find(option => option.id === Number(id))?.key)
        .filter(Boolean))];
}
