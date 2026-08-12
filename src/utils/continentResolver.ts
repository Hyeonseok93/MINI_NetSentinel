export type ContinentName =
  | 'Asia'
  | 'North America'
  | 'Europe'
  | 'South America'
  | 'Oceania'
  | 'Africa'
  | 'Unknown';

const countryToContinentMap: Record<string, ContinentName> = {
  // Asia
  KR: 'Asia',
  JP: 'Asia',
  CN: 'Asia',
  IN: 'Asia',
  SG: 'Asia',
  HK: 'Asia',
  TW: 'Asia',
  TH: 'Asia',
  VN: 'Asia',
  ID: 'Asia',
  MY: 'Asia',
  PH: 'Asia',
  PK: 'Asia',
  BD: 'Asia',
  IL: 'Asia',
  AE: 'Asia',
  SA: 'Asia',
  TR: 'Asia',

  // North America
  US: 'North America',
  CA: 'North America',
  MX: 'North America',

  // Europe
  GB: 'Europe',
  DE: 'Europe',
  FR: 'Europe',
  IT: 'Europe',
  ES: 'Europe',
  NL: 'Europe',
  RU: 'Europe',
  UA: 'Europe',
  SE: 'Europe',
  NO: 'Europe',
  FI: 'Europe',
  PL: 'Europe',
  CH: 'Europe',
  AT: 'Europe',
  BE: 'Europe',

  // South America
  BR: 'South America',
  AR: 'South America',
  CL: 'South America',
  CO: 'South America',
  PE: 'South America',

  // Oceania
  AU: 'Oceania',
  NZ: 'Oceania',

  // Africa
  ZA: 'Africa',
  EG: 'Africa',
  NG: 'Africa',
  KE: 'Africa',
};

export const getContinentName = (countryCode: string, countryName: string): ContinentName => {
  if (countryCode === 'UNK' || countryCode === 'LOC' || countryName === 'Unknown Location') {
    return 'Unknown';
  }
  const codeUpper = countryCode.toUpperCase();
  if (countryToContinentMap[codeUpper]) {
    return countryToContinentMap[codeUpper];
  }
  return 'Unknown';
};
