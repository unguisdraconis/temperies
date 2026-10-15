export type GeographicPlaceKind = 'country' | 'island' | 'inland-water' | 'marine';

export interface GeographicPlace {
  id: number;
  kind: GeographicPlaceKind;
  name: string;
  type: string;
}

export interface GeographicIndex {
  cells: Uint16Array;
  places: ReadonlyArray<GeographicPlace | null>;
}
