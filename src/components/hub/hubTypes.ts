export type MainTabKey = 'sessions' | 'apps' | 'geo' | 'quota';

export type SortOptionKey =
  | 'packets-desc'
  | 'packets-asc'
  | 'bytes-desc'
  | 'bytes-asc'
  | 'ip-asc'
  | 'ip-desc'
  | 'domain-asc'
  | 'recent-desc';

export type AppSortOptionKey =
  | 'bytes-desc'
  | 'bytes-asc'
  | 'packets-desc'
  | 'name-asc'
  | 'pid-asc';

export type GeoSortOptionKey =
  | 'ips-desc'
  | 'ips-asc'
  | 'bytes-desc'
  | 'bytes-asc'
  | 'country-asc';

export type SessionFilterType = 'all' | 'new' | 'normal' | 'suspicious' | 'baseline';
